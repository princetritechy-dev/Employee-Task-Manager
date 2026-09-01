const mongoose = require("mongoose");
const { ChatMessage, ChatRead, User } = require("../models");
const presence = require("../utils/presence");
const typing = require("../utils/typing");

function serialize(msg, sender) {
  const json = msg.toJSON();
  json.Sender = sender
    ? { id: sender.id, name: sender.name, role: sender.role, avatarId: sender.avatarId || "" }
    : null;
  return json;
}

async function attachSenders(messages) {
  const senderIds = [...new Set(messages.map((m) => m.senderId.toString()))];
  const senders = await User.find({ _id: { $in: senderIds } }).select(
    "name role avatarId"
  );
  const sendersById = new Map(senders.map((s) => [s.id, s]));
  return messages.map((m) => serialize(m, sendersById.get(m.senderId.toString())));
}

exports.contacts = async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      status: "active",
    })
      .select("name email role avatarId")
      .sort({ name: 1 });

    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarId: u.avatarId || "",
        online: presence.isOnline(u.id),
      }))
    );
  } catch (error) {
    console.error("Chat contacts error:", error);
    res.status(500).json({ message: "Could not load contacts" });
  }
};

exports.getTeamMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.find({ recipientId: null })
      .sort({ createdAt: 1 })
      .limit(300);

    res.json(await attachSenders(messages));
  } catch (error) {
    console.error("Get team messages error:", error);
    res.status(500).json({ message: "Could not load team chat" });
  }
};

exports.postTeamMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message can't be empty" });
    }

    const msg = await ChatMessage.create({
      senderId: req.user._id,
      recipientId: null,
      message: message.trim(),
    });

    res.status(201).json(serialize(msg, req.user));
  } catch (error) {
    console.error("Post team message error:", error);
    res.status(500).json({ message: "Could not send message" });
  }
};

exports.getDM = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    const messages = await ChatMessage.find({
      $or: [
        { senderId: req.user._id, recipientId: userId },
        { senderId: userId, recipientId: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(300);

    res.json(await attachSenders(messages));
  } catch (error) {
    console.error("Get DM error:", error);
    res.status(500).json({ message: "Could not load messages" });
  }
};

exports.postDM = async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    if (String(userId) === String(req.user._id)) {
      return res.status(400).json({ message: "You can't message yourself" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message can't be empty" });
    }

    const recipient = await User.findById(userId);

    if (!recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    const msg = await ChatMessage.create({
      senderId: req.user._id,
      recipientId: userId,
      message: message.trim(),
    });

    res.status(201).json(serialize(msg, req.user));
  } catch (error) {
    console.error("Post DM error:", error);
    res.status(500).json({ message: "Could not send message" });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message can't be empty" });
    }

    const msg = await ChatMessage.findById(id);

    if (!msg) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (String(msg.senderId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }

    msg.message = message.trim();
    msg.edited = true;
    await msg.save();

    res.json(serialize(msg, req.user));
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ message: "Could not edit message" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const msg = await ChatMessage.findById(id);

    if (!msg) {
      return res.status(404).json({ message: "Message not found" });
    }

    const isSender = String(msg.senderId) === String(req.user._id);

    if (!isSender && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    await msg.deleteOne();

    res.json({ message: "Message deleted" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ message: "Could not delete message" });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { conversationKey } = req.body;

    if (!conversationKey) {
      return res.status(400).json({ message: "conversationKey is required" });
    }

    await ChatRead.findOneAndUpdate(
      { userId: req.user._id, conversationKey },
      { lastReadAt: new Date() },
      { upsert: true }
    );

    res.json({ message: "Marked read" });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ message: "Could not mark as read" });
  }
};

exports.unreadCounts = async (req, res) => {
  try {
    const reads = await ChatRead.find({ userId: req.user._id });
    const lastReadByKey = new Map(reads.map((r) => [r.conversationKey, r.lastReadAt]));

    const teamSince = lastReadByKey.get("team") || new Date(0);
    const teamCount = await ChatMessage.countDocuments({
      recipientId: null,
      senderId: { $ne: req.user._id },
      createdAt: { $gt: teamSince },
    });

    const dmUnread = await ChatMessage.aggregate([
      { $match: { recipientId: req.user._id } },
      {
        $group: {
          _id: "$senderId",
          lastMessageAt: { $max: "$createdAt" },
          messages: { $push: { createdAt: "$createdAt" } },
        },
      },
    ]);

    const dm = {};

    for (const group of dmUnread) {
      const key = String(group._id);
      const since = lastReadByKey.get(key) || new Date(0);
      const count = group.messages.filter((m) => m.createdAt > since).length;
      if (count > 0) dm[key] = count;
    }

    res.json({ team: teamCount, dm });
  } catch (error) {
    console.error("Unread counts error:", error);
    res.status(500).json({ message: "Could not load unread counts" });
  }
};

exports.pingTyping = async (req, res) => {
  try {
    const { conversationKey, dmUserId } = req.body;

    const key =
      dmUserId && mongoose.isValidObjectId(dmUserId)
        ? typing.dmKey(req.user._id, dmUserId)
        : conversationKey;

    if (!key) {
      return res.status(400).json({ message: "conversationKey or dmUserId is required" });
    }

    typing.setTyping(key, req.user._id, req.user.name);

    res.json({ message: "ok" });
  } catch (error) {
    console.error("Typing ping error:", error);
    res.status(500).json({ message: "Could not update typing status" });
  }
};

exports.getTypingStatus = async (req, res) => {
  try {
    const { conversationKey, dmUserId } = req.query;

    const key =
      dmUserId && mongoose.isValidObjectId(dmUserId)
        ? typing.dmKey(req.user._id, dmUserId)
        : conversationKey;

    if (!key) {
      return res.status(400).json({ message: "conversationKey or dmUserId is required" });
    }

    res.json(typing.getTyping(key, req.user._id));
  } catch (error) {
    console.error("Get typing status error:", error);
    res.status(500).json({ message: "Could not load typing status" });
  }
};
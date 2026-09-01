import React, { useEffect, useRef, useState } from "react";
import { Send, Users, MessageCircle, Pencil, Trash2, X, Check } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";
import api from "../api";

let typingTimeout = null;

export default function ChatWidget({ open, onClose, onUnreadChange }) {
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");

  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState({ type: "team" });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const [unread, setUnread] = useState({ team: 0, dm: {} });
  const [typingUsers, setTypingUsers] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const scrollRef = useRef(null);

  async function loadContacts() {
    try {
      const r = await api.get("/chat/contacts");
      setContacts(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      console.error("Could not load contacts", err);
    }
  }

  async function loadUnread() {
    try {
      const r = await api.get("/chat/unread");
      const data = r.data || { team: 0, dm: {} };
      setUnread(data);
      const total = (data.team || 0) + Object.values(data.dm || {}).reduce((a, b) => a + b, 0);
      onUnreadChange?.(total);
    } catch (err) {
      console.error("Could not load unread counts", err);
    }
  }

  function activeConversationKey() {
    return active.type === "team" ? "team" : active.userId;
  }

  async function markActiveRead() {
    try {
      await api.post("/chat/read", { conversationKey: activeConversationKey() });
      loadUnread();
    } catch (err) {
      // non-critical
    }
  }

  async function loadMessages() {
    try {
      const url = active.type === "team" ? "/chat/team" : `/chat/dm/${active.userId}`;
      const r = await api.get(url);
      setMessages(Array.isArray(r.data) ? r.data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load messages");
    }
  }

  async function loadTyping() {
    try {
      const params =
        active.type === "team" ? { conversationKey: "team" } : { dmUserId: active.userId };
      const r = await api.get("/chat/typing", { params });
      setTypingUsers(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      // non-critical
    }
  }

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    loadContacts();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    loadMessages();
    markActiveRead();
    setTypingUsers([]);

    const interval = setInterval(() => {
      loadMessages();
      loadTyping();
      markActiveRead();
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active.type, active.userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function notifyTyping() {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      const body =
        active.type === "team" ? { conversationKey: "team" } : { dmUserId: active.userId };
      api.post("/chat/typing", body).catch(() => {});
    }, 150);
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setSending(true);
    setError("");

    try {
      const url = active.type === "team" ? "/chat/team" : `/chat/dm/${active.userId}`;
      await api.post(url, { message: text.trim() });
      setText("");
      await loadMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Could not send message");
    } finally {
      setSending(false);
    }
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditText(m.message);
  }

  async function saveEdit(id) {
    if (!editText.trim()) return;
    try {
      await api.patch(`/chat/message/${id}`, { message: editText.trim() });
      setEditingId(null);
      setEditText("");
      await loadMessages();
    } catch (err) {
      alert(err.response?.data?.message || "Could not edit message");
    }
  }

  async function confirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/chat/message/${id}`);
      await loadMessages();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete message");
    }
  }

  if (!open) return null;

  return (
    <div className="chat-widget">

      <div className="chat-widget-header">
        <div className="chat-widget-title">
          <MessageCircle size={16} />
          <strong>Chat</strong>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="chat-widget-body">

        <div className="chat-widget-sidebar">

          <div
            className={`chat-contact ${active.type === "team" ? "active" : ""}`}
            onClick={() => setActive({ type: "team" })}
          >
            <span className="chat-avatar chat-avatar-team">
              <Users size={14} />
            </span>
            <div className="chat-contact-info">
              <strong>Team Room</strong>
            </div>
            {unread.team > 0 && <span className="chat-unread-badge">{unread.team}</span>}
          </div>

          <div className="chat-sidebar-label">Direct Messages</div>

          {contacts.map((c) => (
            <div
              key={c.id}
              className={`chat-contact ${
                active.type === "dm" && active.userId === c.id ? "active" : ""
              }`}
              onClick={() => setActive({ type: "dm", userId: c.id, name: c.name })}
            >
              <span className="chat-avatar-wrap">
                <AvatarDisplay avatarId={c.avatarId} name={c.name} size={32} />
                <span className={`chat-presence-dot ${c.online ? "online" : ""}`} />
              </span>
              <div className="chat-contact-info">
                <strong>{c.name}</strong>
              </div>
              {unread.dm?.[c.id] > 0 && (
                <span className="chat-unread-badge">{unread.dm[c.id]}</span>
              )}
            </div>
          ))}
        </div>

        <div className="chat-widget-main">

          <div className="chat-widget-main-title">
            {active.type === "team" ? "Team Room" : active.name}
          </div>

          {error && <div className="error">{error}</div>}

          <div className="chat-messages" ref={scrollRef}>
            {!messages.length && (
              <p className="muted" style={{ padding: "12px" }}>
                No messages yet. Say hello!
              </p>
            )}

            {messages.map((m) => {
              const isMe = m.Sender?.id === currentUser?.id;
              const isEditing = editingId === m.id;

              return (
                <div key={m.id} className={`chat-bubble-row ${isMe ? "me" : ""}`}>
                  <div className="chat-bubble">
                    {!isMe && <div className="chat-bubble-sender">{m.Sender?.name || "User"}</div>}

                    {isEditing ? (
                      <div className="chat-edit-row">
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <button type="button" onClick={() => saveEdit(m.id)}>
                          <Check size={13} />
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <p>{m.message}</p>
                    )}

                    <small>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {m.edited && " · edited"}
                    </small>

                    {isMe && !isEditing && (
                      <div className="chat-bubble-actions">
                        <Pencil size={12} onClick={() => startEdit(m)} />
                        <Trash2 size={12} onClick={() => setConfirmDeleteId(m.id)} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {typingUsers.length > 0 && (
              <div className="chat-typing-indicator">
                {typingUsers.map((t) => t.name).join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}
          </div>

          <form className="chat-input-row" onSubmit={send}>
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                notifyTyping();
              }}
              placeholder={active.type === "team" ? "Message the team..." : `Message ${active.name}...`}
            />
            <button className="btn" disabled={sending || !text.trim()}>
              <Send size={15} />
            </button>
          </form>

        </div>

      </div>

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete message?</h2>
              <button className="close-btn" onClick={() => setConfirmDeleteId(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="muted">This can't be undone.</p>
            <div className="form-actions" style={{ marginTop: "14px" }}>
              <button className="btn danger" onClick={confirmDelete}>
                Delete
              </button>
              <button className="btn secondary" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
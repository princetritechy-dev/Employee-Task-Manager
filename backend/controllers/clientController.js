const mongoose = require("mongoose");
const { Client, Project } = require("../models");

exports.list = async (req, res) => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    res.json(clients);
  } catch (error) {
    console.error("List clients error:", error);
    res.status(500).json({ message: "Could not load clients" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, contactName, email, phone, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Client name is required" });
    }

    const client = await Client.create({
      name: name.trim(),
      contactName: contactName || "",
      email: email || "",
      phone: phone || "",
      notes: notes || "",
    });

    res.status(201).json(client);
  } catch (error) {
    console.error("Create client error:", error);
    res.status(500).json({ message: "Could not create client" });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const { name, contactName, email, phone, notes } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: "Client name can't be empty" });
      }
      client.name = name.trim();
    }

    if (contactName !== undefined) client.contactName = contactName;
    if (email !== undefined) client.email = email;
    if (phone !== undefined) client.phone = phone;
    if (notes !== undefined) client.notes = notes;

    await client.save();

    res.json(client);
  } catch (error) {
    console.error("Update client error:", error);
    res.status(500).json({ message: "Could not update client" });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }

    const inUse = await Project.exists({ clientId: id });

    if (inUse) {
      return res.status(400).json({
        message: "This client is linked to a project — remove that link first",
      });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    await client.deleteOne();

    res.json({ message: "Client deleted" });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({ message: "Could not delete client" });
  }
};

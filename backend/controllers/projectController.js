const mongoose = require("mongoose");
const { Project, User, Task, Client } = require("../models");

/*
|--------------------------------------------------------------------------
| Serialize project
|--------------------------------------------------------------------------
| Attaches resolved member/supervisor users under "Users"/"Supervisors",
| and the resolved client under "Client" — while keeping the raw
| members/supervisors/clientId fields on the object too.
|--------------------------------------------------------------------------
*/

function serialize(project, users, supervisors = [], client = null) {
  const json = project.toJSON();
  json.Users = users;
  json.Supervisors = supervisors;
  json.Client = client;
  return json;
}

async function loadMembers(project) {
  return User.find({ _id: { $in: project.members } }).select("name email");
}

async function loadSupervisors(project) {
  return User.find({ _id: { $in: project.supervisors || [] } }).select("name email");
}

async function loadClient(project) {
  if (!project.clientId) return null;
  return Client.findById(project.clientId);
}

exports.list = async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    const memberIds = [
      ...new Set(projects.flatMap((p) => p.members.map((id) => id.toString()))),
    ];

    const supervisorIds = [
      ...new Set(projects.flatMap((p) => (p.supervisors || []).map((id) => id.toString()))),
    ];

    const clientIds = [
      ...new Set(projects.map((p) => p.clientId).filter(Boolean).map((id) => id.toString())),
    ];

    const users = await User.find({ _id: { $in: memberIds } }).select(
      "name email"
    );
    const usersById = new Map(users.map((u) => [u.id, u.toJSON()]));

    const supervisorUsers = await User.find({ _id: { $in: supervisorIds } }).select(
      "name email"
    );
    const supervisorsById = new Map(supervisorUsers.map((u) => [u.id, u.toJSON()]));

    const clients = await Client.find({ _id: { $in: clientIds } });
    const clientsById = new Map(clients.map((c) => [c.id, c.toJSON()]));

    const result = projects.map((project) =>
      serialize(
        project,
        project.members.map((id) => usersById.get(id.toString())).filter(Boolean),
        (project.supervisors || [])
          .map((id) => supervisorsById.get(id.toString()))
          .filter(Boolean),
        project.clientId ? clientsById.get(project.clientId.toString()) || null : null
      )
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, clientId, description, status, startDate, endDate, employeeIds = [], supervisorIds = [] } = req.body;
    if (!name) return res.status(400).json({ message: "Project name is required" });

    if (clientId && !mongoose.isValidObjectId(clientId)) {
      return res.status(400).json({ message: "Invalid client" });
    }

    const validEmployeeIds = Array.isArray(employeeIds)
      ? employeeIds.filter((id) => mongoose.isValidObjectId(id))
      : [];

    const validSupervisorIds = Array.isArray(supervisorIds)
      ? supervisorIds.filter((id) => mongoose.isValidObjectId(id))
      : [];

    const members =
      req.user.role === "admin" && Array.isArray(employeeIds)
        ? validEmployeeIds
        : [req.user._id];

    const supervisors =
      req.user.role === "admin" ? validSupervisorIds : [];

    const project = await Project.create({
      name,
      clientId: clientId || null,
      description,
      status,
      startDate,
      endDate,
      members,
      supervisors,
    });

    const users = await loadMembers(project);
    const supervisorUsers = await loadSupervisors(project);
    const client = await loadClient(project);

    res.status(201).json(serialize(project, users, supervisorUsers, client));
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { name, clientId, description, status, startDate, endDate, employeeIds, supervisorIds, statusColumns } = req.body;

    if (clientId !== undefined && clientId && !mongoose.isValidObjectId(clientId)) {
      return res.status(400).json({ message: "Invalid client" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (clientId !== undefined) updates.clientId = clientId || null;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;

    project.set(updates);

    if (Array.isArray(employeeIds)) {
      project.members = employeeIds.filter((id) => mongoose.isValidObjectId(id));
    }

    if (Array.isArray(supervisorIds)) {
      project.supervisors = supervisorIds.filter((id) => mongoose.isValidObjectId(id));
    }

    if (Array.isArray(statusColumns)) {
      if (statusColumns.length < 1 || statusColumns.length > 12) {
        return res.status(400).json({
          message: "A project needs between 1 and 12 status columns",
        });
      }

      const cleaned = [];
      const seenKeys = new Set();

      for (const col of statusColumns) {
        const label = String(col?.label || "").trim();
        if (!label) {
          return res.status(400).json({ message: "Every column needs a name" });
        }

        const key =
          String(col?.key || label)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || `col_${cleaned.length}`;

        if (seenKeys.has(key)) {
          return res.status(400).json({
            message: `Duplicate column key "${key}" — column names must be unique`,
          });
        }
        seenKeys.add(key);

        const category = ["open", "active", "done"].includes(col?.category)
          ? col.category
          : "open";

        cleaned.push({
          key,
          label: label.slice(0, 40),
          color: /^#[0-9a-fA-F]{6}$/.test(col?.color) ? col.color : "#64748B",
          category,
          promptOnEnter: !!col?.promptOnEnter,
        });
      }

      project.statusColumns = cleaned;
    }

    await project.save();

    const users = await loadMembers(project);
    const supervisorUsers = await loadSupervisors(project);
    const client = await loadClient(project);

    res.json(serialize(project, users, supervisorUsers, client));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const hasTasks = await Task.exists({ projectId: project._id });
    if (hasTasks) {
      return res.status(400).json({ message: "Project cannot be deleted while it has tasks" });
    }

    await project.deleteOne();
    res.json({ message: "Project deleted" });
  } catch (error) {
    res.status(400).json({ message: "Project cannot be deleted while it has tasks" });
  }
};

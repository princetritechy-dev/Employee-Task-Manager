const mongoose = require("mongoose");
const { Project, User, Task } = require("../models");

/*
|--------------------------------------------------------------------------
| Serialize project
|--------------------------------------------------------------------------
| Attaches the resolved member users under "Users" (matching the old
| Sequelize belongsToMany default alias) while keeping the raw `members`
| id array on the object.
|--------------------------------------------------------------------------
*/

function serialize(project, users) {
  const json = project.toJSON();
  json.Users = users;
  return json;
}

async function loadMembers(project) {
  return User.find({ _id: { $in: project.members } }).select("name email");
}

exports.list = async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    const memberIds = [
      ...new Set(projects.flatMap((p) => p.members.map((id) => id.toString()))),
    ];

    const users = await User.find({ _id: { $in: memberIds } }).select(
      "name email"
    );
    const usersById = new Map(users.map((u) => [u.id, u.toJSON()]));

    const result = projects.map((project) =>
      serialize(
        project,
        project.members.map((id) => usersById.get(id.toString())).filter(Boolean)
      )
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, status, startDate, endDate, employeeIds = [] } = req.body;
    if (!name) return res.status(400).json({ message: "Project name is required" });

    const validEmployeeIds = Array.isArray(employeeIds)
      ? employeeIds.filter((id) => mongoose.isValidObjectId(id))
      : [];

    const members =
      req.user.role === "admin" && Array.isArray(employeeIds)
        ? validEmployeeIds
        : [req.user._id];

    const project = await Project.create({
      name,
      description,
      status,
      startDate,
      endDate,
      members,
    });

    const users = await loadMembers(project);

    res.status(201).json(serialize(project, users));
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

    const { name, description, status, startDate, endDate, employeeIds } = req.body;

    project.set({ name, description, status, startDate, endDate });

    if (Array.isArray(employeeIds)) {
      project.members = employeeIds.filter((id) => mongoose.isValidObjectId(id));
    }

    await project.save();

    const users = await loadMembers(project);

    res.json(serialize(project, users));
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

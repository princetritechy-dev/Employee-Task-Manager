const { User, Task, Project } = require("../models");

exports.employees = async (req, res) => {
  const users = await User.find({ role: "employee" })
    .select("-password")
    .sort({ name: 1 });

  res.json(users);
};

exports.dashboard = async (req, res) => {
  const [employees, projects, tasks] = await Promise.all([
    User.countDocuments({ role: "employee", status: "active" }),
    Project.countDocuments({ status: "ongoing" }),
    Task.countDocuments(),
  ]);

  res.json({ employees, ongoingProjects: projects, totalTasks: tasks });
};

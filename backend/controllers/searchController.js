const { Task, Project, Client, User } = require("../models");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RESULT_LIMIT = 6;

exports.search = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json({ tasks: [], projects: [], clients: [], users: [] });
    }

    const pattern = new RegExp(escapeRegex(q), "i");
    const isAdmin = req.user.role === "admin";

    const taskQuery = isAdmin
      ? { taskTitle: pattern }
      : {
          taskTitle: pattern,
          $or: [{ userId: req.user._id }, { assigneeIds: req.user._id }],
        };

    const [tasks, projects, clients, users] = await Promise.all([
      Task.find(taskQuery)
        .select("taskTitle projectId status")
        .limit(RESULT_LIMIT),

      Project.find({ name: pattern }).select("name status").limit(RESULT_LIMIT),

      Client.find({ name: pattern }).select("name").limit(RESULT_LIMIT),

      isAdmin
        ? User.find({ name: pattern, role: "employee" })
            .select("name email avatarId")
            .limit(RESULT_LIMIT)
        : Promise.resolve([]),
    ]);

    res.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.taskTitle,
        projectId: t.projectId,
        status: t.status,
      })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, status: p.status })),
      clients: clients.map((c) => ({ id: c.id, name: c.name })),
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, avatarId: u.avatarId || "" })),
    });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ message: "Search failed" });
  }
};
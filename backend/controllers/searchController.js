const { Task, Project, Client, User } = require("../models");

/*
|--------------------------------------------------------------------------
| Escape user input before dropping it into a RegExp
|--------------------------------------------------------------------------
*/

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RESULT_LIMIT = 6;

/*
|--------------------------------------------------------------------------
| GLOBAL SEARCH — ⌘K style, across tasks/projects/clients/(users for admin)
|--------------------------------------------------------------------------
| Scoped by role, same rules as everywhere else in the app:
|   - Tasks: admins see everything, everyone else only their own/assigned
|   - Projects/Clients: visible to any authenticated user (unchanged from
|     how the rest of the app already treats them)
|   - Users: admin only
|--------------------------------------------------------------------------
*/

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
            .select("name email")
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
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ message: "Search failed" });
  }
};

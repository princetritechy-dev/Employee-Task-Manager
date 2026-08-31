const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { User, Task, Project } = require("../models");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

/*
|--------------------------------------------------------------------------
| Projects a supervisor manages (null for admin = no restriction)
|--------------------------------------------------------------------------
*/

async function managedProjectIds(user) {
  if (user.role === "admin") return null;
  const projects = await Project.find({ supervisors: user._id }).select("_id");
  return projects.map((p) => p._id);
}

exports.employees = async (req, res) => {
  try {
    if (req.user.role === "supervisor") {
      const ids = await managedProjectIds(req.user);
      const projects = await Project.find({ _id: { $in: ids } }).select("members");
      const memberIds = [
        ...new Set(projects.flatMap((p) => p.members.map((id) => id.toString()))),
      ];

      const users = await User.find({
        _id: { $in: memberIds },
        role: "employee",
      })
        .select("-password")
        .sort({ name: 1 });

      return res.json(users);
    }

    const users = await User.find({ role: "employee" })
      .select("-password")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error("List employees error:", error);
    res.status(500).json({ message: "Could not load employees" });
  }
};

exports.dashboard = async (req, res) => {
  try {
    if (req.user.role === "supervisor") {
      const ids = await managedProjectIds(req.user);

      const [managedProjects, tasks] = await Promise.all([
        Project.find({ _id: { $in: ids } }).select("members status"),
        Task.countDocuments({ projectId: { $in: ids } }),
      ]);

      const employeeIds = [
        ...new Set(managedProjects.flatMap((p) => p.members.map((id) => id.toString()))),
      ];

      const [employees, ongoingProjects] = await Promise.all([
        User.countDocuments({
          _id: { $in: employeeIds },
          role: "employee",
          status: "active",
        }),
        Promise.resolve(managedProjects.filter((p) => p.status === "ongoing").length),
      ]);

      return res.json({ employees, ongoingProjects, totalTasks: tasks });
    }

    const [employees, projects, tasks] = await Promise.all([
      User.countDocuments({ role: "employee", status: "active" }),
      Project.countDocuments({ status: "ongoing" }),
      Task.countDocuments(),
    ]);

    res.json({ employees, ongoingProjects: projects, totalTasks: tasks });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Could not load dashboard" });
  }
};

/*
|--------------------------------------------------------------------------
| CREATE USER (employee or supervisor) — admin only
|--------------------------------------------------------------------------
| There's no public registration anymore. This is how everyone except the
| very first admin gets an account — an admin creates it here. Admin
| accounts themselves are NOT created through this endpoint on purpose;
| they're seeded directly in the database (see scripts/createAdmin.js).
|--------------------------------------------------------------------------
*/

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role = "employee" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    if (!["employee", "supervisor"].includes(role)) {
      return res.status(400).json({
        message: "Role must be employee or supervisor",
      });
    }

    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters and include a letter and a number",
      });
    }

    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      role,
      status: "active",
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)[0]?.message || "Invalid input";
      return res.status(400).json({ message });
    }

    res.status(500).json({ message: "Could not create user" });
  }
};

/*
|--------------------------------------------------------------------------
| LIST ALL USERS (employees + supervisors) — admin only
|--------------------------------------------------------------------------
| Separate from exports.employees, which only returns employees (and is
| scoped for supervisors). This is for the admin's user-management view,
| where they need to see and manage supervisors too.
|--------------------------------------------------------------------------
*/

exports.allUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["employee", "supervisor"] } })
      .select("-password")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Could not load users" });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE USER (name/email/role/status) — admin only
|--------------------------------------------------------------------------
| Used to change an employee to a supervisor (or back), rename/deactivate
| an account, etc. Can't be used to touch admin accounts — those aren't
| managed through the app at all (see scripts/createAdmin.js), and an
| admin can't demote/deactivate themselves by accident through this.
|--------------------------------------------------------------------------
*/

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);

    if (!user || user.role === "admin") {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, role, status } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Name can't be empty" });
      }
      user.name = trimmed;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).toLowerCase().trim();

      if (!EMAIL_RE.test(normalizedEmail)) {
        return res.status(400).json({ message: "Enter a valid email address" });
      }

      if (normalizedEmail !== user.email) {
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
          return res.status(409).json({ message: "Email already in use" });
        }
        user.email = normalizedEmail;
      }
    }

    if (role !== undefined) {
      if (!["employee", "supervisor"].includes(role)) {
        return res.status(400).json({ message: "Role must be employee or supervisor" });
      }
      user.role = role;
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      user.status = status;
    }

    await user.save();

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("Update user error:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)[0]?.message || "Invalid input";
      return res.status(400).json({ message });
    }

    res.status(500).json({ message: "Could not update user" });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE USER — admin only
|--------------------------------------------------------------------------
| Blocked if the user still owns any tasks (same spirit as "a project
| can't be deleted while it has tasks") — force reassigning/cleaning up
| their work first rather than silently orphaning it. Also cleans up any
| project membership/supervisor references so nothing dangles.
|--------------------------------------------------------------------------
*/

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: "You can't delete your own account" });
    }

    const user = await User.findById(id);

    if (!user || user.role === "admin") {
      return res.status(404).json({ message: "User not found" });
    }

    const ownsTasks = await Task.exists({ userId: user._id });

    if (ownsTasks) {
      return res.status(400).json({
        message: "This user still owns tasks — reassign or delete those first",
      });
    }

    await Promise.all([
      Project.updateMany(
        {},
        { $pull: { members: user._id, supervisors: user._id } }
      ),
      Task.updateMany(
        { assigneeIds: user._id },
        { $pull: { assigneeIds: user._id } }
      ),
      user.deleteOne(),
    ]);

    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Could not delete user" });
  }
};

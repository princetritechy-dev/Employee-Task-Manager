const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { User, Task, Project } = require("../models");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

exports.employees = async (req, res) => {
  try {
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
| CREATE USER (employee) — admin only
|--------------------------------------------------------------------------
| There's no public registration anymore. This is how everyone except the
| very first admin gets an account — an admin creates it here. Admin
| accounts themselves are NOT created through this endpoint on purpose;
| they're seeded directly in the database (see scripts/createAdmin.js).
|--------------------------------------------------------------------------
*/

exports.createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

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
      role: "employee",
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
| LIST ALL USERS (employees) — admin only
|--------------------------------------------------------------------------
| Separate from exports.employees so the admin's user-management view has
| its own endpoint, independent of anything else that reads employees.
|--------------------------------------------------------------------------
*/

exports.allUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "employee" })
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
| UPDATE USER (name/email/status) — admin only
|--------------------------------------------------------------------------
| Can't be used to touch admin accounts — those aren't managed through
| the app at all (see scripts/createAdmin.js), and an admin can't
| deactivate themselves by accident through this.
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

    const { name, email, status } = req.body;

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
| Blocked if the user still owns any tasks — force reassigning/cleaning
| up their work first rather than silently orphaning it. Also cleans up
| any project membership references so nothing dangles.
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
        { $pull: { members: user._id } }
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

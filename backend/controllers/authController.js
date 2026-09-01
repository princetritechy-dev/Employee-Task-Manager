const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { User } = require("../models");
const sendEmail = require("../utils/sendEmail");
const { AVATAR_IDS } = require("../utils/avatarOptions");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarId: user.avatarId || ""
  };
}

function sign(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

// ========================================
// LOGIN
// ========================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!EMAIL_RE.test(normalizedEmail) || !password) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (
      !user ||
      !(await bcrypt.compare(password || "", user.password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account is inactive"
      });
    }

    res.json({
      message: "Login successful",
      token: sign(user),
      user: publicUser(user)
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: error.message
    });
  }
};

// ========================================
// FORGOT PASSWORD
// ========================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      });
    }

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(404).json({
        message: "Email not registered"
      });
    }

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString("hex");

    // Token valid for 15 minutes
    user.resetToken = token;

    user.resetTokenExpiry = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await user.save();

    // Frontend reset URL
    const resetURL =
      `${process.env.FRONTEND_URL}/reset-password/${token}`;

    await sendEmail({
      email: user.email,

      subject: "Reset Your Employee Task Manager Password",

      message: `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 30px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    ">

      <h2 style="
        color: #222;
        margin-bottom: 25px;
      ">
        Password Reset Request
      </h2>

      <p style="color: #555; font-size: 15px;">
        Hello ${user.name},
      </p>

      <p style="
        color: #555;
        font-size: 15px;
        line-height: 1.6;
      ">
        We received a request to reset your
        Employee Task Manager password.
      </p>

      <p style="
        color: #555;
        font-size: 15px;
      ">
        Click the button below to create a new password:
      </p>

      <div style="margin: 30px 0;">
        
          href="${resetURL}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-size: 15px;
            font-weight: bold;
          "
        >
          Reset Password
        </a>
      </div>

      <p style="
        color: #555;
        font-size: 14px;
      ">
        This link will expire in
        <strong>15 minutes</strong>.
      </p>

      <p style="
        color: #777;
        font-size: 14px;
        line-height: 1.6;
      ">
        If you did not request a password reset,
        you can safely ignore this email.
      </p>

      <p style="
        color: #555;
        font-size: 14px;
        margin-top: 30px;
      ">
        Regards,<br>
        <strong>Employee Task Manager</strong>
      </p>

    </div>
  `
    });

    return res.json({
      message: "Password reset link sent to your email"
    });

  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// ========================================
// RESET PASSWORD
// ========================================

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required"
      });
    }

    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters and include a letter and a number"
      });
    }

    const user = await User.findOne({
      resetToken: token
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid reset token"
      });
    }

    if (
      !user.resetTokenExpiry ||
      user.resetTokenExpiry < new Date()
    ) {
      return res.status(400).json({
        message: "Reset token expired"
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(password, 10);

    // Remove reset token
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    return res.json({
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// ========================================
// ME
// ========================================

exports.me = async (req, res) => {
  res.json({
    user: publicUser(req.user)
  });
};

// ========================================
// UPDATE PROFILE — any logged-in user, their own account only
// ========================================

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, avatarId, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

    if (avatarId !== undefined) {
      if (avatarId && !AVATAR_IDS.includes(avatarId)) {
        return res.status(400).json({ message: "That's not a valid avatar option" });
      }

      user.avatarId = avatarId;
    }

    // Password change is optional and requires the current password.
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Enter your current password to set a new one" });
      }

      const matches = await bcrypt.compare(currentPassword, user.password);
      if (!matches) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      if (!PASSWORD_RE.test(newPassword)) {
        return res.status(400).json({
          message: "New password must be at least 6 characters and include a letter and a number"
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    res.json({
      message: "Profile updated",
      user: publicUser(user)
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)[0]?.message || "Invalid input";
      return res.status(400).json({ message });
    }

    res.status(500).json({ message: "Could not update profile" });
  }
};
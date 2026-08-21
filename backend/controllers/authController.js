const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { User } = require("../models");
const sendEmail = require("../utils/sendEmail");

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status
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
// REGISTER
// ========================================

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "employee",
      adminCode
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (!["employee", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role selected"
      });
    }

    if (role === "admin") {
      if (
        !process.env.ADMIN_REGISTRATION_CODE ||
        adminCode !== process.env.ADMIN_REGISTRATION_CODE
      ) {
        return res.status(403).json({
          message: "Invalid admin registration code"
        });
      }
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({
      email: normalizedEmail
    });

    if (existing) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      role
    });

    res.status(201).json({
      message: "Registration successful",
      token: sign(user),
      user: publicUser(user)
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      message: error.message
    });
  }
};

// ========================================
// LOGIN
// ========================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: (email || "").toLowerCase().trim()
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

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

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

    // Send reset email
    await sendEmail({
      email: user.email,

      subject: "Reset Your Employee Task Manager Password",

      message: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 20px;
        ">

          <h2>Password Reset Request</h2>

          <p>Hello ${user.name},</p>

          <p>
            We received a request to reset your
            Employee Task Manager password.
          </p>

          <p>
            Click the button below to create a new password:
          </p>

          <p>
            <a
              href="${resetURL}"
              style="
                display: inline-block;
                padding: 12px 20px;
                background: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 6px;
              "
            >
              Reset Password
            </a>
          </p>

          <p>
            This link will expire in
            <strong>15 minutes</strong>.
          </p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p>
            Regards,<br>
            Employee Task Manager
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

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
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

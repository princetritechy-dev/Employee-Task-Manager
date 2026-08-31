const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { User } = require("../models");
const presence = require("../utils/presence");

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({
        message: "Invalid authentication token",
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account is inactive",
      });
    }

    // Always use the database user.
    // Do not trust role information from the frontend.
    req.user = user;

    presence.touch(user._id);

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

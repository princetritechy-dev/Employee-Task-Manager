const { Schema, model } = require("mongoose");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 190,
      match: [EMAIL_RE, "Enter a valid email address"],
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "supervisor", "employee"],
      default: "employee",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // Forgot Password fields
    resetToken: {
      type: String,
      default: null,
    },

    resetTokenExpiry: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "users",
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
      },
    },
    toObject: { virtuals: true },
  }
);

module.exports = model("User", userSchema);
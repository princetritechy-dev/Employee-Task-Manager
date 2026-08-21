const { Schema, model } = require("mongoose");

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    description: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["ongoing", "paused", "completed"],
      default: "ongoing",
    },

    /*
    |--------------------------------------------------------------------------
    | Dates
    |--------------------------------------------------------------------------
    | Kept as plain "YYYY-MM-DD" strings (matches the old SQL DATEONLY column)
    | so <input type="date"> values round-trip without timezone drift.
    |--------------------------------------------------------------------------
    */

    startDate: {
      type: String,
      default: null,
    },

    endDate: {
      type: String,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | MEMBERS
    |--------------------------------------------------------------------------
    | Replaces the old SQL "project_members" join table. Each entry is a
    | reference to a User (admin or employee) attached to this project.
    |--------------------------------------------------------------------------
    */

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    collection: "projects",
    timestamps: true,
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

module.exports = model("Project", projectSchema);

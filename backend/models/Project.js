const { Schema, model } = require("mongoose");

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      default: null,
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

    /*
    |--------------------------------------------------------------------------
    | CUSTOM STATUS COLUMNS (ClickUp-style)
    |--------------------------------------------------------------------------
    | Each project can define its own Kanban columns instead of the fixed
    | Open/In Progress/Redo/Completed set. "category" is what drives actual
    | behavior (starting/stopping the timer) — the label and color are
    | purely cosmetic. "promptOnEnter" reuses the Redo reason-capture flow
    | for any column flagged this way, not just one literally named Redo.
    |--------------------------------------------------------------------------
    */

    statusColumns: {
      type: [
        {
          key: { type: String, required: true, trim: true },
          label: { type: String, required: true, trim: true, maxlength: 40 },
          color: { type: String, default: "#64748B" },
          category: {
            type: String,
            enum: ["open", "active", "done"],
            default: "open",
          },
          promptOnEnter: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    },
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

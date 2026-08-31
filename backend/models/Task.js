const { Schema, model } = require("mongoose");

const taskSchema = new Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | Field names below (userId / projectId) intentionally match the old
    | SQL foreign-key column names so the API keeps returning them as plain
    | scalar IDs (the frontend reads task.projectId directly), in addition
    | to the populated "Employee" / "Project" objects built in the
    | controller.
    |--------------------------------------------------------------------------
    */

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    taskTitle: {
      type: String,
      required: true,
      maxlength: 255,
    },

    description: {
      type: String,
      default: "",
    },

    assignedBy: {
      type: String,
      default: "",
    },

    /*
    |--------------------------------------------------------------------------
    | TOTAL TIME SPENT
    |--------------------------------------------------------------------------
    | Stored in minutes.
    |
    | Example:
    | 30  = 30 minutes
    | 60  = 1 hour
    | 90  = 1 hour 30 minutes
    |--------------------------------------------------------------------------
    */

    timeSpent: {
      type: Number,
      required: true,
      default: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | TASK STATUS
    |--------------------------------------------------------------------------
    | This is a free-form key now, not a fixed enum — it references a
    | column key in the owning project's statusColumns (or one of the
    | default column keys if that project hasn't customized its columns).
    | The task's real "category" (open/active/done, which drives the
    | timer) is looked up from the project at runtime, not stored here.
    |--------------------------------------------------------------------------
    */

    status: {
      type: String,
      required: true,
      default: "pending",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | PRIORITY
    |--------------------------------------------------------------------------
    */

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    /*
    |--------------------------------------------------------------------------
    | DUE DATE
    |--------------------------------------------------------------------------
    | Stored as "YYYY-MM-DD" (same convention as taskDate). Optional —
    | separate from taskDate (which records the day the work happened).
    |--------------------------------------------------------------------------
    */

    dueDate: {
      type: String,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | TAGS
    |--------------------------------------------------------------------------
    */

    tags: {
      type: [String],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | SUBTASKS / CHECKLIST
    |--------------------------------------------------------------------------
    */

    subtasks: {
      type: [
        {
          title: { type: String, required: true, trim: true, maxlength: 255 },
          completed: { type: Boolean, default: false },
        },
      ],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | ASSIGNEES
    |--------------------------------------------------------------------------
    | Additional people this task is shared with, beyond the creator/owner
    | (userId). Anyone in here shows up in their "My Work" view and can
    | comment on the task.
    |--------------------------------------------------------------------------
    */

    assigneeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | TIME ESTIMATE
    |--------------------------------------------------------------------------
    | Stored in minutes, like timeSpent. Optional — 0 means "no estimate".
    |--------------------------------------------------------------------------
    */

    estimateMinutes: {
      type: Number,
      default: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | DEPENDENCIES
    |--------------------------------------------------------------------------
    | Other tasks that must be done first. This is a soft dependency —
    | completing a task with open blockers is still allowed, but the
    | response surfaces a warning so the UI can flag it.
    |--------------------------------------------------------------------------
    */

    blockedBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "Task" }],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | RECURRENCE
    |--------------------------------------------------------------------------
    | When a recurring task is completed, a fresh copy is automatically
    | created with taskDate/dueDate shifted forward.
    |--------------------------------------------------------------------------
    */

    repeat: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },

    /*
    |--------------------------------------------------------------------------
    | ACTIVITY LOG
    |--------------------------------------------------------------------------
    */

    activity: {
      type: [
        {
          action: { type: String, required: true },
          message: { type: String, required: true },
          byId: { type: Schema.Types.ObjectId, ref: "User" },
          byName: { type: String, default: "" },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | BOARD ORDER
    |--------------------------------------------------------------------------
    | Position of the card within its status column on the Kanban board.
    |--------------------------------------------------------------------------
    */

    order: {
      type: Number,
      default: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | TIMER
    |--------------------------------------------------------------------------
    */

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | TASK DATE
    |--------------------------------------------------------------------------
    | Stored as a "YYYY-MM-DD" string so date-only comparisons/filters behave
    | exactly like the old SQL DATEONLY column.
    |--------------------------------------------------------------------------
    */

    taskDate: {
      type: String,
      required: true,
    },

    /*
    |--------------------------------------------------------------------------
    | FIRST HOUR EDIT/DELETE LOCK
    |--------------------------------------------------------------------------
    */

    lockedUntil: {
      type: Date,
      required: true,
    },
  },
  {
    collection: "tasks",

    /*
    |--------------------------------------------------------------------------
    | CREATED AT / UPDATED AT
    |--------------------------------------------------------------------------
    */

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

module.exports = model("Task", taskSchema);

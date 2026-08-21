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
    */

    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      required: true,
      default: "pending",
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

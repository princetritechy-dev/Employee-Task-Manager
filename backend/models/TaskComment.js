const { Schema, model } = require("mongoose");

const taskCommentSchema = new Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | Field names below (taskId / adminId) intentionally match the old SQL
    | foreign-key column names.
    |--------------------------------------------------------------------------
    */

    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },

    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    comment: {
      type: String,
      required: true,
    },
  },
  {
    collection: "task_comments",
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

module.exports = model("TaskComment", taskCommentSchema);

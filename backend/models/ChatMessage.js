const { Schema, model } = require("mongoose");

/*
|--------------------------------------------------------------------------
| CHAT MESSAGE
|--------------------------------------------------------------------------
| Covers both the global Team Room and 1:1 DMs with a single schema:
|
|   - recipientId === null  ->  Team Room message (visible to everyone)
|   - recipientId === <id>  ->  DM between senderId and that user
|--------------------------------------------------------------------------
*/

const chatMessageSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },

    edited: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "chat_messages",
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

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
| Team Room reads filter on recipientId === null, sorted by time.
| DM reads filter on the (sender, recipient) pair in either direction.
|--------------------------------------------------------------------------
*/

chatMessageSchema.index({ recipientId: 1, createdAt: 1 });
chatMessageSchema.index({ senderId: 1, recipientId: 1, createdAt: 1 });

module.exports = model("ChatMessage", chatMessageSchema);

const { Schema, model } = require("mongoose");

/*
|--------------------------------------------------------------------------
| CHAT READ STATE
|--------------------------------------------------------------------------
| One row per (user, conversation) tracking when that user last read it.
| conversationKey is "team" for the Team Room, or the OTHER person's user
| id for a DM (from this reader's own point of view — each participant
| has their own row, there's no shared/canonical key needed here since
| "have I read this" is inherently personal).
|--------------------------------------------------------------------------
*/

const chatReadSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    conversationKey: {
      type: String,
      required: true,
    },

    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "chat_reads",
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

chatReadSchema.index({ userId: 1, conversationKey: 1 }, { unique: true });

module.exports = model("ChatRead", chatReadSchema);

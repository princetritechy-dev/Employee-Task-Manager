const { Schema, model } = require("mongoose");

/*
|--------------------------------------------------------------------------
| CLIENT
|--------------------------------------------------------------------------
| A company/client, managed independently of projects. Projects reference
| one of these via clientId instead of storing a free-text name — so
| "Acme Corp" is one place, not re-typed (and potentially misspelled
| differently) on every project.
|--------------------------------------------------------------------------
*/

const clientSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    contactName: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    collection: "clients",
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

module.exports = model("Client", clientSchema);

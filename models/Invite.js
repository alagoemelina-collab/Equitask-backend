const mongoose = require("mongoose");
 
const inviteSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: String,
      enum: ["employee"],
      default: "employee",
    },
    email: {
      type: string,
      lowercase: true,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
 
module.exports = mongoose.model("Invite", inviteSchema);
 
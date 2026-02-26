const mongoose = require("mongoose");
 
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["proof_submitted", "proof_approved", "proof_rejected", "task_due_soon", "task_due_now"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);
 
module.exports = mongoose.model("Notification", notificationSchema);
 
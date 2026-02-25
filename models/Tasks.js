const mongoose = require('mongoose');
 
const stepSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true
    },
    stepDescription: {
      type: String,
      required: true,
      trim: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);
 
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
 
    description: {
      type: String,
      required: true,
      trim: true
    },
 
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    },
 
    urgencyColor: {
      type: String,
      enum: ['red', 'yellow', 'green'],
      default: 'green'
    },
 
    category: {
      type: String,
      default: 'general'
    },
 
    dueDate: {
      type: Date
    },
 
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
 
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
 
    // 🔥 AI Generated Breakdown
    simplifiedSteps: {
      type: [stepSchema],
      default: []
    },

status: {
  type: String,
  enum: [
    "not_started", 
    "in_progress", 
    "completed", 
    "overdue", 
    "awaiting_verification", 
    "verified", 
    "rejected"
  ],
  default: "not_started"
},
 
proof: {
  proofType: { type: String, enum: ["image", "audio", "text"] },
  text: { type: String },
  fileUrl: { type: String },        // where file is stored (local path or cloud URL)
  fileName: { type: String },
  mimeType: { type: String },
  fileSize: { type: Number },
  submittedAt: { type: Date },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
},
 
managerReview: {
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date },
  decision: { type: String, enum: ["approved", "rejected"] },
  comment: { type: String }
}
 

  },
  { timestamps: true }
);
 
module.exports = mongoose.model('Task', taskSchema);
 
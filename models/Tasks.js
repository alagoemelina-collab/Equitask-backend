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
    }
  },
  { timestamps: true }
);
 
module.exports = mongoose.model('Task', taskSchema);
 
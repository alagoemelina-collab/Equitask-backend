const mongoose = require('mongoose');
 
const focusSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
 
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
 
  duration: {
    type: Number, // minutes
    default: 25
  },
 
  startTime: {
    type: Date,
    default: Date.now
  },
 
  endTime: {
    type: Date
  },
 
  completed: {
    type: Boolean,
    default: false
  }
 
}, { timestamps: true });
 
module.exports = mongoose.model('FocusSession', focusSessionSchema);
 
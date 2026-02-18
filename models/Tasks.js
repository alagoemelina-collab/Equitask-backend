const mongoose = require('mongoose');
 
const taskSchema = new mongoose.Schema({
  title: { 
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: { 
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  dueDate: { 
    type: Date,
    default: null
  },
  
  status: { 
    type: String,
    enum: {
      values: ['not_started', 'in_progress', 'completed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'not_started'
  },
  
  urgencyColor: { 
    type: String,
    enum: {
      values: ['red', 'yellow', 'green'],
      message: '{VALUE} is not a valid urgency color'
    },
    default: 'yellow'
  }
}, { 
  timestamps: true
});
 
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ dueDate: 1 });
 
module.exports = mongoose.model('Task', taskSchema);
// assignedTo = Who should do this task
// ObjectId = Reference to a User's _id
// ref: 'User' = Links to User model
// default: null = Can be empty (personal task)

 const mongoose = require('mongoose');
 
const userSchema = new mongoose.Schema({
  email: { 
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  
  password: { 
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  role: { 
    type: String,
    enum: ['manager', 'employee', 'regular'],
    required: [true, 'Role is required'],
    default: 'regular'
  }
}, { 
  timestamps: true
});
 
module.exports = mongoose.model('User', userSchema);
 
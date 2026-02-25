const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
 
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['manager', 'employee', 'regular'],
    default: 'regular'
  },
  phone: {
    type: String,
    trim: true
  },
  
  // 2FA FIELDS - TOTP (Authenticator App)
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false // Don't return by default for security
  }
}, {
  timestamps: true
});
 
 
   
 
module.exports = mongoose.model('User', userSchema);
// bcrypt.compare
 
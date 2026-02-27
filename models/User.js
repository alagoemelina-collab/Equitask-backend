const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
 
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
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
    required: function() { return this.authProvider === 'local'; }, // Only required for local auth
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
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
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  resetPasswordToken: {type: String},
  resetPasswordExpire: {type: Date},
  
  // 2FA FIELDS - TOTP (Authenticator App)
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false // Don't return by default for security
  },
  

}, {
  timestamps: true
});
 
//helps you hash the password automatically before saving the user to the database. This way, you never store plain text passwords, and it ensures that all passwords are hashed consistently. The check for `isModified("password")` ensures that we only hash the password if it has been changed, which is important for updates where the password might not be modified.
 userSchema.pre("save", async function () {
  // Only hash if password is modified
  if (!this.isModified("password")) return;
 
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
 
 
   
 
module.exports = mongoose.model('User', userSchema);
// bcrypt.compare
 
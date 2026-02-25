 // routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {protect} = require("../middleware/auth");
 
/**
 * POST /api/auth/login
 * Body: { "email": "...", "password": "..." }
 */
router.post("/login", async (req, res) => {
  console.log("LOGIN ROUTE HIT:", req.body);
 
  try {
    const { email, password } = req.body;
 
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide email and password" });
    }
 
    const user = await User.findOne({ email }).select("+password +twoFactorSecret");

//     console.log("User found:", user); it helps you see if the user is found and what data is retrieved, especially the password hash and 2FA secret. You can comment it out after debugging.
// console.log("Entered password:", password);
// console.log("Stored hash:", user?.password); 
 
 
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
 
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
 
    if (!isPasswordCorrect) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
 
    // If 2FA enabled, return tempToken
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, type: "2fa" },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }
      );
 
      return res.json({
        success: true,
        message: "Password verified. Enter code from authenticator app.",
        requiresTwoFactor: true,
        tempToken,
      });
    }
 
    // Otherwise normal login token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
 
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// GET /api/auth/me (protected)
router.get("/me", protect, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});


router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
 
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
 
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }
 
    //const hashedPassword = await bcrypt.hash(password, 10);
 
    const user = await User.create({
      email,
      password: password, // The pre-save hook in User.js will handle hashing
      role: role || "user",          // default role
      twoFactorEnabled: false
    });
 
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
 
 
 
module.exports = router;
 

// const bcrypt = require("bcrypt");
//bcrypt.hash("the user password", 10).then(console.log); it helps you generate a hash for a password to store in the database. You can run this in a separate script or REPL to get the hash value, then use that hash when creating users directly in the database for testing purposes.
 
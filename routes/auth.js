 // routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
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
 
 
module.exports = router;
 
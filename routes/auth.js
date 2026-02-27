 // routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {protect} = require("../middleware/auth");
 const Invite = require("../models/Invite");
 const generateToken = require("../utils/generateToken");
 const { OAuth2Client } = require("google-auth-library");
 const {forgotPassword, resetPassword} = require("../controllers/passwordController");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
 
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
 
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

   if (user.role === "employee") {
  if (!user.organizationId) {
    return res.status(403).json({
      success: false,
      message: "Not invited / not part of organization",
    });
  }
 
  if (user.isActive === false) {
    return res.status(403).json({
      success: false,
      message: "Account inactive",
    });
  }
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
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
      organizationId: user.organizationId},
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


 
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
 
    if (!idToken) {
      return res.status(400).json({ success: false, message: "Google token required" });
    }
 
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
 
    const payload = ticket.getPayload();
    const { email, name } = payload;
 
    // 1) find existing user
    let user = await User.findOne({ email });
 
    // 2) if user doesn't exist, create one
    if (!user) {
      user = await User.create({
        fullName: name,
        email,
        password: "google_oauth_user", // (or random string)
        role: "regular",
        isActive: true,
      });
    }
 
    // 3) return YOUR jwt
    const token = generateToken(user._id);
 
    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid Google token" });
  }
});
 




router.post(["/register", "/signup"], async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    //normalize role
    const roleRaw = req.body.role;
    const roleNormalized = (roleRaw || "reguler").toLowerCase();

    const roleMap = {
      user: "regular",
      staff: "employee",
      employee: "employee",
      manager: "manager",
    };

    const finalRole = roleMap[roleNormalized] || "regular";
 
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: "Full name, email and password are required" });
    }


    
 
let organizationId = null;
 
if (finalRole === "employee") {
  const inviteCode = (req.body.inviteCode || "").trim();
 
  if (!inviteCode) {
    return res.status(422).json({
      success: false,
      message: "Invalid or expired invite code",
    });
  }
 
  const invite = await Invite.findOne({ 
    code: inviteCode,
  status: "pending",
    expiresAt: { $gt: new Date() }
  });
 
  if (!invite) {
    return res.status(422).json({
      success: false,
      message: "Invalid or expired invite code",
    });
  }
 
  organizationId = invite.organizationId;
}
 
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }
 
    //const hashedPassword = await bcrypt.hash(password, 10);
 
    const user = await User.create({
      fullName,
      email,
      password,// The pre-save hook in User.js will handle hashing
      role: finalRole,
      organizationId,
      isActive: true,
      twoFactorEnabled: false
    });

    const token = generateToken(user._id, user.role);
 
    if (finalRole === "employee") {
      await Invite.updateOne(
        { code: req.body.inviteCode },
        { status: "accepted", usedBy: user._id }
      );
    }
 
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        organizationId: user.organizationId }
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
 
 
 
module.exports = router;
 

// const bcrypt = require("bcrypt");
//bcrypt.hash("the user password", 10).then(console.log); it helps you generate a hash for a password to store in the database. You can run this in a separate script or REPL to get the hash value, then use that hash when creating users directly in the database for testing purposes.
 
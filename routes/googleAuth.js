const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
 
const router = express.Router();
 
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
 
router.post("/", async (req, res) => {
  try {
    const { idToken } = req.body;
 
    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken is required" });
    }
 
    // verify token from Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
 
    const payload = ticket.getPayload();
    const email = payload.email;
    const fullName = payload.name || "Google User";
 
    if (!email) {
      return res.status(400).json({ success: false, message: "Google token has no email" });
    }
 
    // find or create user
    let user = await User.findOne({ email });
 
    if (!user) {
      user = await User.create({
        fullName,
        email,
        authProvider: "google", // or leave out if your schema allows
        role: "regular",        // set your default role
        isActive: true,
      });
    }
 
    const token = generateToken(user._id);
 
    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || null,
      },
    });
  } catch (err) {
    console.log("GOOGLE AUTH ERROR:", err);
    return res.status(401).json({ success: false, message: "Invalid Google token" });
  }
});
 
module.exports = router;
 
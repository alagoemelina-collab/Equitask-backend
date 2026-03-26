const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
 
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
 
const router = express.Router();
 
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
 
router.post("/", async (req, res) => {
  try {
    const { idToken, token, accessToken } = req.body;
 
    const googleToken = idToken || token || accessToken;
 
    console.log("GOOGLE AUTH BODY:", req.body);
    console.log("GOOGLE TOKEN PRESENT:", !!googleToken);
 
    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }
 
    const decoded = jwt.decode(googleToken);
    console.log("DECODED GOOGLE TOKEN:", decoded);
 
    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean);
 
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: allowedAudiences,
    });

    console.log("ENV GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("ENV GOOGLE_ANDROID_CLIENT_ID:", process.env.GOOGLE_ANDROID_CLIENT_ID);
 
 
    const payload = ticket.getPayload();
    console.log("VERIFIED GOOGLE PAYLOAD:", payload);
 
    const email = payload.email;
    const fullName = payload.name || "Google User";
 
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Google token has no email",
      });
    }
 
    let user = await User.findOne({ email });
 
    if (!user) {
      user = await User.create({
        fullName,
        email,
        authProvider: "google",
        role: "regular",
        isActive: true,
      });
 
      console.log("GOOGLE USER CREATED:", {
        id: user._id,
        email: user.email,
        role: user.role,
      });
    } else {
      console.log("GOOGLE USER FOUND:", {
        id: user._id,
        email: user.email,
        role: user.role,
      });
    }
 
    const tokenOut = generateToken(user._id, user.role);
 
    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token: tokenOut,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || null,
      },
    });
  } catch (err) {
    console.log("GOOGLE AUTH ERROR:", err);
 
    return res.status(401).json({
      success: false,
      message: "Invalid Google token",
      error: err.message,
    });
  }
});
 
module.exports = router;
 
 // routes/twofactors.js
const express = require("express");
const router = express.Router();
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
 
const User = require("../models/User");
const { protect } = require("../middleware/auth");
 
/**
 * POST /api/2fa/enable
 * Must be logged in with REAL token (Authorization: Bearer <token>)
 * Generates secret + QR for Authenticator
 */
router.post("/enable", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+twoFactorSecret");
 
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    const secret = speakeasy.generateSecret({
      name: `EquiTaskAI (${user.email})`,
    });
 
    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = false; // only becomes true after confirm
    await user.save();
 
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
 
    return res.json({
      success: true,
      message: "2FA secret generated. Scan QR, then confirm with code.",
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    });
  } catch (err) {
    console.error("2FA enable error:", err);
    return res.status(500).json({ success: false, message: "Server error enabling 2FA" });
  }
});
 
/**
 * POST /api/2fa/confirm
 * Must be logged in with REAL token
 * Body: { "code": "123456" }
 * Turns on twoFactorEnabled
 */
router.post("/confirm", protect, async (req, res) => {
  try {
    const { code } = req.body;
 
    if (!code) {
      return res.status(400).json({ success: false, message: "code is required" });
    }
 
    const user = await User.findById(req.user._id).select("+twoFactorSecret");
 
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "2FA secret not found. Enable 2FA first." });
    }
 
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });
 
    if (!verified) {
      return res.status(401).json({ success: false, message: "Invalid 2FA code" });
    }
 
    user.twoFactorEnabled = true;
    await user.save();
 
    return res.json({ success: true, message: "2FA enabled successfully." });
  } catch (err) {
    console.error("2FA confirm error:", err);
    return res.status(500).json({ success: false, message: "Server error confirming 2FA" });
  }
});
 
/**
 * POST /api/2fa/verify
 * Used during login AFTER password is verified
 * Body: { "tempToken": "...", "code": "123456" }
 * Returns REAL login token if code is valid
 */
router.post("/verify", async (req, res) => {
  try {
    const { tempToken, code } = req.body;
 
    if (!tempToken || !code) {
      return res.status(400).json({ success: false, message: "tempToken and code are required" });
    }
 
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
 
    if (decoded.type !== "2fa") {
      return res.status(401).json({ success: false, message: "Invalid temp token" });
    }
 
    const user = await User.findById(decoded.id).select("+twoFactorSecret");
 
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "2FA not set up for this user" });
    }
 
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });
 
    if (!verified) {
      return res.status(401).json({ success: false, message: "Invalid 2FA code" });
    }
 
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
 
    return res.json({
      success: true,
      message: "2FA verified. Login complete.",
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("2FA verify error:", err);
    return res.status(500).json({ success: false, message: "Server error verifying 2FA" });
  }
});
 
module.exports = router;
 
// routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
 
const User = require("../models/User");
const Invite = require("../models/Invite");
const { protect } = require("../middleware/auth");
const generateToken = require("../utils/generateToken");
const {
  forgotPassword,
  resetPassword,
} = require("../controllers/passwordController");
 
const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function getAllowedGoogleAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean);
}
 
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
 
/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  console.log("LOGIN ROUTE HIT:", req.body);
 
  try {
    const { email, password } = req.body;
 
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }
 
    const user = await User.findOne({ email }).select("+password +twoFactorSecret");
 
    console.log("USER FOUND:", !!user);
    console.log("LOGIN EMAIL:", email);
    console.log("USER RECORD:", user);
 
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
 
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
 
    console.log("PASSWORD MATCH:", isPasswordCorrect);
 
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
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
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});


router.post("/logout", protect, async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});
 

router.get("/settings", protect, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      settings: {
        notifications: true,
        darkMode: false,
        accessibilityMode: false,
        role: req.user.role,
        email: req.user.email,
        fullName: req.user.fullName || "",
      },
    });
  } catch (error) {
    console.error("SETTINGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching settings",
    });
  }
});
 
 
/**
 * GET /api/auth/me
 */
router.get("/me", protect, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});
 
/**
 * POST /api/auth/google
 * Body: { idToken }
 */
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
 
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google token required",
      });
    }
 
    const decoded = jwt.decode(idToken);
    const allowedAudiences = getAllowedGoogleAudiences();
    const tokenAudience = decoded?.aud;
    const authorizedParty = decoded?.azp;

    if (!allowedAudiences.length) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth is not configured on the server",
      });
    }

    if (
      !tokenAudience ||
      (!allowedAudiences.includes(tokenAudience) &&
        (!authorizedParty || !allowedAudiences.includes(authorizedParty)))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google token audience",
      });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: tokenAudience,
    });
 
    const payload = ticket.getPayload();
    const { email, name } = payload;
 
    let user = await User.findOne({ email });
 
    if (!user) {
      user = await User.create({
        fullName: name,
        email,
        password: "google_oauth_user",
        role: "regular",
        isActive: true,
      });
    }
 
    const token = generateToken(user._id, user.role);
 
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
    console.log("GOOGLE LOGIN ERROR:", err);
    return res.status(401).json({
      success: false,
      message: "Invalid Google token",
    });
  }
});
 
/**
 * POST /api/auth/register
 * POST /api/auth/signup
 */
router.post(["/register", "/signup"], async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
 
    const roleRaw = req.body.role;
    const roleNormalized = (roleRaw || "regular").toLowerCase();
 
    const roleMap = {
      user: "regular",
      staff: "employee",
      employee: "employee",
      manager: "manager",
    };
 
    const finalRole = roleMap[roleNormalized] || "regular";
 
    console.log("REGISTER BODY:", req.body);
    console.log("ROLE RAW:", roleRaw);
    console.log("ROLE:", finalRole);
    console.log("INVITE CODE RECEIVED:", req.body.inviteCode);
 
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }
 
    let organizationId = null;
    let inviteCode = "";
 
    if (finalRole === "employee") {
      inviteCode = (req.body.inviteCode || "").trim();
 
      if (!inviteCode) {
        return res.status(422).json({
          success: false,
          message: "Invalid or expired invite code",
        });
      }
 
      const invite = await Invite.findOne({
        code: inviteCode,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });
 
      console.log("FOUND INVITE:", invite);
 
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
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }
 
    const user = await User.create({
      fullName,
      email,
      password,
      role: finalRole,
      organizationId,
      isActive: true,
      twoFactorEnabled: false,
    });
 
    console.log("USER CREATED SUCCESSFULLY:", {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
 
    if (finalRole === "employee") {
      await Invite.updateOne(
        { code: inviteCode },
        { status: "accepted", usedBy: user._id }
      );
 
      console.log("INVITE UPDATED TO ACCEPTED:", inviteCode);
    }
 
    const token = generateToken(user._id, user.role);
 
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
/**
 * GET /api/auth/users
 * Manager only
 */
router.get("/users", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Only managers can view all users",
      });
    }
 
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });
 
    return res.json({
      success: true,
      count: users.length,
      users: users.map((user) => ({
        id: user._id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled || false,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
module.exports = router;
 

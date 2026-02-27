const express = require("express");
const crypto = require("crypto");
const Organization = require("../models/Organization");
const Invite = require("../models/Invite");
const { protect } = require("../middleware/auth"); // use your existing protect
const User = require("../models/User");
 
const router = express.Router();
 router.use(protect); // all routes require auth
// helper: allow only manager
const requireManager = (req, res, next) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ success: false, message: "Forbidden: manager only" });
  }
  next();
};
 
// 1) Create organization (manager)
// rotect);
 
router.post("/", requireManager, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Organization name is required" });
    }
 
    const org = await Organization.create({
      name,
      createdBy: req.user._id,
    });
 
    // ✅ attach org to manager
    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { organizationId: org._id } },
      { new: true }
    );
 
    return res.json({
      success: true,
      organization: { id: org._id, name: org.name },
    });
  } catch (err) {
    console.log("CREATE ORG ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
 




// 2) Create invite code (manager)
router.post("/invites", protect, requireManager, async (req, res) => {
  console.log("INVITE REQ USER:", req.user._id, req.user.email, req.user.organizationId);
  const { expiresInHours = 48 } = req.body;
 
  if (!req.user.organizationId) {
    return res.status(422).json({ success: false, message: "Manager has no organization yet" });
  }
 
  const code = crypto.randomBytes(4).toString("hex"); // e.g. "a1b2c3d4"
  const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);
 
  const invite = await Invite.create({
    code,
    organizationId: req.user.organizationId,
    role: "employee",
    expiresAt,
  });
 
  res.json({
    success: true,
    invite: {
      code: invite.code,
      organizationId: invite.organizationId,
      expiresAt: invite.expiresAt,
      status: invite.status,
    },
  });
});
 
module.exports = router;
 
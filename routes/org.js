const express = require("express");
const Organization = require("../models/Organization");
const Invite = require("../models/Invite");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const { sendInviteEmail } = require("../utils/emailService");
 
const router = express.Router();
 
/**
 * PUBLIC: Validate invite code before employee registers
 * GET /api/org/invite/:code
 */
router.get("/invite/:code", async (req, res) => {
  try {
    const inviteCode = (req.params.code || "").trim();
 
    console.log("REQ GET /api/org/invite/:code");
    console.log("INVITE CODE PARAM:", inviteCode);
 
    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: "Invite code is required",
      });
    }
 
    const invite = await Invite.findOne({
      code: inviteCode,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
 
    console.log("PUBLIC INVITE CHECK FOUND:", invite);
 
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired invite code",
      });
    }
 
    const organization = await Organization.findById(invite.organizationId).select("name");
 
    return res.status(200).json({
      success: true,
      invite: {
        code: invite.code,
        organizationId: invite.organizationId,
        organizationName: organization?.name || "",
        role: invite.role,
        expiresAt: invite.expiresAt,
        status: invite.status,
        email: invite.email,
      },
    });
  } catch (err) {
    console.log("PUBLIC INVITE CHECK ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
/**
 * Everything below requires login
 */
router.use(protect);
 
/**
 * Helper: allow only manager
 */
const requireManager = (req, res, next) => {
  console.log("REQ USER ROLE:", req.user.role);
  console.log("REQ USER:", req.user);
 
  if (req.user.role !== "manager") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: manager only",
    });
  }
  next();
};
 
/**
 * Get organization members
 * GET /api/org/members
 */
router.get("/members", async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(200).json({
        success: true,
        members: [],
      });
    }
 
    const members = await User.find({
      organizationId: req.user.organizationId,
      isActive: true,
    }).select("_id fullName email role organizationId");
 
    return res.status(200).json({
      success: true,
      members: members.map((user) => ({
        id: user._id,
        _id: user._id,
        fullName: user.fullName || "",
        name: user.fullName || "",
        email: user.email || "",
        role: user.role || "regular",
        organizationId: user.organizationId || null,
      })),
    });
  } catch (err) {
    console.log("GET ORG MEMBERS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching organization members",
    });
  }
});
 
/**
 * Create organization (manager)
 * POST /api/org
 */
router.post("/", requireManager, async (req, res) => {
  try {
    const { name } = req.body;
 
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Organization name is required",
      });
    }
 
    if (req.user.organizationId) {
      const existingOrg = await Organization.findById(req.user.organizationId).select("name");
      return res.status(200).json({
        success: true,
        message: "Manager already has an organization",
        organization: {
          id: existingOrg?._id || req.user.organizationId,
          name: existingOrg?.name || "",
        },
      });
    }
 
    const org = await Organization.create({
      name: name.trim(),
      createdBy: req.user._id,
    });
 
    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { organizationId: org._id } },
      { new: true }
    );
 
    return res.status(200).json({
      success: true,
      organization: {
        id: org._id,
        name: org.name,
      },
    });
  } catch (err) {
    console.log("CREATE ORG ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
/**
 * Employee joins organization using invite code
 * This is only for an already logged-in user
 * POST /api/org/join
 */
router.post("/join", async (req, res) => {
  try {
    const inviteCode = (req.body.inviteCode || "").trim();
 
    console.log("JOIN BODY:", req.body);
    console.log("JOIN INVITE CODE:", inviteCode);
 
    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: "Invite code is required",
      });
    }
 
    const invite = await Invite.findOne({ code: inviteCode });
 
    console.log("JOIN FOUND INVITE:", invite);
 
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }
 
    if (invite.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Invite already used",
      });
    }
 
    if (new Date(invite.expiresAt) < new Date()) {
      invite.status = "expired";
      await invite.save();
 
      return res.status(400).json({
        success: false,
        message: "Invite expired",
      });
    }
 
    const user = await User.findById(req.user._id);
 
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
 
    if (invite.email && invite.email !== user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "This invite code does not belong to this email",
      });
    }
 
    user.organizationId = invite.organizationId;
    user.role = "employee";
    await user.save();
 
    invite.status = "accepted";
    invite.usedBy = user._id;
    await invite.save();
 
    await Notification.updateMany(
      {
        email: user.email.toLowerCase(),
        inviteCode: invite.code,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );
 
    const organization = await Organization.findById(user.organizationId).select("name");
 
    return res.status(200).json({
      success: true,
      message: "Successfully joined organisation",
      organization: {
        id: organization?._id,
        name: organization?.name || "",
      },
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    console.log("JOIN ORG ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});
 
 
/**
 * Create invite code (manager)
 * POST /api/org/invites
 */
router.post("/invites", requireManager, async (req, res) => {
  try {
    console.log(
      "INVITE REQ USER:",
      req.user._id,
      req.user.email,
      req.user.organizationId
    );
 
    const { email, expiresInHours = 48 } = req.body;
 
    if (!req.user.organizationId) {
      return res.status(422).json({
        success: false,
        message: "Manager has no organization yet",
      });
    }
 
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Employee email is required",
      });
    }
 
    const normalizedEmail = email.trim().toLowerCase();
 
    let code;
    let exists = true;
 
    while (exists) {
      code = `EQT-INV-${Math.floor(1000 + Math.random() * 9000)}`;
      exists = await Invite.findOne({ code });
    }
 
    const expiresAt = new Date(
      Date.now() + Number(expiresInHours) * 60 * 60 * 1000
    );
 
    const invite = await Invite.create({
      code,
      organizationId: req.user.organizationId,
      role: "employee",
      email: normalizedEmail,
      expiresAt,
    });
 
    const organization = await Organization.findById(req.user.organizationId).select("name");
 
    await Notification.create({
      email: normalizedEmail,
      title: "Organization Invite",
      message: `You have been invited to join ${organization?.name || "an organization"}.`,
      type: "organization_invite",
      inviteCode: invite.code,
      organizationId: invite.organizationId,
      isRead: false,
    });

    const emailResult = await sendInviteEmail(
normalizedEmail,
invite.code,
organization?.name || "an organization",
invite.expiresAt
);
 
if (!emailResult.success) {
console.log("INVITE EMAIL ERROR:", emailResult.error);
} else {
console.log("INVITE EMAIL SENT TO:", normalizedEmail);
}
 
 
    const subject = "You’ve been invited to join EquiTask";
 
    const text = `
Hello,
 
You have been invited to join ${organization?.name || "an organization"} on EquiTask.
 
Your invite code: ${invite.code}
 
This code expires on: ${invite.expiresAt}
 
If you were not expecting this invite, please ignore this email.
    `.trim();
 
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>You’ve been invited to join EquiTask</h2>
        <p>Hello,</p>
        <p>You have been invited to join <strong>${organization?.name || "an organization"}</strong>.</p>
        <p><strong>Invite code:</strong> ${invite.code}</p>
        <p><strong>Expires on:</strong> ${invite.expiresAt}</p>
        <p>If you were not expecting this invite, please ignore this email.</p>
      </div>
    `;
 
    try {
      await sendEmail({
        to: normalizedEmail,
        subject,
        text,
        html,
      });
      console.log("INVITE EMAIL SENT TO:", normalizedEmail);
    } catch (emailError) {
      console.log("INVITE EMAIL ERROR:", emailError);
    }
 
    console.log("INVITE CREATED:", invite);
 
    return res.status(200).json({
      success: true,
      message: "Invite created successfully",
      invite: {
        code: invite.code,
        organizationId: invite.organizationId,
        organizationName: organization?.name || "",
        expiresAt: invite.expiresAt,
        status: invite.status,
        email: invite.email,
      },
    });
  } catch (err) {
    console.log("CREATE INVITE ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
module.exports = router;
 
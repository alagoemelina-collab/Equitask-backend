const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
 
// GET /api/notifications
router.get("/", protect, async (req, res) => {
  const list = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
 
  res.json({ success: true, count: list.length, notifications: list });
});
 
// PATCH /api/notifications/:id/read
router.patch("/:id/read", protect, async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
 
  n.isRead = true;
  await n.save();
 
  res.json({ success: true, notification: n });
});
 
module.exports = router;
 
const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
 
// GET /api/notifications
router.get("/", protect, async (req, res) => {
  try {
    const list = await Notification.find({
      $or: [
        { user: req.user._id },
        { email: req.user.email.toLowerCase() },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);
 
    return res.status(200).json({
      success: true,
      count: list.length,
      notifications: list,
    });
  } catch (err) {
    console.log("GET NOTIFICATIONS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
// PATCH /api/notifications/:id/read
router.patch("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      $or: [
        { user: req.user._id },
        { email: req.user.email.toLowerCase() },
      ],
    });
 
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }
 
    notification.isRead = true;
    await notification.save();
 
    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (err) {
    console.log("MARK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
module.exports = router;
 
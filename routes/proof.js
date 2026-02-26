const express = require("express");
const router = express.Router();
const multer = require("multer");
const mime = require("mime-types");
 
const Task = require("../models/Tasks");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { allowRoles } = require("../middleware/rbac");

const fs = require("fs");
const path = require("path");
 
const uploadDir = path.join(__dirname, "..", "uploads");
 
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
 
// -------- Multer config (10MB, images/audio only) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype) || "bin";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`);
  },
});
 
const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "audio/mpeg", "audio/wav"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only JPEG/PNG/MP3/WAV allowed"));
  cb(null, true);
};
 
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
 
// ---------------- Helpers ----------------
const canAccessTask = (user, task) => {
  if (user.role === "manager") return true;
  const isCreator = task.createdBy?.toString() === user._id.toString();
  const isAssignee = task.assignedTo?.toString() === user._id.toString();
  return isCreator || isAssignee;
};
 
// ---------------- Routes -----------------
 
// POST /api/proof/:taskId/text  (submit text proof)
router.post("/:taskId/text", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "text is required" });
 
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
 
    if (!canAccessTask(req.user, task)) {
      return res.status(403).json({ success: false, message: "Not authorized for this task" });
    }
 
    // lock rule: cannot edit proof unless rejected
    if (task.proof?.submittedAt && task.status !== "rejected") {
      return res.status(400).json({ success: false, message: "Proof already submitted. Wait for review or rejection." });
    }
 
    task.proof = {
      proofType: "text",
      text,
      submittedAt: new Date(),
      submittedBy: req.user._id,
    };
 
    task.status = "awaiting_verification";
    task.managerReview = undefined;
 
    await task.save();

    await Notification.create({
  user: task.assignedTo, // or task.user / task.createdBy depending on your schema
  title: "Proof submitted",
  message: "A user submitted proof for a task",
  type: "proof_submitted",
});
 
 
    // Notify manager(s) – for demo: notify creator if creator is manager
    if (task.createdBy) {
      await Notification.create({
        user: task.createdBy,
        type: "proof_submitted",
        title: "Proof submitted",
        message: "A proof was submitted for a task and is awaiting verification.",
        task: task._id,
      });
    }
 
    res.status(201).json({ success: true, message: "Text proof submitted", task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/proof/:taskId/file  (submit image/audio proof)
router.post("/:taskId/file", protect, upload.single("file"), async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
 
    if (!canAccessTask(req.user, task)) {
      return res.status(403).json({ success: false, message: "Not authorized for this task" });
    }
 
    if (task.proof?.submittedAt && task.status !== "rejected") {
      return res.status(400).json({ success: false, message: "Proof already submitted. Wait for review or rejection." });
    }
 
    if (!req.file) return res.status(400).json({ success: false, message: "file is required" });
 
    const proofType = req.file.mimetype.startsWith("image/") ? "image" : "audio";
 
    task.proof = {
      proofType,
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      submittedAt: new Date(),
      submittedBy: req.user._id,
    };
 
    task.status = "awaiting_verification";
    task.managerReview = undefined;
 
    await task.save();
 
    if (task.createdBy) {
      await Notification.create({
        user: task.createdBy,
        type: "proof_submitted",
        title: "Proof submitted",
        message: "A proof was submitted for a task and is awaiting verification.",
        task: task._id,
      });
    }
 
    res.status(201).json({ success: true, message: "File proof submitted", task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/proof/pending (manager sees awaiting_verification tasks)
router.get("/pending", protect, allowRoles("manager"), async (req, res) => {
  try {
    const pending = await Task.find({ status: "awaiting_verification" })
      .sort({ updatedAt: -1 })
      .populate("assignedTo", "email role")
      .populate("createdBy", "email role");
 
    res.json({ success: true, count: pending.length, pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/proof/:taskId/review  (manager approve/reject)
router.post("/:taskId/review", protect, allowRoles("manager"), async (req, res) => {
  try {
    const { decision, comment } = req.body; // decision: "approved" | "rejected"
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be approved or rejected" });
    }
 
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
 
    if (task.status !== "awaiting_verification") {
      return res.status(400).json({ success: false, message: "Task is not awaiting verification" });
    }
 
    task.managerReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      decision,
      comment: comment || "",
    };
 
    if (decision === "approved") {
      task.status = "verified";
      // notify submitter
      if (task.proof?.submittedBy) {
        await Notification.create({
          user: task.proof.submittedBy,
          type: "proof_approved",
          title: "Proof approved",
          message: "Your proof was approved. Task is now Verified.",
          task: task._id,
        });
      }
    } else {
      task.status = "rejected"; // user can resubmit now
      if (task.proof?.submittedBy) {
        await Notification.create({
          user: task.proof.submittedBy,
          type: "proof_rejected",
          title: "Proof rejected",
          message: `Your proof was rejected. ${comment ? "Feedback: " + comment : ""}`,
          task: task._id,
        });
      }
    }
 
    await task.save();
 
    res.json({ success: true, message: `Task ${decision}`, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
 
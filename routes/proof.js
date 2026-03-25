const express = require("express");
const router = express.Router();
const multer = require("multer");
const streamifier = require("streamifier");
 
const Task = require("../models/Tasks");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { allowRoles } = require("../middleware/rbac");
const cloudinary = require("../config/cloudinary");
 
// -------- Multer config (20MB, memory storage, common mobile images/audio) ----------
const storage = multer.memoryStorage();
 
const fileFilter = (req, file, cb) => {
  console.log("PROOF FILE MIME:", file.mimetype);
  console.log("PROOF FILE NAME:", file.originalname);
 
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "application/octet-stream",
  ];
 
  const lowerName = (file.originalname || "").toLowerCase();
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".heif",
    ".mp3",
    ".wav",
    ".webm",
    ".mp4",
    ".m4a",
  ];
 
  const hasAllowedExtension = allowedExtensions.some((ext) =>
    lowerName.endsWith(ext)
  );
 
  if (allowedMimeTypes.includes(file.mimetype) || hasAllowedExtension) {
    return cb(null, true);
  }
 
  return cb(
    new Error("Only JPG, PNG, HEIC, HEIF, MP3, WAV, WEBM, MP4, M4A allowed")
  );
};
 
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
 
// ---------------- Helpers ----------------
const canAccessTask = (user, task) => {
  if (user.role === "manager") return true;
  const isCreator = task.createdBy?.toString() === user._id.toString();
  const isAssignee = task.assignedTo?.toString() === user._id.toString();
  return isCreator || isAssignee;
};
 
const uploadBufferToCloudinary = (fileBuffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
 
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
 
// ---------------- Routes -----------------
 
// POST /api/proof/:taskId/text
router.post("/:taskId/text", protect, async (req, res) => {
  try {
    const { text } = req.body;
 
    if (!text) {
      return res.status(400).json({ success: false, message: "text is required" });
    }
 
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
 
    if (!canAccessTask(req.user, task)) {
      return res.status(403).json({ success: false, message: "Not authorized for this task" });
    }
 
    if (task.proof?.submittedAt && task.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Proof already submitted. Wait for review or rejection.",
      });
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
      user: task.assignedTo,
      title: "Proof submitted",
      message: "A user submitted proof for a task",
      type: "proof_submitted",
    });
 
    if (task.createdBy) {
      await Notification.create({
        user: task.createdBy,
        type: "proof_submitted",
        title: "Proof submitted",
        message: "A proof was submitted for a task and is awaiting verification.",
        task: task._id,
      });
    }
 
    return res.status(201).json({
      success: true,
      message: "Text proof submitted",
      task,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/proof/:taskId/file
router.post(
  "/:taskId/file",
  protect,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.log("UPLOAD ERROR:", err);
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed",
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log("TASK ID PARAM:", req.params.taskId);
 
      const task = await Task.findById(req.params.taskId);
      console.log("FOUND TASK:", task);
 
      if (!task) {
        return res.status(404).json({ success: false, message: "Task not found" });
      }
 
      if (!canAccessTask(req.user, task)) {
        return res.status(403).json({ success: false, message: "Not authorized for this task" });
      }
 
      if (task.proof?.submittedAt && task.status !== "rejected") {
        return res.status(400).json({
          success: false,
          message: "Proof already submitted. Wait for review or rejection.",
        });
      }
 
      if (!req.file) {
        return res.status(400).json({ success: false, message: "file is required" });
      }
 
      const lowerName = (req.file.originalname || "").toLowerCase();
      const isImage =
        req.file.mimetype.startsWith("image/") ||
        /\.(jpg|jpeg|png|heic|heif)$/i.test(lowerName);
 
      const resourceType = isImage ? "image" : "video";
      const folder = isImage ? "equitask/proof/images" : "equitask/proof/audio";
 
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
        folder,
        resource_type: resourceType,
        public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      });
 
      task.proof = {
        proofType: isImage ? "image" : "audio",
        fileUrl: uploaded.secure_url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        cloudinaryPublicId: uploaded.public_id,
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
 
      return res.status(201).json({
        success: true,
        message: "File proof submitted",
        task,
      });
    } catch (err) {
      console.log("PROOF SUBMIT ERROR:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// GET /api/proof/pending
router.get("/pending", protect, allowRoles("manager"), async (req, res) => {
  try {
    const pending = await Task.find({ status: "awaiting_verification" })
      .sort({ updatedAt: -1 })
      .populate("assignedTo", "email role")
      .populate("createdBy", "email role");
 
    return res.json({ success: true, count: pending.length, pending });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/proof/:taskId/review
router.post("/:taskId/review", protect, allowRoles("manager"), async (req, res) => {
  try {
    const { decision, comment } = req.body;
 
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "decision must be approved or rejected",
      });
    }
 
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
 
    if (task.status !== "awaiting_verification") {
      return res.status(400).json({
        success: false,
        message: "Task is not awaiting verification",
      });
    }
 
    task.managerReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      decision,
      comment: comment || "",
    };
 
    if (decision === "approved") {
      task.status = "verified";
 
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
      task.status = "rejected";
 
      if (task.proof?.submittedBy) {
        await Notification.create({
          user: task.proof.submittedBy,
          type: "proof_rejected",
          title: "Proof rejected",
          message: `Your proof was rejected.${comment ? " Feedback: " + comment : ""}`,
          task: task._id,
        });
      }
    }
 
    await task.save();
 
    return res.json({ success: true, message: `Task ${decision}`, task });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
 
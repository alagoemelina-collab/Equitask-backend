const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const Task = require("../models/Tasks");
 
const router = express.Router();
 
router.use(protect);
 
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
 
// POST /api/ai/simplify-task
router.post("/simplify-task", async (req, res) => {
  try {
    const { taskDescription, taskId, taskType, accessibilityMode } = req.body;
    const hasValidTaskId = Boolean(taskId) && mongoose.Types.ObjectId.isValid(taskId);
 
    if (!taskDescription || !taskDescription.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task description is required"
      });
    }
 
    const pythonResponse = await axios.post(`${AI_SERVICE_URL}/ai/task-simplify`, {
      task_id: hasValidTaskId ? taskId : "task-001",
      task_text: taskDescription,
      task_type: taskType || "Unknown",
      accessibility_mode: accessibilityMode || "Standard"
    });
 
    const aiData = pythonResponse.data;
 
    // save simplified steps into task if taskId exists
    if (hasValidTaskId) {
      const task = await Task.findById(taskId);
 
      if (task) {
        const hasAccess =
          req.user.role === "manager" ||
          (task.assignedTo && task.assignedTo.toString() === req.user._id.toString()) ||
          (task.createdBy && task.createdBy.toString() === req.user._id.toString());
 
        if (hasAccess) {
          task.simplifiedSteps = (aiData.simplified_steps || []).map((step) => ({
            stepNumber: step.step_number,
            stepDescription: step.instruction,
            isCompleted: false
          }));
 
          await task.save();
        }
      }
    }
 
    return res.json({
      success: true,
      originalTask: taskDescription,
      status: aiData.status,
      confidenceScore: aiData.confidence_score,
      simplifiedSteps: (aiData.simplified_steps || []).map((step) => ({
        stepNumber: step.step_number,
        stepDescription: step.instruction,
        isCompleted: false
      })),
      fallback: aiData.fallback,
      telemetry: aiData.telemetry
    });
  } catch (error) {
    console.error("Python AI proxy error:", error.response?.data || error.message);
 
    return res.status(500).json({
      success: false,
      message: "Failed to connect to AI service",
      error: error.response?.data || error.message
    });
  }
});
 
// optional health check
router.get("/status", async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/docs`);
    return res.json({
      success: true,
      message: "Python AI service is reachable"
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Python AI service not reachable"
    });
  }
});
 
module.exports = router;
 

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
    console.log("SIMPLIFY ROUTE HIT");
    console.log("SIMPLIFY BODY:", req.body);
    console.log("AI_SERVICE_URL:", AI_SERVICE_URL);
 
    const { taskDescription, taskId, taskType, accessibilityMode } = req.body;
    const hasValidTaskId =
      Boolean(taskId) && mongoose.Types.ObjectId.isValid(taskId);
 
    if (!taskDescription || !taskDescription.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task description is required",
      });
    }
 
    const pythonPayload = {
      task_id: hasValidTaskId ? taskId : "task-001",
      task_text: taskDescription,
      task_type: taskType || "reporting",
      accessibility_mode: accessibilityMode || "Standard",
    };
 
    console.log("PYTHON PAYLOAD:", pythonPayload);
    console.log("BEFORE PYTHON CALL");
 
    const pythonResponse = await axios.post(
      `${AI_SERVICE_URL}/ai/task-simplify`,
      pythonPayload,
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
 
    console.log("AFTER PYTHON CALL");
    console.log("PYTHON RESPONSE DATA:", pythonResponse.data);
 
    const aiData = pythonResponse.data;
 
    const rawSteps =
      aiData.simplified_steps && aiData.simplified_steps.length > 0
        ? aiData.simplified_steps
        : aiData.fallback?.template_steps || [];
 
    const normalizedStepObjects = rawSteps.map((step, index) => ({
      stepNumber: step.step_number || index + 1,
      stepDescription: step.instruction || "",
      isCompleted: false,
    }));
 
    const simplifiedStepStrings = normalizedStepObjects.map(
      (step) => step.stepDescription
    );
 
    // Save structured steps into task if taskId exists
    if (hasValidTaskId) {
      const task = await Task.findById(taskId);
 
      if (task) {
        const hasAccess =
          req.user.role === "manager" ||
          (task.assignedTo &&
            task.assignedTo.toString() === req.user._id.toString()) ||
          (task.createdBy &&
            task.createdBy.toString() === req.user._id.toString());
 
        if (hasAccess) {
          task.simplifiedSteps = normalizedStepObjects;
          await task.save();
        }
      }
    }
 
    return res.status(200).json({
      success: true,
      originalTask: taskDescription,
      status: aiData.status,
      confidenceScore: aiData.confidence_score || 0,
 
      // this is what the APK should use
      simplifiedSteps: simplifiedStepStrings,
 
      // keep structured version too
      simplifiedStepObjects: normalizedStepObjects,
 
      fallback: aiData.fallback || null,
      telemetry: aiData.telemetry || {},
    });
  } catch (error) {
    console.error("PYTHON AI PROXY ERROR:", error.code || error.message);
    console.error(
      "PYTHON AI PROXY ERROR DETAILS:",
      error.response?.data || error.message
    );
 
    if (error.code === "ECONNABORTED") {
      return res.status(504).json({
        success: false,
        message: "AI service timed out",
      });
    }
 
    return res.status(500).json({
      success: false,
      message: "Failed to connect to AI service",
      error: error.response?.data || error.message,
    });
  }
});
 
// GET /api/ai/status
router.get("/status", async (req, res) => {
  try {
    await axios.get(`${AI_SERVICE_URL}/docs`, { timeout: 5000 });
 
    return res.status(200).json({
      success: true,
      message: "Python AI service is reachable",
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Python AI service not reachable",
      error: error.message,
    });
  }
});
 
module.exports = router;
 
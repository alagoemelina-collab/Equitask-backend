const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const Task = require("../models/Tasks");
 
const router = express.Router();
 
router.use(protect);
 
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
 
function genericTemplate(taskType = "general") {
  const type = String(taskType || "general").toLowerCase();
 
  if (type === "reporting") {
    return [
      "Gather the needed information.",
      "List the main points to include.",
      "Write the first draft.",
      "Review the report for clarity.",
      "Correct mistakes and finalize it.",
    ];
  }
 
  if (type === "technical") {
    return [
      "Describe the issue clearly.",
      "Check the recent changes.",
      "Try the simplest fix first.",
      "Test the result.",
      "Record what was done.",
    ];
  }
 
  return [
    "Understand the task clearly.",
    "List what is needed.",
    "Do the first small step.",
    "Check progress.",
    "Finish and confirm completion.",
  ];
}
 
function buildTemplateResponse(taskDescription, taskType) {
  const templateSteps = genericTemplate(taskType);
 
  const simplifiedStepObjects = templateSteps.map((step, index) => ({
    stepNumber: index + 1,
    stepDescription: step,
    isCompleted: false,
  }));
 
  return {
    success: true,
    originalTask: taskDescription,
    status: "TEMPLATE",
    confidenceScore: 0,
    simplifiedSteps: templateSteps,
    simplifiedStepObjects,
    fallback: {
      type: "TEMPLATE",
      message: "AI timed out, so a starter checklist was used.",
      templateSteps: simplifiedStepObjects.map((step) => ({
        step_number: step.stepNumber,
        instruction: step.stepDescription,
      })),
    },
    telemetry: {
      provider: "fallback",
      reason: "timeout_or_ai_unavailable",
    },
  };
}
 
router.post("/simplify-task", async (req, res) => {
  try {
    console.log("SIMPLIFY ROUTE HIT");
    console.log("SIMPLIFY BODY:", req.body);
 
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
 
    console.log("AI_SERVICE_URL:", AI_SERVICE_URL);
    console.log("PYTHON PAYLOAD:", pythonPayload);
    console.log("BEFORE PYTHON CALL");
 
    let aiData;
 
    try {
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
 
      aiData = pythonResponse.data;
      console.log("PYTHON RESPONSE:", aiData);
    } catch (error) {
      console.log("PYTHON AI PROXY ERROR:", error.code || error.message);
      console.log(
        "PYTHON AI PROXY ERROR DETAILS:",
        error.response?.data || error.message
      );
 
      const fallbackResponse = buildTemplateResponse(
        taskDescription,
        taskType || "reporting"
      );
 
      return res.status(200).json(fallbackResponse);
    }
 
    if (
      aiData.status !== "ACCEPT" ||
      !Array.isArray(aiData.simplified_steps) ||
      aiData.simplified_steps.length === 0
    ) {
      console.log("AI DID NOT RETURN ACCEPT. USING TEMPLATE FALLBACK.");
 
      const fallbackResponse = buildTemplateResponse(
        taskDescription,
        taskType || "reporting"
      );
 
      return res.status(200).json(fallbackResponse);
    }
 
    const normalizedStepObjects = aiData.simplified_steps.map((step, index) => ({
      stepNumber: step.step_number || index + 1,
      stepDescription: step.instruction || "",
      isCompleted: false,
    }));
 
    const simplifiedStepStrings = normalizedStepObjects.map(
      (step) => step.stepDescription
    );
 
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
      simplifiedSteps: simplifiedStepStrings,
      simplifiedStepObjects: normalizedStepObjects,
      fallback: aiData.fallback || {
        type: "NONE",
        message: "",
        templateSteps: [],
      },
      telemetry: aiData.telemetry || {},
    });
  } catch (error) {
    console.error("SIMPLIFY TASK ERROR:", error);
 
    const fallbackResponse = buildTemplateResponse(
      req.body?.taskDescription || "",
      req.body?.taskType || "reporting"
    );
 
    return res.status(200).json(fallbackResponse);
  }
});
 
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
 
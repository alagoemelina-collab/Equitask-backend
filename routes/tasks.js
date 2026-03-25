const express = require("express");
const router = express.Router();
const Task = require("../models/Tasks");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
 
router.use(protect);
 
// shared create handler
const createTaskHandler = async (req, res) => {
  try {
    console.log("CREATE TASK BODY:", req.body);
 
    const rawTitle = req.body.title || req.body.name || "";
    const description = req.body.description || "";
    const rawAssignedTo =
      req.body.assignedTo || req.body.assigned_to || req.body.assignee || null;
    const dueDate = req.body.dueDate || req.body.due_date || null;
    const priority =
      req.body.priority || req.body.priorityLevel || req.body.level || "medium";
    const category = req.body.category || "general";
    const urgencyColor = req.body.urgencyColor || "yellow";
    const rawStatus = req.body.status || "";
    const simplifiedSteps = Array.isArray(req.body.simplifiedSteps)
      ? req.body.simplifiedSteps
      : [];
 
    if (!rawTitle || !rawTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }
 
    if (!req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: "Not part of an organization",
      });
    }
 
    let finalAssignedTo = req.user._id;
 
    if (req.user.role === "manager") {
      finalAssignedTo = rawAssignedTo || null;
    }
 
    if (finalAssignedTo) {
      const assignedUser = await User.findById(finalAssignedTo);
      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          message: "Assigned user not found",
        });
      }
    }
 
    const incomingStatus = String(rawStatus).trim().toLowerCase();
 
    let normalizedStatus = "not_started";
 
    if (
      incomingStatus === "pending" ||
      incomingStatus === "not started" ||
      incomingStatus === "not_started"
    ) {
      normalizedStatus = "not_started";
    } else if (
      incomingStatus === "in progress" ||
      incomingStatus === "in_progress" ||
      incomingStatus === "inprogress"
    ) {
      normalizedStatus = "in_progress";
    } else if (
      incomingStatus === "completed" ||
      incomingStatus === "complete" ||
      incomingStatus === "done"
    ) {
      normalizedStatus = "completed";
    } else if (incomingStatus === "overdue") {
      normalizedStatus = "overdue";
    } else if (
      incomingStatus === "awaiting verification" ||
      incomingStatus === "awaiting_verification"
    ) {
      normalizedStatus = "awaiting_verification";
    } else if (incomingStatus === "verified") {
      normalizedStatus = "verified";
    } else if (incomingStatus === "rejected") {
      normalizedStatus = "rejected";
    }
 
    const task = await Task.create({
      title: rawTitle.trim(),
      description,
      assignedTo: finalAssignedTo,
      createdBy: req.user._id,
      dueDate,
      priority,
      category,
      urgencyColor,
      status: normalizedStatus,
      organizationId: req.user.organizationId,
      simplifiedSteps,
    });
 
    const responseTask = {
      _id: task._id.toString(),
      id: task._id.toString(),
      title: task.title,
      name: task.title,
      description: task.description || "",
      dueDate: task.dueDate || null,
      due_date: task.dueDate || null,
      priority: task.priority || "medium",
      priorityLevel: task.priority || "medium",
      level: task.priority || "medium",
      category: task.category || "general",
      urgencyColor: task.urgencyColor || "yellow",
      status: task.status,
      statusLabel:
        task.status === "not_started"
          ? "Pending"
          : task.status === "in_progress"
          ? "In Progress"
          : task.status === "awaiting_verification"
          ? "Awaiting Verification"
          : task.status === "completed"
          ? "Completed"
          : task.status === "overdue"
          ? "Overdue"
          : task.status === "verified"
          ? "Verified"
          : task.status === "rejected"
          ? "Rejected"
          : task.status,
      assignedTo: finalAssignedTo ? finalAssignedTo.toString() : null,
      assigned_to: finalAssignedTo ? finalAssignedTo.toString() : null,
      assignee: finalAssignedTo ? finalAssignedTo.toString() : null,
      createdBy: req.user._id.toString(),
      organizationId: req.user.organizationId
        ? req.user.organizationId.toString()
        : null,
      simplifiedSteps: task.simplifiedSteps || [],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
 
    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task: responseTask,
      data: responseTask,
      taskId: responseTask._id,
      id: responseTask._id,
    });
  } catch (error) {
    console.error("Create Task Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating task",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
 
 
 
 
 
// support multiple APK route variants
router.post("/", createTaskHandler);
router.post("/create", protect, createTaskHandler);
 
// GET all tasks
router.get("/", async (req, res) => {
  try {
    let filter = { organizationId: req.user.organizationId };
 
    if (req.user.role === "manager") {
      filter = { organizationId: req.user.organizationId };
    } else if (req.user.role === "employee") {
      filter = {
        organizationId: req.user.organizationId,
        assignedTo: req.user._id,
      };
    } else {
      filter = {
        organizationId: req.user.organizationId,
        createdBy: req.user._id,
      };
    }
 
    const tasks = await Task.find(filter)
      .populate([
        { path: "assignedTo", select: "email role fullName" },
        { path: "createdBy", select: "email role fullName" },
      ])
      .sort({ createdAt: -1 });
 
    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Get Tasks Error:", error);
 
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
// GET single task
router.get("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
 
    const task = await Task.findOne({
      _id: taskId,
      organizationId: req.user.organizationId,
    })
      .populate("assignedTo", "email role fullName")
      .populate("createdBy", "email role fullName");
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
 
    const totalSteps = task.simplifiedSteps?.length || 0;
    const completedSteps = (task.simplifiedSteps || []).filter(
      (step) => step.isCompleted
    ).length;
 
    const progress =
      totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
 
    return res.json({
      success: true,
      task,
      progress,
    });
  } catch (error) {
    console.error("GET single task error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
// PATCH step completion
router.patch("/:taskId/steps/:stepNumber", async (req, res) => {
  try {
    const { taskId, stepNumber } = req.params;
    const { isCompleted } = req.body;
 
    const task = await Task.findOne({
      _id: taskId,
      organizationId: req.user.organizationId,
    });
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
 
    const step = task.simplifiedSteps.find(
      (s) => s.stepNumber === parseInt(stepNumber)
    );
 
    if (!step) {
      return res.status(404).json({
        success: false,
        message: "Step not found",
      });
    }
 
    step.isCompleted = isCompleted;
    await task.save();
 
    const totalSteps = task.simplifiedSteps.length;
    const completedSteps = task.simplifiedSteps.filter(
      (s) => s.isCompleted
    ).length;
 
    const progress =
      totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
 
    return res.json({
      success: true,
      task,
      progress,
    });
  } catch (error) {
    console.error("Patch Step Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
// UPDATE task
router.put("/:taskId", async (req, res) => {
  try {
    const { title, description, dueDate, urgencyColor, status, priority, category } =
      req.body;
 
    const task = await Task.findOne({
      _id: req.params.taskId,
      organizationId: req.user.organizationId,
    });
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
 
    if (title) task.title = title;
    if (description) task.description = description;
    if (dueDate) task.dueDate = dueDate;
    if (urgencyColor) task.urgencyColor = urgencyColor;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (category) task.category = category;
 
    await task.save();
 
    await task.populate([
      { path: "assignedTo", select: "email role fullName" },
      { path: "createdBy", select: "email role fullName" },
    ]);
 
    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update Task Error:", error);
 
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
// DELETE task
router.delete("/:taskId", authorize("manager"), async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      organizationId: req.user.organizationId,
    });
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
 
    await task.deleteOne();
 
    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      taskId: req.params.taskId,
    });
  } catch (error) {
    console.error("Delete Task Error:", error);
 
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
 
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
 
module.exports = router;
 
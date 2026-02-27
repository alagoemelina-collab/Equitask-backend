const express = require('express');
const router = express.Router();
const Task = require('../models/Tasks');
const { protect, authorize } = require('../middleware/auth');
 
router.use(protect);
 

router.post("/", async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, urgencyColor, status } = req.body;
 
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }
 
    // Must have org (especially for employee)
    if (!req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: "Not part of an organization",
      });
    }
 
    // Decide who task is assigned to:
    // - manager: can assign to anyone (if provided)
    // - employee/regular: assigned to self
    let finalAssignedTo = req.user._id;
 
    if (req.user.role === "manager") {
      finalAssignedTo = assignedTo || null; // manager can set or leave unassigned
    }
 
    const task = await Task.create({
      title: title.trim(),
      description,
      assignedTo: finalAssignedTo,
      createdBy: req.user._id,
      dueDate,
      urgencyColor: urgencyColor || "yellow",
      status,
      organizationId: req.user.organizationId, // IMPORTANT (org-scoped)
    });
 
    await task.populate([
      { path: "assignedTo", select: "email role" },
      { path: "createdBy", select: "email role" },
    ]);
 
    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
 
  } catch (error) {
    console.error("Create Task Error:", error);
 
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
 


router.get('/', async (req, res) => {
  try {
 
    let filter = {organizationId: req.user.organizationId}; // Base filter for org
 
    if (req.user.role === 'manager') {
      filter = {};
    } else if (req.user.role === 'employee') {
      filter = { assignedTo: req.user._id };
    } else {
      filter = { createdBy: req.user._id };
    }
 
    const tasks = await Task.find({organizationId: req.user.organizationId})
      .populate([
        { path: 'assignedTo', select: 'email role' },
        { path: 'createdBy', select: 'email role' }
      ])
      .sort({ createdAt: -1 });
 
    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
 
  } catch (error) {
    console.error('Get Tasks Error:', error);
 
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
 

// GET /api/tasks/:taskId  -> single task + progress
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
 
    const task = await Task.findOne({ _id: taskId, organizationId: req.user.organizationId })
      .populate('assignedTo', 'email role')
      .populate('createdBy', 'email role');
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
 
    const totalSteps = task.simplifiedSteps?.length || 0;
    const completedSteps = (task.simplifiedSteps || []).filter(
      step => step.isCompleted
    ).length;
 
    const progress =
      totalSteps === 0
        ? 0
        : Math.round((completedSteps / totalSteps) * 100);
 
    return res.json({
      success: true,
      task,
      progress
    });
 
  } catch (error) {
    console.error('GET single task error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
 

// PATCH - Mark step as completed
router.patch('/:taskId/steps/:stepNumber', async (req, res) => {
  try {
    const { taskId, stepNumber } = req.params;
    const { isCompleted } = req.body;
 
    const task = await Task.findOne({ _id: taskId, organizationId: req.user.organizationId });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
 
    const step = task.simplifiedSteps.find(
      s => s.stepNumber === parseInt(stepNumber)
    );
 
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }
 
    step.isCompleted = isCompleted;
    await task.save();

 
    // res.json({ success: true, task });
    // ✅ Calculate progress
const totalSteps = task.simplifiedSteps.length;
const completedSteps = task.simplifiedSteps.filter(
  s => s.isCompleted
).length;
 
const progress = totalSteps === 0
  ? 0
  : Math.round((completedSteps / totalSteps) * 100);
 
return res.json({
  success: true,
  task,
  progress
});
 
 
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
 
 


router.put('/:taskId', async (req, res) => {
  try {
 
    const { title, description, dueDate, urgencyColor, status } = req.body;
 
    const task = await Task.findById(req.params.id);
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
 
    // Update only fields that were sent
    if (title) task.title = title;
    if (description) task.description = description;
    if (dueDate) task.dueDate = dueDate;
    if (urgencyColor) task.urgencyColor = urgencyColor;
    if (status) task.status = status;
 
    await task.save();
 
    await task.populate([
      { path: 'assignedTo', select: 'email role' },
      { path: 'createdBy', select: 'email role' }
    ]);
 
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task
    });
 
  } catch (error) {
    console.error('Update Task Error:', error);
 
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// Bot Verification
 


 
router.delete('/:taskId', authorize('manager'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, organizationId: req.user.organizationId });
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
 
    await task.deleteOne();
 
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      taskId: req.params.id
    });
 
  } catch (error) {
    console.error('Delete Task Error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
 
module.exports = router;
// server-id.de
 
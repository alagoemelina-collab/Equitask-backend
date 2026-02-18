const express = require('express');
const router = express.Router();
const Task = require('../models/Tasks');
const { protect, authorize } = require('../middleware/auth');
 
router.use(protect);
 
router.post('/', async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, urgencyColor } = req.body;
 
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }
 
    let finalAssignedTo;
 
    if (req.user.role === 'manager') {
      finalAssignedTo = assignedTo || null;
    } else if (req.user.role === 'employee') {
      finalAssignedTo = req.user._id;
    } else {
      finalAssignedTo = req.user._id;
    }
 
    const task = await Task.create({
      title,
      description,
      assignedTo: finalAssignedTo,
      createdBy: req.user._id,
      dueDate,
      urgencyColor: urgencyColor || 'yellow'
    });
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
 
router.delete('/:id', authorize('manager'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
 
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
 
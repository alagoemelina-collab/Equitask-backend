const express = require('express');
const router = express.Router();
const FocusSession = require('../models/FocusSession');
const Task = require('../models/Tasks');
const { protect } = require('../middleware/auth');
 
router.use(protect);
 
// Start focus session
router.post('/start', async (req, res) => {
  try {
    const { taskId, duration } = req.body;
 
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }
 
    const task = await Task.findById(taskId);
 
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
 
    const session = await FocusSession.create({
      user: req.user._id,
      task: taskId,
      duration: duration || 25
    });
 
    res.status(201).json({
      success: true,
      message: 'Focus session started',
      session
    });
 
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start focus session'
    });
  }
});
 
// Complete focus session
router.put('/:id/complete', async (req, res) => {
  try {
    const session = await FocusSession.findById(req.params.id);
 
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
 
    session.completed = true;
    session.endTime = new Date();
    await session.save();
 
    res.json({
      success: true,
      message: 'Focus session completed',
      session
    });
 
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete session'
    });
  }
});
 
// Get user sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await FocusSession.find({ user: req.user._id })
      .populate('task', 'title status')
      .sort({ createdAt: -1 });
 
    res.json({
      success: true,
      count: sessions.length,
      sessions
    });
 
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
});
 
module.exports = router;
 
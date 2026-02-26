const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../middleware/auth');
const Task = require('../models/Tasks');
 
router.use(protect);
 
// --- Helpers ---
function localFallbackSteps(taskDescription) {
  // Simple deterministic fallback for demos when Gemini quota is exhausted
  const base = taskDescription.trim();
  const generic = [
    `Clarify the goal: what does “done” look like for "${base}"?`,
    `Gather what you need (documents, tools, data, access).`,
    `Create an outline of the main sections or parts.`,
    `Work on the first part only and finish it.`,
    `Work on the next part and finish it.`,
    `Review everything for errors and missing details.`,
    `Submit or save the final result and confirm completion.`
  ];
 
  return generic.slice(0, 7).map((text, i) => ({
    stepNumber: i + 1,
    stepDescription: text,
    isCompleted: false
  }));
}
 
function parseNumberedSteps(text) {
  // Accepts:
  // 1. step
  // 1) step
  // - step (we will number them)
  const lines = (text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
 
  const numbered = lines.filter(l => /^(\d+[\.\)])\s+/.test(l));
  if (numbered.length) {
    return numbered.map((line, idx) => ({
      stepNumber: idx + 1,
      stepDescription: line.replace(/^(\d+[\.\)])\s+/, '').trim(),
      isCompleted: false
    }));
  }
 
  const bullets = lines.filter(l => /^[-•]\s+/.test(l));
  if (bullets.length) {
    return bullets.slice(0, 7).map((line, idx) => ({
      stepNumber: idx + 1,
      stepDescription: line.replace(/^[-•]\s+/, '').trim(),
      isCompleted: false
    }));
  }
 
  // If we can't parse, return empty (caller decides fallback)
  return [];
}
 
/**
 * POST /api/ai/simplify-task
 * Body: { taskDescription: string, taskId?: string }
 */
router.post('/simplify-task', async (req, res) => {
  try {
    const { taskDescription, taskId } = req.body;
 
    if (!taskDescription || !taskDescription.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task description is required'
      });
    }
 
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
 
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY not set in .env'
      });
    }
 
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
 
    const prompt =
`Break down the task into 5 to 7 simple numbered steps.
Use short, clear, actionable language.
Return ONLY the steps as:
1. ...
2. ...
No extra explanation.
 
Task: "${taskDescription.trim()}"`;
 
    let stepsArray = [];
    let used = 'gemini';
    let rawResponse = '';
 
    try {
      const result = await model.generateContent(prompt);
      rawResponse = result.response.text();
      stepsArray = parseNumberedSteps(rawResponse);
 
      if (!stepsArray.length) {
        // If Gemini returned something weird, fallback
        used = 'fallback_parse_failed';
        stepsArray = localFallbackSteps(taskDescription);
      }
    } catch (err) {
      // Handle quota/rate-limit gracefully
      const msg = err?.message || '';
      const status = err?.status || err?.code;
 
      if (
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.toLowerCase().includes('quota') ||
        status === 429
      ) {
        used = 'fallback_quota_exceeded';
        stepsArray = localFallbackSteps(taskDescription);
      } else {
        // real error
        throw err;
      }
    }
 
    // Save to task if taskId provided
    if (taskId) {
      const task = await Task.findById(taskId);
 
      if (task) {
        const hasAccess =
          req.user.role === 'manager' ||
          (task.assignedTo && task.assignedTo.toString() === req.user._id.toString()) ||
          task.createdBy.toString() === req.user._id.toString();
 
        if (hasAccess) {
          // Your model currently uses simplifiedSteps field
          task.simplifiedSteps = stepsArray;
          await task.save();
        }
      }
    }
 
    return res.json({
      success: true,
      originalTask: taskDescription,
      simplifiedSteps: stepsArray,
      stepsCount: stepsArray.length,
      used,            // tells you if Gemini or fallback was used
      model: modelName,
      rawResponse: rawResponse || undefined
    });
 
  } catch (error) {
    console.error('❌ AI Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to simplify task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
 
module.exports = router;
 
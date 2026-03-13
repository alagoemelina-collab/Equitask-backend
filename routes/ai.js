const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../middleware/auth');
const Task = require('../models/Tasks'); // change this if your model file is singular
 
router.use(protect);
 
// --- Helpers ---
function localFallbackSteps(taskDescription) {
  const text = taskDescription.toLowerCase().trim();
 
  let steps = [];
 
  if (text.includes('whatsapp') && (text.includes('delete') || text.includes('clean') || text.includes('remove'))) {
    steps = [
      'Open WhatsApp on your phone.',
      'Tap the three-dot menu at the top right.',
      'Select Settings.',
      'Tap Storage and Data.',
      'Tap Manage Storage.',
      'Select the chats or files you want to remove.',
      'Confirm the deletion.'
    ];
  } else if (text.includes('wifi') || text.includes('wi-fi')) {
    steps = [
      'Open your device settings.',
      'Find the Wi-Fi option.',
      'Turn on Wi-Fi.',
      'Wait for available networks to appear.',
      'Select the network you want to use.',
      'Enter the password if required.',
      'Check that the device is connected.'
    ];
  } else if (text.includes('fan') && (text.includes('turn on') || text.includes('switch on'))) {
    steps = [
      'Locate the fan.',
      'Plug the fan into power if needed.',
      'Turn on the wall socket.',
      'Press the power button or switch on the fan.',
      'Adjust the fan speed if needed.',
      'Check that the fan is working properly.'
    ];
  } else if (text.includes('email') && (text.includes('send') || text.includes('write'))) {
    steps = [
      'Open your email application.',
      'Click Compose.',
      'Enter the recipient email address.',
      'Write the subject and message.',
      'Attach files if needed.',
      'Review the email.',
      'Click Send.'
    ];
  } else if (text.includes('report')) {
    steps = [
      'Gather the information you need.',
      'List the main points to include.',
      'Create a simple outline.',
      'Write the report clearly.',
      'Review it for mistakes.',
      'Make final corrections.',
      'Submit or send the report.'
    ];
  } else {
    steps = [
      `Identify exactly what needs to be done for "${taskDescription}".`,
      'Gather the tools, information, or access you need.',
      'Start with the first practical action.',
      'Complete the next important action.',
      'Continue until all key parts are finished.',
      'Review the result for mistakes or missing details.',
      'Confirm that the task is completed properly.'
    ];
  }
 
  return steps.map((text, i) => ({
    stepNumber: i + 1,
    stepDescription: text,
    isCompleted: false
  }));
}
 
 
function parseNumberedSteps(text) {
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
 
  return [];
}
 
/**
 * POST /api/ai/simplify-task
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
 
    const apiKey = process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY;
    const modelName = 'gemini-2.0-flash';
 
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'GOOGLE_AI_KEY or GEMINI_API_KEY is not set in .env'
      });
    }
 
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
 
    const prompt = `
You are a helpful assistant for people who need clear step-by-step instructions.
 
Break the task into 5 to 8 practical, specific, real-world steps.
 
Rules:
- Each step must be a different action
- Use simple language
- Include real buttons, menus, or actions where relevant
- Do not repeat the task in different words
- Do not give vague steps like "understand the goal" or "complete the work"
- Return only numbered steps
 
Task: "${taskDescription.trim()}"
    `.trim();
 
    let stepsArray = [];
    let used = 'gemini';
    let rawResponse = '';
 
    try {
      const result = await model.generateContent(prompt);
      rawResponse = result.response.text();
 
      stepsArray = parseNumberedSteps(rawResponse);
 
      if (!stepsArray.length) {
        used = 'fallback_parse_failed';
        stepsArray = localFallbackSteps(taskDescription);
      }
    } catch (err) {
      const msg = err?.message || '';
      const status = err?.status || err?.code;
 
      console.error('Gemini API Error:', msg);
 
      if (
  msg.includes('RESOURCE_EXHAUSTED') ||
  msg.toLowerCase().includes('quota') ||
  status === 429 ||
  status === 500 ||
  status === 503 ||
  msg.toLowerCase().includes('service unavailable')
) {
  console.log('⚠️ Gemini unavailable, using fallback');
  used = 'fallback_service_unavailable';
  stepsArray = localFallbackSteps(taskDescription);
} else {
  throw err;
}
 
    }
 
    if (taskId) {
      const task = await Task.findById(taskId);
 
      if (task) {
        const hasAccess =
          req.user.role === 'manager' ||
          (task.assignedTo &&
            task.assignedTo.toString() === req.user._id.toString()) ||
          (task.createdBy &&
            task.createdBy.toString() === req.user._id.toString());
 
        if (hasAccess) {
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
      used,
      model: modelName,
      powered: 'Google AI Studio',
      rawResponse: rawResponse || undefined
    });
  } catch (error) {
    console.error('AI Error:', error);
 
    return res.status(500).json({
      success: false,
      message: 'Failed to simplify task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
 
/**
 * POST /api/ai/suggest-breakdown
 */
router.post('/suggest-breakdown', async (req, res) => {
  try {
    const { taskTitle } = req.body;
 
    if (!taskTitle || !taskTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }
 
    const apiKey = process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY;
    const modelName = 'gemini-1.5-flash';
 
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'GOOGLE_AI_KEY or GEMINI_API_KEY is not set in .env'
      });
    }
 
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
 
    const prompt = `
Suggest 4 to 5 short, practical subtasks for this task.
Return only numbered subtasks.
 
Task: "${taskTitle.trim()}"
    `.trim();
 
    const result = await model.generateContent(prompt);
    const suggestions = result.response.text();
    const suggestionsArray = parseNumberedSteps(suggestions);
 
    return res.json({
      success: true,
      taskTitle,
      suggestions: suggestionsArray,
      model: modelName
    });
  } catch (error) {
    console.error('AI Suggestion Error:', error);
 
    return res.status(500).json({
      success: false,
      message: 'Failed to generate suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
 
/**
 * GET /api/ai/status
 */
router.get('/status', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY;
 
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: 'Google AI key not configured'
      });
    }
 
    return res.json({
      success: true,
      message: 'AI service is running',
      model: 'gemini-1.5-flash',
      status: 'online'
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'AI service not available'
    });
  }
});
 
module.exports = router;
 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
 
dotenv.config();
 
const focusRoutes = require('./routes/focus');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const aiRoutes = require('./routes/ai');
const connectDB = require('./config/database');
const twoFactorRoutes = require('./routes/twoFactors');
 
const app = express();
 
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : '*',
  credentials: true
}));
 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}
 
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'EquiTask AI API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      tasks: '/api/tasks'
    }
  });
});
 
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/2fa', twoFactorRoutes);
 
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});
 
app.use((err, req, res, next) => {
  console.error('Error:', err);
 
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
 
const PORT = process.env.PORT || 5000;
 
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log('✅ Server running on port', PORT);
    console.log('✅ Database connected');
    console.log('🚀 Ready to accept requests');
  });
});
 
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});


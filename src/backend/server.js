const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { initializeFirebase } = require('./config/firebase');

// Initialize Firebase Admin
initializeFirebase();

// Create Express app
const app = express();

// Maintenance mode flag (set to true to enable maintenance mode)
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true' || false;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // Logging

// Maintenance mode middleware
app.use((req, res, next) => {
  // Allow health check even in maintenance mode
  if (MAINTENANCE_MODE && req.path !== '/health') {
    return res.status(503).json({
      success: false,
      message: 'The server is being maintained',
      maintenanceMode: true,
    });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/email', require('./routes/email'));
app.use('/api/maps', require('./routes/maps'));

// Health check
app.get('/health', (req, res) => {
  if (MAINTENANCE_MODE) {
    return res.status(503).json({
      success: false,
      message: 'The server is being maintained',
      maintenanceMode: true,
      timestamp: new Date().toISOString(),
    });
  }
  
  res.json({
    success: true,
    message: 'ShareBite API is running',
    maintenanceMode: false,
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ShareBite API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      donations: '/api/donations',
      health: '/health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

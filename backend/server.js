const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// ==================== MIDDLEWARE ====================
// CORS configuration
app.use(cors({
  origin: '*', // Change this to specific domain in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static exports (report artifacts)
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}
app.use('/exports', express.static(exportsDir));

// ==================== ROUTES ====================
// Authentication routes
app.use('/api/auth', authRoutes);

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running.'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.'
  });
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

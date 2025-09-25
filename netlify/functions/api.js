const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const path = require('path');

// Import backend routes
const authRoutes = require('../../backend/routes/auth');
const generateRoutes = require('../../backend/routes/generate');
const promptRoutes = require('../../backend/routes/prompts');
const userRoutes = require('../../backend/routes/user');

// Import middleware
const errorHandler = require('../../backend/middleware/errorHandler');
const securityMiddleware = require('../../backend/middleware/security');

const app = express();

// Apply security middleware
app.use(securityMiddleware);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-netlify-app.netlify.app'] // Replace with your actual Netlify URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../../backend/uploads')));

// API routes
app.use('/auth', authRoutes);
app.use('/generate', generateRoutes);
app.use('/prompts', promptRoutes);
app.use('/user', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Export the serverless function
module.exports.handler = serverless(app);
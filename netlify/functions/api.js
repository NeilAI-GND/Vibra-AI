const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import database connection
const connectDB = require('../../backend/config/database');

// Import backend routes
const authRoutes = require('../../backend/routes/auth');
const generateRoutes = require('../../backend/routes/generate');
const promptRoutes = require('../../backend/routes/prompts');
const userRoutes = require('../../backend/routes/user');

// Import middleware
const errorHandler = require('../../backend/middleware/errorHandler');
const securityMiddleware = require('../../backend/middleware/security');

const app = express();

// Initialize database connection for serverless
let isConnected = false;

const initializeDatabase = async () => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
      console.log('Database connected for serverless function');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }
};

// Apply security middleware
app.use(securityMiddleware);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins for Netlify deployment
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

// Wrap the app with database initialization
const handler = serverless(app);

// Export the serverless function with database initialization
module.exports.handler = async (event, context) => {
  // Initialize database connection
  await initializeDatabase();
  
  // Handle the request
  return handler(event, context);
};
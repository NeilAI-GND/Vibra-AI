const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

// Load environment variables
require('dotenv').config();

// Import database connection
const connectDB = require('../../backend/config/database');

// Import routes
const authRoutes = require('../../backend/routes/auth');
const userRoutes = require('../../backend/routes/user');
const chatRoutes = require('../../backend/routes/chat');
const uploadRoutes = require('../../backend/routes/upload');

const app = express();

// Database connection state
let isDbConnected = false;

// Initialize database connection for serverless environment
async function initializeDatabase() {
  if (!isDbConnected) {
    try {
      console.log('🔄 Initializing database connection...');
      console.log('📊 Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        MONGODB_URI: process.env.MONGODB_URI ? '✅ Set' : '❌ Missing',
        JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'
      });
      
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
      }
      
      await connectDB();
      isDbConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('🔍 Full error:', error);
      throw error;
    }
  }
}

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: isDbConnected ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// Wrap the app for serverless
const handler = serverless(app);

// Export the serverless function with database initialization
module.exports.handler = async (event, context) => {
  try {
    console.log('🚀 Function invoked:', {
      path: event.path,
      method: event.httpMethod,
      timestamp: new Date().toISOString()
    });
    
    // Initialize database connection
    await initializeDatabase();
    
    // Handle the request
    const result = await handler(event, context);
    console.log('✅ Function completed successfully');
    return result;
  } catch (error) {
    console.error('💥 Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Function execution failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
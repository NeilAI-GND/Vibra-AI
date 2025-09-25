const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const https = require('https');
const tls = require('tls');
require('dotenv').config();

// Aggressive SSL bypass for Node.js environment (for production SSL issues)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.HTTPS_PROXY = '';
process.env.HTTP_PROXY = '';

// Configure TLS settings to handle SSL issues with external APIs (Google Generative AI)
// This addresses the SSL error: tlsv1 alert internal error
const originalCreateSecureContext = tls.createSecureContext;
tls.createSecureContext = function(options) {
  const context = originalCreateSecureContext.call(this, options);
  context.context.setOptions(
    require('constants').SSL_OP_NO_SSLv2 |
    require('constants').SSL_OP_NO_SSLv3 |
    require('constants').SSL_OP_NO_TLSv1 |
    require('constants').SSL_OP_NO_TLSv1_1
  );
  return context;
};

// Configure HTTPS global agent for better SSL/TLS handling
https.globalAgent.options.secureProtocol = 'TLSv1_2_method';
https.globalAgent.options.rejectUnauthorized = false;
https.globalAgent.options.checkServerIdentity = () => undefined;
https.globalAgent.options.ciphers = [
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES128-SHA256',
  'ECDHE-RSA-AES256-SHA384',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384'
].join(':');

// Set minimum TLS version and additional SSL options
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';
https.globalAgent.options.secureOptions = require('constants').SSL_OP_NO_SSLv2 | require('constants').SSL_OP_NO_SSLv3;

// Additional SSL bypass for production environments (Render, Heroku, etc.)
if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.RENDER_SERVICE_ID) {
  // Override default HTTPS agent for production SSL issues
  const Agent = require('https').Agent;
  const originalAgent = https.globalAgent;
  
  https.globalAgent = new Agent({
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
    secureProtocol: 'TLSv1_2_method',
    secureOptions: require('constants').SSL_OP_NO_SSLv2 | require('constants').SSL_OP_NO_SSLv3,
    timeout: 30000,
    keepAlive: true
  });
  
  console.log('🔓 Production SSL bypass enabled for external API compatibility');
}

// Override global fetch for Google Generative AI SDK with SSL bypass
if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.RENDER_SERVICE_ID) {
  const originalFetch = global.fetch;
  const https = require('https');
  
  // Create a custom HTTPS agent with SSL bypass
  const customAgent = new https.Agent({
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
    secureProtocol: 'TLSv1_2_method',
    timeout: 60000,
    keepAlive: true,
    maxSockets: 50
  });
  
  // Override fetch for Google AI API calls
  global.fetch = async (url, options = {}) => {
    if (typeof url === 'string' && url.includes('generativelanguage.googleapis.com')) {
      console.log('🔓 Using SSL bypass for Google Generative AI API call');
      
      // Use node-fetch with custom agent for Google AI API
      const fetch = require('node-fetch');
      return fetch(url, {
        ...options,
        agent: customAgent,
        timeout: 60000
      });
    }
    
    // Use original fetch for other requests
    return originalFetch ? originalFetch(url, options) : require('node-fetch')(url, options);
  };
  
  console.log('🔓 Custom fetch with SSL bypass configured for Google AI API');
}

console.log('🔒 TLS configuration applied for external API connections');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const generateRoutes = require('./routes/generate');
const promptsRoutes = require('./routes/prompts');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { 
  sanitizeInput, 
  globalRateLimit, 
  csrfProtection, 
  securityHeaders 
} = require('./middleware/security');

const app = express();

// Security headers
app.use(securityHeaders);

// Enhanced helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// MongoDB injection prevention
app.use(mongoSanitize({
  replaceWith: '_'
}));

// Session configuration for CSRF
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CORS configuration (more restrictive)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Global rate limiting
app.use(globalRateLimit);

// Body parsing middleware (reduced limits for security)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization
app.use(sanitizeInput);

// CSRF protection (applied after body parsing)
app.use(csrfProtection);

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const token = require('crypto').randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  res.json({ csrfToken: token });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/prompts', promptsRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    // For testing purposes, use in-memory MongoDB or skip DB connection
    if (process.env.NODE_ENV === 'development' && !process.env.MONGODB_URI.includes('mongodb+srv')) {
      console.log('⚠️  MongoDB not available. Running in mock mode.');
      return;
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Start server
const PORT = process.env.PORT || 5000; // Server port configuration
const server = app.listen(PORT, () => {
  console.log(`
🚀 Vibra AI Server is running!
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Port: ${PORT}
📊 Health Check: http://localhost:${PORT}/health
🔗 API Base: http://localhost:${PORT}/api
  `);
});

module.exports = app;
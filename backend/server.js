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
const dns = require('dns');
require('dotenv').config();

// Default TLS settings in Node are sufficient; avoid global overrides that can cause handshake issues.

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
🟢 Node: ${process.version} (OpenSSL: ${process.versions.openssl})
📊 Health Check: http://localhost:${PORT}/health
🔗 API Base: http://localhost:${PORT}/api
  `);
});

module.exports = app;

// Targeted fetch override for Google Generative AI API to avoid global TLS hacks
if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.RENDER_SERVICE_ID) {
  const originalFetch = global.fetch;
  const dns = require('dns');
  const { constants } = require('crypto');

  const primaryAgent = new https.Agent({
    keepAlive: true,
    timeout: 60000,
    maxSockets: 50,
    // Force IPv4 to avoid potential IPv6 handshake/routing issues on some platforms
    lookup: (hostname, opts, cb) => dns.lookup(hostname, { family: 4 }, cb),
    // Prefer modern TLS
    maxVersion: 'TLSv1.3',
    minVersion: 'TLSv1.2'
  });

  const fallbackAgent = new https.Agent({
    keepAlive: true,
    timeout: 60000,
    maxSockets: 50,
    lookup: (hostname, opts, cb) => dns.lookup(hostname, { family: 4 }, cb),
    // Explicitly allow TLSv1.2 only as fallback
    maxVersion: 'TLSv1.2',
    minVersion: 'TLSv1.2',
    // Conservative cipher suite for compatibility
    ciphers: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384'
    ].join(':'),
    honorCipherOrder: true
  });

  global.fetch = async (url, options = {}) => {
    const isGoogleAI = typeof url === 'string' && url.includes('generativelanguage.googleapis.com');
    if (isGoogleAI) {
      const fetch = require('node-fetch');
      try {
        return await fetch(url, { ...options, agent: primaryAgent, timeout: 60000 });
      } catch (err) {
        const msg = err && (err.message || '');
        const code = err && err.code;
        const sslLike = msg.includes('SSL') || msg.includes('TLS') || code === 'ECONNRESET' || code === 'ENOTFOUND';
        if (sslLike) {
          console.warn('🔒 [TLS RETRY] Primary agent failed, retrying with TLSv1.2 fallback for Google AI:', msg);
          return await fetch(url, { ...options, agent: fallbackAgent, timeout: 60000 });
        }
        throw err;
      }
    }
    return originalFetch ? originalFetch(url, options) : require('node-fetch')(url, options);
  };

  console.log('🔒 Targeted HTTPS agent applied for Google AI API (IPv4, keep-alive, TLS fallback). No global TLS overrides.');
}
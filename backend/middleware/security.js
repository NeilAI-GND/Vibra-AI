const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');
const User = require('../models/User');

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize all string inputs
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove HTML/XSS
        obj[key] = xss(obj[key], {
          whiteList: {}, // No HTML tags allowed
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
        
        // Trim whitespace
        obj[key] = obj[key].trim();
        
        // Additional sanitization for specific fields
        if (key === 'email') {
          obj[key] = validator.normalizeEmail(obj[key]) || obj[key];
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  
  next();
};

// Rate limiting configurations
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Authentication rate limiting (stricter)
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later',
  true // Skip successful requests
);

// Password change rate limiting
const passwordChangeRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Too many password change attempts, please try again later'
);

// File upload rate limiting
const uploadRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 uploads
  'Too many file uploads, please try again later'
);

// Generation rate limiting
const generationRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  20, // 20 generations
  'Too many generation requests, please try again later'
);

// Global rate limiting (more permissive)
const globalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests, please try again later'
);

// CSRF Protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests and API endpoints that don't modify data
  if (req.method === 'GET' || req.path.includes('/api/csrf-token')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token'
    });
  }

  next();
};

// Account lockout constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

// Account lockout middleware
const accountLockout = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next();

    const user = await User.findOne({ email });
    if (!user) return next();

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({
        error: `Account is locked. Try again in ${remainingTime} minutes.`
      });
    }

    // Reset lock if time has passed
    if (user.lockUntil && user.lockUntil <= Date.now()) {
      await User.findByIdAndUpdate(user._id, {
        $unset: { lockUntil: 1, loginAttempts: 1 }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Record failed login attempt
const recordFailedLogin = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return;

    const updates = { $inc: { loginAttempts: 1 } };
    
    // Lock account if max attempts reached
    if (user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !user.lockUntil) {
      updates.$set = { lockUntil: Date.now() + LOCK_TIME };
    }

    await User.findByIdAndUpdate(user._id, updates);
  } catch (error) {
    console.error('Error recording failed login:', error);
  }
};

// Clear login attempts on successful login
const clearLoginAttempts = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });
  } catch (error) {
    console.error('Error clearing login attempts:', error);
  }
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers beyond helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

module.exports = {
  sanitizeInput,
  authRateLimit,
  passwordChangeRateLimit,
  uploadRateLimit,
  generationRateLimit,
  globalRateLimit,
  csrfProtection,
  accountLockout,
  recordFailedLogin,
  clearLoginAttempts,
  securityHeaders
};
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRateLimit, accountLockout, recordFailedLogin, clearLoginAttempts } = require('./security');

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({
        error: `Account is locked. Try again in ${remainingTime} minutes.`
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Middleware to check if user is paid tier
const requirePaidTier = (req, res, next) => {
  if (req.user.tier !== 'paid') {
    return res.status(403).json({
      error: 'This feature requires a paid subscription.',
      upgrade: true
    });
  }
  next();
};

// Middleware to check if user is admin (for future use)
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required.'
    });
  }
  next();
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (jwtError) {
        // Silently ignore token errors for optional auth
        console.log('Optional auth token error:', jwtError.message);
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

module.exports = {
  auth,
  requirePaidTier,
  requireAdmin,
  optionalAuth,
  authRateLimit,
  accountLockout,
  recordFailedLogin,
  clearLoginAttempts
};
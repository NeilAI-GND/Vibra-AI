const express = require('express');
const { auth, requirePaidTier, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const User = require('../models/User');
const Quota = require('../models/Quota');
const Generation = require('../models/Generation');

const router = express.Router();

// @route   GET /api/user/quota
// @desc    Get user's current quota status
// @access  Private
router.get('/quota', auth, asyncHandler(async (req, res) => {
  const quota = await Quota.getTodayQuota(req.user._id);
  
  res.json({
    quota: {
      generationsUsed: quota.generationsUsed,
      generationsLimit: quota.generationsLimit,
      generationsRemaining: quota.generationsRemaining,
      usagePercentage: quota.usagePercentage,
      status: quota.status,
      resetAt: quota.resetAt,
      date: quota.date
    },
    user: {
      tier: req.user.tier,
      dailyLimit: req.user.dailyLimit
    }
  });
}));

// @route   GET /api/user/generations
// @desc    Get user's generation history
// @access  Private
router.get('/generations', auth, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const preset = req.query.preset;
  // New: support search and sortBy
  const search = req.query.search;
  const sortBy = req.query.sortBy;

  // Build filter
  const filter = { userId: req.user._id };
  if (status && status !== 'all') filter.status = status;
  if (preset) filter.presetUsed = preset;
  if (search && search.trim()) {
    filter.$or = [
      { prompt: { $regex: search, $options: 'i' } },
      { presetUsed: { $regex: search, $options: 'i' } }
    ];
  }

  // Determine sort option
  let sortOption = { createdAt: -1 }; // default newest
  if (sortBy === 'oldest') sortOption = { createdAt: 1 };
  if (sortBy === 'prompt') sortOption = { prompt: 1 };

  // Get generations with pagination
  const generationsDocs = await Generation.find(filter)
    .sort(sortOption)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('userId', 'firstName lastName email');

  // Ensure virtuals are included (imageUrls, preset) and provide robust fallback
  const generations = generationsDocs.map((doc) => {
    const obj = doc.toObject({ virtuals: true });
    if (!Array.isArray(obj.imageUrls) || obj.imageUrls.length === 0) {
      obj.imageUrls = obj.generatedImageUrl ? [obj.generatedImageUrl] : [];
    }
    if (!obj.preset && obj.presetUsed) {
      obj.preset = { name: obj.presetUsed };
    }
    return obj;
  });

  // Get total count for pagination
  const total = await Generation.countDocuments(filter);

  res.json({
    generations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  });
}));

// @route   GET /api/user/generations/:id
// @desc    Get specific generation details
// @access  Private
router.get('/generations/:id', auth, asyncHandler(async (req, res) => {
  const generation = await Generation.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!generation) {
    return res.status(404).json({
      error: 'Generation not found'
    });
  }

  res.json({ generation });
}));

// @route   DELETE /api/user/generations/:id
// @desc    Delete a generation
// @access  Private
router.delete('/generations/:id', auth, asyncHandler(async (req, res) => {
  const generation = await Generation.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!generation) {
    return res.status(404).json({
      error: 'Generation not found'
    });
  }

  await generation.deleteOne();

  res.json({
    message: 'Generation deleted successfully'
  });
}));

// @route   GET /api/user/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get generation statistics
  const totalGenerations = await Generation.countDocuments({ userId });
  const successfulGenerations = await Generation.countDocuments({ 
    userId, 
    status: 'completed' 
  });
  const failedGenerations = await Generation.countDocuments({ 
    userId, 
    status: 'failed' 
  });

  // Get this month's generations
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyGenerations = await Generation.countDocuments({
    userId,
    createdAt: { $gte: startOfMonth }
  });

  // Get today's quota
  const todayQuota = await Quota.getTodayQuota(userId);

  // Get most used presets
  const presetStats = await Generation.aggregate([
    { $match: { userId: userId, status: 'completed' } },
    { $group: { _id: '$presetUsed', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailyActivity = await Generation.aggregate([
    {
      $match: {
        userId: userId,
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    stats: {
      total: {
        generations: totalGenerations,
        successful: successfulGenerations,
        failed: failedGenerations,
        successRate: totalGenerations > 0 ? (successfulGenerations / totalGenerations * 100).toFixed(1) : 0
      },
      monthly: {
        generations: monthlyGenerations
      },
      today: {
        used: todayQuota.generationsUsed,
        limit: todayQuota.generationsLimit,
        remaining: todayQuota.generationsRemaining
      },
      presets: presetStats.map(p => ({
        name: p._id,
        count: p.count
      })),
      activity: dailyActivity.map(a => ({
        date: a._id,
        count: a.count
      }))
    }
  });
}));

// @route   GET /api/user/tier-info
// @desc    Get tier information and benefits
// @access  Private
router.get('/tier-info', auth, asyncHandler(async (req, res) => {
  const tiers = {
    free: {
      name: 'Free',
      dailyLimit: 5,
      features: [
        'Basic image generation',
        '5 generations per day',
        'Standard quality',
        'Basic presets'
      ],
      price: 'Free'
    },
    paid: {
      name: 'Pro',
      dailyLimit: 100,
      features: [
        'Advanced image generation',
        '100 generations per day',
        'High quality output',
        'All presets available',
        'Priority processing',
        'Advanced customization'
      ],
      price: '$9.99/month'
    }
  };

  res.json({
    currentTier: req.user.tier,
    currentLimit: req.user.dailyLimit,
    tiers
  });
}));

// @route   POST /api/user/upgrade
// @desc    Upgrade user to paid tier (placeholder for payment integration)
// @access  Private
router.post('/upgrade', auth, asyncHandler(async (req, res) => {
  if (req.user.tier === 'paid') {
    return res.status(400).json({
      error: 'User is already on paid tier'
    });
  }

  // In a real implementation, this would integrate with a payment processor
  // For now, we'll just simulate the upgrade
  
  // This is a placeholder - in production, you would:
  // 1. Validate payment information
  // 2. Process payment with Stripe/PayPal/etc.
  // 3. Only upgrade on successful payment

  const user = await User.findById(req.user._id);
  await user.upgradeToPaid();

  res.json({
    message: 'Successfully upgraded to paid tier',
    user: {
      id: user._id,
      tier: user.tier,
      dailyLimit: user.dailyLimit
    }
  });
}));

// Admin routes

// @route   GET /api/user/admin/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/admin/users', auth, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = req.query.search;
  const tier = req.query.tier;
  const isActive = req.query.isActive;

  // Build filter
  const filter = {};
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  if (tier) filter.tier = tier;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  // Get users with pagination
  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Get total count
  const total = await User.countDocuments(filter);

  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// @route   PUT /api/user/admin/users/:id/tier
// @desc    Update user tier (admin only)
// @access  Private (Admin)
router.put('/admin/users/:id/tier', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { tier } = req.body;

  if (!['free', 'paid'].includes(tier)) {
    return res.status(400).json({
      error: 'Invalid tier. Must be "free" or "paid"'
    });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  if (tier === 'paid') {
    await user.upgradeToPaid();
  } else {
    await user.downgradeToFree();
  }

  res.json({
    message: `User tier updated to ${tier}`,
    user: {
      id: user._id,
      email: user.email,
      tier: user.tier,
      dailyLimit: user.dailyLimit
    }
  });
}));

// @route   PUT /api/user/admin/users/:id/status
// @desc    Update user status (admin only)
// @access  Private (Admin)
router.put('/admin/users/:id/status', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    user: {
      id: user._id,
      email: user.email,
      isActive: user.isActive
    }
  });
}));

module.exports = router;
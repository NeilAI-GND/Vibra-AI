const mongoose = require('mongoose');

const quotaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  generationsUsed: {
    type: Number,
    default: 0,
    min: [0, 'Generations used cannot be negative']
  },
  generationsLimit: {
    type: Number,
    required: [true, 'Generations limit is required'],
    min: [1, 'Generations limit must be at least 1']
  },
  resetAt: {
    type: Date,
    default: function() {
      const tomorrow = new Date(this.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index to ensure one quota per user per date
quotaSchema.index({ userId: 1, date: 1 }, { unique: true });

// Virtual for remaining generations
quotaSchema.virtual('generationsRemaining').get(function() {
  return Math.max(0, this.generationsLimit - this.generationsUsed);
});

// Virtual for usage percentage
quotaSchema.virtual('usagePercentage').get(function() {
  return Math.round((this.generationsUsed / this.generationsLimit) * 100);
});

// Virtual for quota status
quotaSchema.virtual('status').get(function() {
  if (this.generationsUsed >= this.generationsLimit) {
    return 'exceeded';
  } else if (this.generationsUsed >= this.generationsLimit * 0.8) {
    return 'warning';
  }
  return 'normal';
});

// Static method to get or create today's quota for a user
quotaSchema.statics.getTodayQuota = async function(userId, userTier = 'free') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Determine limit based on user tier
  const limit = userTier === 'paid' 
    ? parseInt(process.env.PAID_TIER_DAILY_LIMIT) || 50
    : parseInt(process.env.FREE_TIER_DAILY_LIMIT) || 5;
  
  let quota = await this.findOne({ userId, date: today });
  
  if (!quota) {
    quota = await this.create({
      userId,
      date: today,
      generationsUsed: 0,
      generationsLimit: limit
    });
  } else if (quota.generationsLimit !== limit) {
    // Update limit if user tier changed
    quota.generationsLimit = limit;
    await quota.save();
  }
  
  return quota;
};

// Static method to check if user can generate
quotaSchema.statics.canUserGenerate = async function(userId, userTier = 'free') {
  const quota = await this.getTodayQuota(userId, userTier);
  return quota.generationsUsed < quota.generationsLimit;
};

// Static method to increment usage
quotaSchema.statics.incrementUsage = async function(userId, userTier = 'free') {
  const quota = await this.getTodayQuota(userId, userTier);
  
  if (quota.generationsUsed >= quota.generationsLimit) {
    throw new Error('Daily generation limit exceeded');
  }
  
  quota.generationsUsed += 1;
  await quota.save();
  
  return quota;
};

// Static method to get quota history for a user
quotaSchema.statics.getUserQuotaHistory = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  return this.find({
    userId,
    date: { $gte: startDate }
  }).sort({ date: -1 });
};

// Static method to get quota statistics
quotaSchema.statics.getQuotaStats = async function(userId = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const matchStage = userId 
    ? { userId: new mongoose.Types.ObjectId(userId), date: today }
    : { date: today };
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalGenerationsUsed: { $sum: '$generationsUsed' },
        totalGenerationsLimit: { $sum: '$generationsLimit' },
        avgUsage: { $avg: '$generationsUsed' },
        maxUsage: { $max: '$generationsUsed' }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    totalGenerationsUsed: 0,
    totalGenerationsLimit: 0,
    avgUsage: 0,
    maxUsage: 0
  };
};

// Static method to reset expired quotas (cleanup job)
quotaSchema.statics.resetExpiredQuotas = async function() {
  const now = new Date();
  
  const result = await this.deleteMany({
    resetAt: { $lt: now }
  });
  
  return result.deletedCount;
};

// Instance method to reset quota
quotaSchema.methods.reset = function() {
  this.generationsUsed = 0;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  this.resetAt = tomorrow;
  
  return this.save();
};

// Instance method to check if quota is exceeded
quotaSchema.methods.isExceeded = function() {
  return this.generationsUsed >= this.generationsLimit;
};

// Instance method to check if quota is near limit
quotaSchema.methods.isNearLimit = function(threshold = 0.8) {
  return this.generationsUsed >= (this.generationsLimit * threshold);
};

module.exports = mongoose.model('Quota', quotaSchema);
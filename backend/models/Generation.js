const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  originalImageUrl: {
    type: String,
    default: null
  },
  generatedImageUrl: {
    type: String,
    default: null
  },
  // Added: store the final prompt used for generation
  prompt: {
    type: String,
    required: [true, 'Prompt is required'],
    maxlength: [2000, 'Prompt is too long']
  },
  presetUsed: {
    type: String,
    default: 'custom',
    enum: [
      'portrait-enhancement',
      'artistic-landscape',
      'modern-architecture',
      'fantasy-character',
      'abstract-geometry',
      'product-shot',
      'editing',
      'background',
      'retouch',
      'portrait',
      'lighting',
      '90s movie',
      '1970s suit',
      'black and white close-up portrait',
      'Paris Travel',
      'Statue of Liberty',
      'Taj Mahal at sunrise',
      'Great Wall of China',
      'Eiffel Tower',
      'top of the Hollywood Sign',
      'reimagined in the 90s',
      '80s character with big hair',
      '1970s disco look',
      'custom'
    ]
  },
  refinements: {
    style: {
      type: String,
      default: null,
      maxlength: [100, 'Style refinement cannot exceed 100 characters']
    },
    background: {
      type: String,
      default: null,
      maxlength: [100, 'Background refinement cannot exceed 100 characters']
    },
    theme: {
      type: String,
      default: null,
      maxlength: [100, 'Theme refinement cannot exceed 100 characters']
    }
  },
  // Added: store generation parameters (e.g., size, quality, style)
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
    index: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  processingStartTime: {
    type: Date,
    default: Date.now
  },
  processingEndTime: {
    type: Date,
    default: null
  },
  aiProvider: {
    type: String,
    default: 'openai',
    enum: ['openai', 'stability', 'midjourney']
  },
  aiRequestId: {
    type: String,
    default: null
  },
  metadata: {
    originalImageSize: {
      width: Number,
      height: Number,
      fileSize: Number
    },
    generatedImageSize: {
      width: Number,
      height: Number,
      fileSize: Number
    },
    processingTime: Number, // in milliseconds
    cost: Number // in credits or dollars
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ status: 1, createdAt: -1 });
generationSchema.index({ userId: 1, status: 1 });

// Virtual for processing duration
generationSchema.virtual('processingDuration').get(function() {
  if (this.processingEndTime && this.processingStartTime) {
    return this.processingEndTime - this.processingStartTime;
  }
  return null;
});

// Virtual for formatted status
generationSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'processing': 'Processing...',
    'completed': 'Completed',
    'failed': 'Failed'
  };
  return statusMap[this.status] || this.status;
});

// Pre-save middleware to set processing end time
generationSchema.pre('save', function(next) {
  if (this.isModified('status') && (this.status === 'completed' || this.status === 'failed')) {
    if (!this.processingEndTime) {
      this.processingEndTime = new Date();
    }
    
    // Calculate processing time if not already set
    if (!this.metadata.processingTime && this.processingStartTime) {
      this.metadata.processingTime = this.processingEndTime - this.processingStartTime;
    }
  }
  next();
});

// Static method to get user's generation history
generationSchema.statics.getUserHistory = function(userId, limit = 10, skip = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'firstName lastName email tier');
};

// Static method to get generation stats
generationSchema.statics.getStats = async function(userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$metadata.processingTime' }
      }
    }
  ]);
  
  const totalCount = await this.countDocuments(matchStage);
  
  return {
    total: totalCount,
    byStatus: stats.reduce((acc, item) => {
      acc[item._id] = {
        count: item.count,
        avgProcessingTime: item.avgProcessingTime
      };
      return acc;
    }, {})
  };
};

// Get today's generation count for a user
generationSchema.statics.getTodayCount = function(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return this.countDocuments({
    userId,
    createdAt: { $gte: startOfDay }
  });
};

// Instance method to mark as completed
generationSchema.methods.markCompleted = function(generatedImageUrl, metadata = {}) {
  this.generatedImageUrl = generatedImageUrl;
  this.status = 'completed';
  this.processingEndTime = new Date();
  this.metadata = { ...this.metadata, ...metadata };
  return this.save();
};

// Instance method to mark as failed
generationSchema.methods.markFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.processingEndTime = new Date();
  return this.save();
};

// Virtual for imageUrls array used by frontend (derive from generatedImageUrl)
generationSchema.virtual('imageUrls').get(function() {
  return this.generatedImageUrl ? [this.generatedImageUrl] : [];
});

// Virtual to provide preset object shape expected by frontend
generationSchema.virtual('preset').get(function() {
  return this.presetUsed ? { name: this.presetUsed } : null;
});

module.exports = mongoose.model('Generation', generationSchema);
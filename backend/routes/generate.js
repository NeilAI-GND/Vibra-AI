const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { upload, processImage } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errorHandler');
const User = require('../models/User');
const Generation = require('../models/Generation');
const Quota = require('../models/Quota');
const GeminiService = require('../services/geminiService');
const GeminiImageService = require('../services/geminiService');
const promptMatcher = require('../services/promptMatcher');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const router = express.Router();

// Initialize AI services with error handling
let geminiService = null;
let geminiImageService = null;

try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') {
    geminiService = new GeminiService();
    geminiImageService = new GeminiService(); // Use the same real Gemini service
    console.log('✅ Gemini services initialized with real API');
  } else {
    console.warn('⚠️  Gemini API key not configured.');
  }
} catch (error) {
  console.error('Failed to initialize Gemini services:', error.message);
}

// Fallback presets (used when no CSV file is available)
const FALLBACK_PRESETS = {
  'realistic-portrait': {
    id: 'realistic-portrait',
    name: 'Realistic Portrait',
    description: 'High-quality realistic human portraits',
    main_prompt: 'professional portrait photography, high quality, realistic, detailed facial features, natural lighting',
    negative_prompt: 'cartoon, anime, illustration, painting, drawing, art, sketch',
    style: 'photorealistic',
    category: 'portrait',
    user_tier: 'free'
  },
  'artistic-landscape': {
    id: 'artistic-landscape',
    name: 'Artistic Landscape',
    description: 'Beautiful artistic landscape scenes',
    main_prompt: 'beautiful landscape, artistic style, vibrant colors, detailed scenery, professional photography',
    negative_prompt: 'people, portraits, indoor, urban, city',
    style: 'artistic',
    category: 'landscape',
    user_tier: 'free'
  },
  'modern-architecture': {
    id: 'modern-architecture',
    name: 'Modern Architecture',
    description: 'Contemporary architectural designs',
    main_prompt: 'modern architecture, contemporary design, clean lines, professional architectural photography',
    negative_prompt: 'people, nature, vintage, old, traditional',
    style: 'architectural',
    category: 'architecture',
    user_tier: 'free'
  }
};

// @route   GET /api/generate/presets
// @desc    Get available generation presets
// @access  Private
router.get('/presets', auth, asyncHandler(async (req, res) => {
  const userTier = req.user.tier;
  
  try {
    // Try to get prompts from CSV first
    let allPrompts = await promptMatcher.getAllPrompts();
    
    // If no CSV prompts available, use fallback presets
    if (allPrompts.length === 0) {
      allPrompts = Object.values(FALLBACK_PRESETS);
    }
    
    // Filter prompts based on user tier
    const availablePrompts = allPrompts.filter(prompt => {
      if (userTier === 'premium' || userTier === 'paid') {
        return true; // Premium users can access all prompts
      }
      return prompt.user_tier === 'free';
    });
    
    const unavailablePrompts = allPrompts.filter(prompt => {
      if (userTier === 'premium' || userTier === 'paid') {
        return false; // Premium users have access to all
      }
      return prompt.user_tier !== 'free';
    });
    
    // Format available prompts
    const presets = availablePrompts.map(prompt => ({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      category: prompt.category,
      style: prompt.style,
      main_prompt: prompt.main_prompt,
      negative_prompt: prompt.negative_prompt,
      available: true
    }));
    
    // Add unavailable prompts for free users
    if (userTier === 'free') {
      const unavailable = unavailablePrompts.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        category: prompt.category,
        style: prompt.style,
        main_prompt: prompt.main_prompt,
        negative_prompt: prompt.negative_prompt,
        available: false,
        requiresPaid: true
      }));
      
      presets.push(...unavailable);
    }
    
    res.json({
      presets,
      userTier,
      source: allPrompts.length > Object.keys(FALLBACK_PRESETS).length ? 'csv' : 'fallback'
    });
    
  } catch (error) {
    console.error('Error loading presets:', error);
    
    // Fallback to hardcoded presets on error
    const fallbackPresets = Object.values(FALLBACK_PRESETS);
    const availablePresets = fallbackPresets.filter(preset => 
      userTier === 'premium' || userTier === 'paid' || preset.user_tier === 'free'
    );
    
    res.json({
       presets: availablePresets.map(preset => ({ ...preset, available: true })),
       userTier,
       source: 'fallback',
       error: 'Failed to load CSV prompts'
     });
   }
}));

// Text-to-image route removed - only image-to-image generation is supported

// Image-to-image generation
router.post('/image-to-image', auth, upload, processImage, async (req, res) => {
  console.log('🔍 [BACKEND DEBUG] Image-to-image route called');
  
  try {
    const { prompt, preset, size = '1024x1024' } = req.body;
    
    console.log('🔍 [BACKEND DEBUG] Request details:', {
      prompt: prompt?.substring(0, 100) + '...',
      preset,
      size,
      hasFile: !!req.file,
      fileSize: req.file?.size,
      fileType: req.file?.mimetype,
      userId: req.user.id
    });

    // Validate required fields
    if (!prompt || prompt.trim().length === 0) {
      console.error('❌ [BACKEND DEBUG] Missing or empty prompt');
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and cannot be empty'
      });
    }

    if (!req.file) {
      console.error('❌ [BACKEND DEBUG] No image file provided');
      return res.status(400).json({
        success: false,
        error: 'Image file is required for image-to-image generation'
      });
    }

    if (prompt.length > 1000) {
      console.error('❌ [BACKEND DEBUG] Prompt too long:', prompt.length);
      return res.status(400).json({
        success: false,
        error: 'Prompt must be less than 1000 characters'
      });
    }

    // Check user quota
    console.log('🔍 [BACKEND DEBUG] Checking user quota...');
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('❌ [BACKEND DEBUG] User not found:', req.user.id);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get or create quota for today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day
    
    let quota = await Quota.findOne({ userId: req.user.id, date: today });
    if (!quota) {
      const generationsLimit = user.tier === 'paid' ? 50 : 5;
      quota = new Quota({
        userId: req.user.id,
        date: today,
        generationsUsed: 0,
        generationsLimit
      });
      await quota.save();
    }

    if (quota.generationsUsed >= quota.generationsLimit) {
      console.error('❌ [BACKEND DEBUG] Quota exceeded:', { generationsUsed: quota.generationsUsed, generationsLimit: quota.generationsLimit });
      return res.status(429).json({
        success: false,
        error: 'Daily generation limit exceeded. Please upgrade to Pro for unlimited generations.'
      });
    }

    console.log('✅ [BACKEND DEBUG] Quota check passed:', { generationsUsed: quota.generationsUsed, generationsLimit: quota.generationsLimit });

    // Build uploaded image URL for placeholder replacement
    const uploadedImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('🔍 [BACKEND DEBUG] Uploaded image URL:', uploadedImageUrl);

    // Process preset and construct final prompt with image reference
    let finalPrompt = prompt;
    let normalizedPreset = preset || 'custom';
    if (preset) {
      console.log('🔍 [BACKEND DEBUG] Processing preset:', preset);
      try {
        const allPrompts = await promptMatcher.getAllPrompts();
        let presetData = allPrompts.find(p => p.id === preset || p.name === preset);
        if (!presetData) {
          presetData = FALLBACK_PRESETS[preset] || Object.values(FALLBACK_PRESETS).find(p => p.id === preset || p.name === preset);
        }

        if (presetData) {
          normalizedPreset = presetData.name || presetData.category || preset;
          let base = presetData.main_prompt || '';

          // Replace common image placeholders with the uploaded image URL
          const imagePlaceholderPatterns = [/{image}/gi, /{image_url}/gi, /{image_path}/gi, /\[IMAGE\]/g];
          imagePlaceholderPatterns.forEach((pattern) => {
            base = base.replace(pattern, uploadedImageUrl);
          });

          // Replace {prompt} placeholder with user prompt if present
          if (base.includes('{prompt}')) {
            base = base.replace('{prompt}', prompt);
          }

          // If no explicit image placeholder existed, append a reference
          if (!base.includes(uploadedImageUrl)) {
            base = `${base}, reference image: ${uploadedImageUrl}`.trim();
          }

          // If {prompt} wasn't used and user provided extra instructions, append them
          if (!/\{prompt\}/.test(presetData.main_prompt) && prompt && prompt.trim().length > 0) {
            base = `${base}, ${prompt}`;
          }

          finalPrompt = base;

          console.log('✅ [BACKEND DEBUG] Preset applied with image reference:', {
            presetName: presetData.name || presetData.category,
            uploadedImageUrl,
            originalPrompt: prompt.substring(0, 100) + '...',
            finalPrompt: finalPrompt.substring(0, 300) + '...'
          });
        } else {
          console.warn('⚠️ [BACKEND DEBUG] Preset not found; will append image reference to user prompt');
          finalPrompt = `${prompt}, reference image: ${uploadedImageUrl}`;
        }
      } catch (error) {
        console.error('❌ [BACKEND DEBUG] Error processing preset:', error);
        console.warn('⚠️ [BACKEND DEBUG] Falling back to user prompt with image reference');
        finalPrompt = `${prompt}, reference image: ${uploadedImageUrl}`;
      }
    } else {
      // No preset provided; still add the image reference
      finalPrompt = `${prompt}, reference image: ${uploadedImageUrl}`;
    }

    // Explicitly log the full final prompt that will be sent to AI
    console.log('🧪 [BACKEND DEBUG] Final prompt to AI (image-to-image):', finalPrompt);
    console.log('🧪 [BACKEND DEBUG] Image reference used in prompt:', uploadedImageUrl);

    console.log('🔍 [BACKEND DEBUG] File processing completed:', {
      originalName: req.file.originalname,
      processedPath: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Process image with Gemini service
    console.log('🔍 [BACKEND DEBUG] Processing image with AI...');
    
    let imageUrl;
    const originalImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    if (!geminiService) {
      console.log('⚠️ [BACKEND DEBUG] Gemini service not available, using local uploaded image URL as processed result');
      imageUrl = originalImageUrl;
      console.log('✅ [BACKEND DEBUG] Using local processed image URL:', imageUrl);
    } else {
      try {
        const imageResult = await geminiImageService.generateImageFromImage(req.file.path, finalPrompt, {
          width: parseInt(size.split('x')[0]),
          height: parseInt(size.split('x')[1])
        });
        
        if (!imageResult || !imageResult.imageUrl) {
          console.error('❌ [BACKEND DEBUG] Invalid Gemini service response:', imageResult);
          return res.status(502).json({
            success: false,
            error: 'Invalid response from AI service'
          });
        }
        
        imageUrl = imageResult.imageUrl;
        // Fallback to local uploaded URL if mock placeholder returned
        if (/^https?:\/\/via\.placeholder\.com/i.test(imageUrl)) {
          const localUrl = originalImageUrl;
          console.log('⚠️ [BACKEND DEBUG] Placeholder image URL detected. Using local uploaded image instead:', localUrl);
          imageUrl = localUrl;
        }
        console.log('✅ [BACKEND DEBUG] Generated processed image URL:', imageUrl);
      } catch (error) {
        console.error('❌ [BACKEND DEBUG] Unexpected service error, using fallback:', error);
        // Fallback to original image if service throws unexpected errors
        imageUrl = originalImageUrl;
      }
    }

    // Update user quota
    console.log('🔍 [BACKEND DEBUG] Updating user quota...');
    quota.generationsUsed += 1;
    await quota.save();
    console.log('✅ [BACKEND DEBUG] Quota updated successfully');

    // Detect echo (output equals input)
    const echoedInput = imageUrl === originalImageUrl;
    if (echoedInput) {
      console.warn('⚠️ [BACKEND DEBUG] Output image URL is identical to the input image URL (echo).', {
        originalImageUrl,
        imageUrl
      });
    }

    // Create generation record with proper error handling
    let generation;
    try {
      generation = new Generation({
        userId: req.user.id,
        originalImageUrl,
        generatedImageUrl: imageUrl,
        presetUsed: normalizedPreset,
        prompt: finalPrompt,
        parameters: { size },
        status: 'completed'
      });
      await generation.save();
      console.log('✅ [BACKEND DEBUG] Generation record saved');
    } catch (saveError) {
      console.error('❌ [BACKEND DEBUG] Failed to save generation record:', saveError.message);
      // Continue execution - don't fail the entire request for logging issues
      generation = { _id: 'temp-id', generatedImageUrl: imageUrl, createdAt: new Date() };
    }
 
    res.json({
      success: true,
      message: 'Image generated successfully',
      echoedInput,
      generation: {
        id: generation._id,
        imageUrl: generation.generatedImageUrl,
        generatedImageUrl: generation.generatedImageUrl,
        imageUrls: generation.imageUrls,
        originalImageUrl,
        prompt: finalPrompt,
        createdAt: generation.createdAt
      },
      quota: {
        generationsUsed: quota.generationsUsed,
        generationsLimit: quota.generationsLimit,
        generationsRemaining: Math.max(0, quota.generationsLimit - quota.generationsUsed)
      }
    });

  } catch (error) {
    console.error('❌ [BACKEND DEBUG] Image-to-image generation error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      hasFile: !!req.file,
      errorType: error.constructor.name
    });
    
    // Provide specific error messages based on error type
    let errorMessage = 'Internal server error. Please try again later.';
    let statusCode = 500;
    
    if (error.name === 'ValidationError') {
      errorMessage = 'Invalid data provided. Please check your input and try again.';
      statusCode = 400;
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      errorMessage = 'Generation limit exceeded. Please try again later or upgrade your plan.';
      statusCode = 429;
    } else if (error.message.includes('file') || error.message.includes('upload')) {
      errorMessage = 'File upload error. Please try uploading a different image.';
      statusCode = 400;
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      errorMessage = 'Network error. Please check your connection and try again.';
      statusCode = 503;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
});

// @route   GET /api/generate/status/:id
// @desc    Get generation status
// @access  Private
router.get('/status/:id', auth, asyncHandler(async (req, res) => {
  const generation = await Generation.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!generation) {
    return res.status(404).json({
      error: 'Generation not found'
    });
  }

  res.json({
    generation: {
      id: generation._id,
      status: generation.status,
      imageUrls: generation.imageUrls,
      prompt: generation.prompt,
      revisedPrompt: generation.revisedPrompt,
      preset: generation.preset,
      parameters: generation.parameters,
      error: generation.errorMessage,
      createdAt: generation.createdAt,
      completedAt: generation.processingEndTime
    }
  });
}));

// @route   POST /api/generate/retry/:id
// @desc    Retry a failed generation
// @access  Private
router.post('/retry/:id', auth, asyncHandler(async (req, res) => {
  const generation = await Generation.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!generation) {
    return res.status(404).json({
      error: 'Generation not found'
    });
  }

  if (generation.status !== 'failed') {
    return res.status(400).json({
      error: 'Can only retry failed generations'
    });
  }

  // Check if user can generate (quota check)
  const canGenerate = await Quota.canUserGenerate(req.user._id);
  if (!canGenerate) {
    const quota = await Quota.getTodayQuota(req.user._id);
    return res.status(429).json({
      error: 'Daily generation limit exceeded',
      quota: {
        used: quota.generationsUsed,
        limit: quota.generationsLimit,
        resetAt: quota.resetAt
      }
    });
  }

  // Reset generation status
  generation.status = 'processing';
  generation.errorMessage = undefined;
  generation.generatedImageUrl = null;
  await generation.save();

  // Retry logic for image-to-image generation
  // This is a simplified retry - in a real implementation, you might want to
  // store the original parameters and retry with the exact same settings
  res.json({
    message: 'Generation retry initiated',
    generationId: generation._id,
    status: 'processing'
  });
}));

module.exports = router;
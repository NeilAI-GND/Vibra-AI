const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store in memory for processing

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 [UPLOAD DEBUG] File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      console.log('✅ [UPLOAD DEBUG] File type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.error('❌ [UPLOAD DEBUG] File type rejected:', file.mimetype);
      cb(new Error(`Invalid file type. Only JPEG, PNG, and WebP are allowed. Got: ${file.mimetype}`), false);
    }
  }
}).single('image');

// Middleware to process uploaded images
const processImage = async (req, res, next) => {
  console.log('🔍 [UPLOAD DEBUG] processImage middleware called');
  
  if (!req.file) {
    console.log('⚠️ [UPLOAD DEBUG] No file to process, skipping...');
    return next();
  }

  console.log('🔍 [UPLOAD DEBUG] Processing file:', {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    bufferLength: req.file.buffer ? req.file.buffer.length : 'No buffer'
  });

  try {
    // Get image metadata
    console.log('🔍 [UPLOAD DEBUG] Getting image metadata...');
    const metadata = await sharp(req.file.buffer).metadata();
    console.log('✅ [UPLOAD DEBUG] Image metadata:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      channels: metadata.channels,
      density: metadata.density
    });

    // Validate image dimensions
    if (metadata.width < 100 || metadata.height < 100) {
      console.error('❌ [UPLOAD DEBUG] Image too small:', { width: metadata.width, height: metadata.height });
      return res.status(400).json({
        error: 'Image too small',
        message: 'Image must be at least 100x100 pixels',
        dimensions: { width: metadata.width, height: metadata.height }
      });
    }

    if (metadata.width > 4096 || metadata.height > 4096) {
      console.log('⚠️ [UPLOAD DEBUG] Image too large, will resize:', { width: metadata.width, height: metadata.height });
    }

    // Process the image
    let processedBuffer;
    let finalWidth = metadata.width;
    let finalHeight = metadata.height;

    if (metadata.width > 4096 || metadata.height > 4096) {
      console.log('🔍 [UPLOAD DEBUG] Resizing large image...');
      // Resize while maintaining aspect ratio
      const maxDimension = 4096;
      const aspectRatio = metadata.width / metadata.height;
      
      if (metadata.width > metadata.height) {
        finalWidth = maxDimension;
        finalHeight = Math.round(maxDimension / aspectRatio);
      } else {
        finalHeight = maxDimension;
        finalWidth = Math.round(maxDimension * aspectRatio);
      }

      processedBuffer = await sharp(req.file.buffer)
        .resize(finalWidth, finalHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
        
      console.log('✅ [UPLOAD DEBUG] Image resized to:', { width: finalWidth, height: finalHeight });
    } else {
      console.log('🔍 [UPLOAD DEBUG] Converting image to optimized JPEG...');
      // Convert to optimized JPEG
      processedBuffer = await sharp(req.file.buffer)
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      console.log('✅ [UPLOAD DEBUG] Image converted to JPEG');
    }

    // Generate unique filename
    const filename = `${uuidv4()}.jpg`;
    const filepath = path.join(uploadDir, filename);

    console.log('🔍 [UPLOAD DEBUG] Saving processed image:', {
      filename,
      filepath,
      processedSize: processedBuffer.length,
      originalSize: req.file.size
    });

    // Save processed image to disk
    await fs.writeFile(filepath, processedBuffer);
    console.log('✅ [UPLOAD DEBUG] Image saved to disk');

    // Update req.file with processed image info
    req.file.buffer = processedBuffer;
    req.file.filename = filename;
    req.file.path = filepath;
    req.file.size = processedBuffer.length;
    req.file.mimetype = 'image/jpeg';
    
    // Add metadata to req.file
    req.file.metadata = {
      width: finalWidth,
      height: finalHeight,
      format: 'jpeg',
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      originalFormat: metadata.format
    };

    console.log('✅ [UPLOAD DEBUG] File processing completed successfully:', {
      filename: req.file.filename,
      finalSize: req.file.size,
      dimensions: `${finalWidth}x${finalHeight}`
    });

    next();

  } catch (error) {
    console.error('❌ [UPLOAD DEBUG] Image processing error:', {
      message: error.message,
      stack: error.stack,
      originalFile: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'No file'
    });

    return res.status(400).json({
      error: 'Image processing failed',
      message: error.message
    });
  }
};

// Middleware to validate base64 image data
const validateBase64Image = async (req, res, next) => {
  console.log('🔍 [UPLOAD DEBUG] validateBase64Image middleware called');
  
  const { imageData } = req.body;
  
  if (!imageData) {
    console.error('❌ [UPLOAD DEBUG] No image data provided');
    return res.status(400).json({
      error: 'Image data is required'
    });
  }

  console.log('🔍 [UPLOAD DEBUG] Validating base64 image data, length:', imageData.length);

  try {
    // Check if it's a valid base64 data URL
    const base64Regex = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/;
    const match = imageData.match(base64Regex);
    
    if (!match) {
      console.error('❌ [UPLOAD DEBUG] Invalid base64 format');
      return res.status(400).json({
        error: 'Invalid image format',
        message: 'Image must be a valid base64 data URL'
      });
    }

    const [, format, base64Data] = match;
    console.log('✅ [UPLOAD DEBUG] Base64 format validated:', format);

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    console.log('🔍 [UPLOAD DEBUG] Base64 converted to buffer, size:', buffer.length);

    // Check file size (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      console.error('❌ [UPLOAD DEBUG] File too large:', buffer.length);
      return res.status(400).json({
        error: 'File too large',
        message: 'Image must be less than 10MB',
        size: buffer.length
      });
    }

    // Save buffer to req for further processing
    req.imageBuffer = buffer;
    req.imageFormat = format;
    
    console.log('✅ [UPLOAD DEBUG] Base64 validation completed');
    next();

  } catch (error) {
    console.error('❌ [UPLOAD DEBUG] Base64 validation error:', {
      message: error.message,
      stack: error.stack
    });
    
    return res.status(400).json({
      error: 'Invalid image data',
      message: error.message
    });
  }
};

// Middleware to save base64 image to file
const saveBase64Image = async (req, res, next) => {
  console.log('🔍 [UPLOAD DEBUG] saveBase64Image middleware called');
  
  if (!req.imageBuffer) {
    console.log('⚠️ [UPLOAD DEBUG] No image buffer to save, skipping...');
    return next();
  }

  try {
    // Generate unique filename
    const filename = `${uuidv4()}.jpg`;
    const filepath = path.join(uploadDir, filename);

    console.log('🔍 [UPLOAD DEBUG] Processing base64 image:', {
      filename,
      bufferSize: req.imageBuffer.length,
      format: req.imageFormat
    });

    // Process image with Sharp
    const processedBuffer = await sharp(req.imageBuffer)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    console.log('🔍 [UPLOAD DEBUG] Image processed, saving to disk...');

    // Save to disk
    await fs.writeFile(filepath, processedBuffer);

    // Create file object similar to multer
    req.file = {
      fieldname: 'image',
      originalname: `upload.${req.imageFormat}`,
      encoding: 'base64',
      mimetype: 'image/jpeg',
      buffer: processedBuffer,
      size: processedBuffer.length,
      filename,
      path: filepath
    };

    console.log('✅ [UPLOAD DEBUG] Base64 image saved successfully:', {
      filename: req.file.filename,
      size: req.file.size
    });

    next();

  } catch (error) {
    console.error('❌ [UPLOAD DEBUG] Base64 save error:', {
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Failed to save image',
      message: error.message
    });
  }
};

// Cleanup middleware to remove uploaded files on error
const cleanupOnError = (req, res, next) => {
  console.log('🔍 [UPLOAD DEBUG] cleanupOnError middleware called');
  
  const originalSend = res.send;
  
  res.send = function(data) {
    // If there's an error status and we have a file, clean it up
    if (res.statusCode >= 400 && req.file && req.file.path) {
      console.log('⚠️ [UPLOAD DEBUG] Cleaning up file on error:', req.file.path);
      try {
        fs.unlink(req.file.path).catch(err => {
          console.error('❌ [UPLOAD DEBUG] File cleanup error:', err.message);
        });
      } catch (cleanupError) {
        console.error('❌ [UPLOAD DEBUG] File cleanup error:', cleanupError.message);
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  upload: upload,
  processImage,
  validateBase64Image,
  saveBase64Image,
  cleanupOnError
};
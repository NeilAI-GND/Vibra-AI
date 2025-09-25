const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
  }

  async generateImage(prompt, options = {}) {
    try {
      const {
        width = 1024,
        height = 1024,
        size = '1024x1024',
        quality = 'standard',
        style = 'natural'
      } = options;

      // Privacy-safe payload debug for image generation
      try {
        console.log('🔎 [GEMINI PAYLOAD DEBUG] Outgoing image generation request:', {
          promptLength: prompt ? prompt.length : 0,
          promptPreview: prompt ? `${prompt.substring(0, 80)}...` : undefined,
          options: { width, height, size, quality, style }
        });
      } catch (_) {}

      // Use the proper Gemini image generation API with streaming
      const contents = [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }];

      const generateContentConfig = {
        responseModalities: ['IMAGE', 'TEXT']
      };

      let imageData = null;
      let textResponse = '';
      let fileIndex = 0;

      // Generate content using non-streaming approach
      const result = await this.model.generateContent({
        contents: contents,
        generationConfig: generateContentConfig
      });

      const response = await result.response;
      
      if (response.candidates && response.candidates[0] && response.candidates[0].content) {
        const parts = response.candidates[0].content.parts;
        
        for (const part of parts) {
          // Check for image data
          if (part.inlineData && part.inlineData.data) {
            const inlineData = part.inlineData;
            const dataBuffer = Buffer.from(inlineData.data, 'base64');
            
            // Generate unique filename
            const fileId = crypto.randomUUID();
            const mimeType = inlineData.mimeType || 'image/jpeg';
            const extension = mimeType.split('/')[1] || 'jpg';
            const fileName = `${fileId}.${extension}`;
            const filePath = path.join(__dirname, '../uploads', fileName);
            
            // Save the image file
            fs.writeFileSync(filePath, dataBuffer);
            
            imageData = {
              fileName: fileName,
              filePath: filePath,
              mimeType: mimeType,
              size: dataBuffer.length
            };
            break; // Take the first image found
            
            console.log('✅ [GEMINI DEBUG] Image generated and saved:', fileName);
          }
          
          // Check for text response
          if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!imageData) {
        throw new Error('No image data received from Gemini API');
      }

      // Return the generated image URL
      const imageUrl = `/uploads/${imageData.fileName}`;

      return {
        success: true,
        imageUrl: imageUrl,
        enhancedPrompt: textResponse || prompt,
        data: {
          width: width,
          height: height,
          prompt: prompt,
          enhancedPrompt: textResponse || prompt,
          fileName: imageData.fileName,
          mimeType: imageData.mimeType,
          fileSize: imageData.size
        }
      };

    } catch (error) {
      console.error('Gemini image generation error:', error);
      
      // Handle specific error types
      if (error.message?.includes('API key')) {
        throw new Error('Invalid or missing Gemini API key');
      }
      
      if (error.message?.includes('quota')) {
        throw new Error('Gemini API quota exceeded');
      }
      
      if (error.message?.includes('safety')) {
        throw new Error('Content blocked by safety filters');
      }

      // Handle SSL/TLS connection errors
      if (error.message?.includes('SSL') || 
          error.message?.includes('TLS') || 
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ENOTFOUND') ||
          error.message?.includes('certificate') ||
          error.code === 'ECONNRESET' ||
          error.code === 'ENOTFOUND') {
        console.warn('🔒 SSL/TLS connection error with Gemini API, using fallback');
        // Return a fallback response instead of throwing
        return this.generateLocalPlaceholder(1024, 1024, 'SSL Connection Error - Fallback Image');
      }

      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  async generateImageFromImage(imagePath, prompt, options = {}) {
    try {
      const {
        width = 1024,
        height = 1024,
        size = '1024x1024'
      } = options;

      // Read the uploaded image file
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Privacy-safe payload debug for image+prompt request
      try {
        const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex').slice(0, 16);
        console.log('🔎 [GEMINI PAYLOAD DEBUG] Outgoing image-to-image request:', {
          promptLength: prompt ? prompt.length : 0,
          promptPreview: prompt ? `${prompt.substring(0, 80)}...` : undefined,
          imageBytes: imageBuffer.length,
          imageBase64Length: base64Image.length,
          imageHashPrefix: imageHash,
          mimeType: 'image/jpeg',
          options: { width, height, size }
        });
      } catch (_) {}
      
      // Use the proper Gemini image generation API with input image and streaming
      const contents = [{
        role: 'user',
        parts: [
          {
            text: prompt
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }];

      const generateContentConfig = {
        responseModalities: ['IMAGE', 'TEXT']
      };

      let imageData = null;
      let textResponse = '';

      // Generate content using non-streaming approach
      const result = await this.model.generateContent({
        contents: contents,
        generationConfig: generateContentConfig
      });

      const response = await result.response;
      
      if (response.candidates && response.candidates[0] && response.candidates[0].content) {
        const parts = response.candidates[0].content.parts;
        
        for (const part of parts) {
          // Check for image data
          if (part.inlineData && part.inlineData.data) {
            const inlineData = part.inlineData;
            const dataBuffer = Buffer.from(inlineData.data, 'base64');
            
            // Generate unique filename for image-to-image
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const fileName = `gemini-i2i-${timestamp}-${randomId}.jpg`;
            const filePath = path.join(__dirname, '../uploads', fileName);
            
            // Save the image file
            fs.writeFileSync(filePath, dataBuffer);
            
            imageData = {
              fileName: fileName,
              filePath: filePath,
              mimeType: 'image/jpeg',
              size: dataBuffer.length
            };
            
            console.log('✅ [GEMINI DEBUG] Image-to-image generated and saved:', fileName);
            break; // Take the first image found
          }
          
          // Check for text response
          if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!imageData) {
        throw new Error('No image data received from Gemini API');
      }

      // Return the generated image URL
      const imageUrl = `/uploads/${imageData.fileName}`;

      return {
        success: true,
        imageUrl: imageUrl,
        enhancedPrompt: textResponse || prompt,
        data: {
          width: width,
          height: height,
          prompt: prompt,
          enhancedPrompt: textResponse || prompt,
          fileName: imageData.fileName,
          mimeType: imageData.mimeType,
          fileSize: imageData.size
        }
      };

    } catch (error) {
      console.error('Gemini image-to-image generation error:', error);
      
      // Handle specific error types
      if (error.message?.includes('API key')) {
        throw new Error('Invalid or missing Gemini API key');
      }
      
      if (error.message?.includes('quota')) {
        throw new Error('Gemini API quota exceeded');
      }
      
      if (error.message?.includes('safety')) {
        throw new Error('Content blocked by safety filters');
      }

      // Handle SSL/TLS connection errors
      if (error.message?.includes('SSL') || 
          error.message?.includes('TLS') || 
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ENOTFOUND') ||
          error.message?.includes('certificate') ||
          error.code === 'ECONNRESET' ||
          error.code === 'ENOTFOUND') {
        console.warn('🔒 SSL/TLS connection error with Gemini API, using fallback');
        // Return a fallback response instead of throwing
        return this.generateLocalPlaceholder(1024, 1024, 'SSL Connection Error - Fallback Image');
      }

      throw new Error(`Image-to-image generation failed: ${error.message}`);
    }
  }

  async validateApiKey() {
    try {
      // Test the API key with a simple request
      const result = await this.model.generateContent('Test');
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  // Get available models (for future use)
  async getAvailableModels() {
    try {
      const models = await this.genAI.listModels();
      return models.filter(model => 
        model.name.includes('gemini') && 
        model.supportedGenerationMethods?.includes('generateContent')
      );
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  // Generate local placeholder image for fallback scenarios
  async generateLocalPlaceholder(width, height, text) {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const filePath = path.join(uploadsDir, fileName);

      // Create a colorful gradient placeholder
      const colors = [
        { r: 99, g: 102, b: 241 },   // Indigo
        { r: 168, g: 85, b: 247 },   // Purple
        { r: 236, g: 72, b: 153 },   // Pink
        { r: 59, g: 130, b: 246 },   // Blue
        { r: 16, g: 185, b: 129 },   // Emerald
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      await sharp({
        create: {
          width: width,
          height: height,
          channels: 3,
          background: randomColor
        }
      })
      .jpeg({ quality: 85 })
      .toFile(filePath);

      const imageUrl = `/uploads/${fileName}`;
      console.log('✅ [GEMINI DEBUG] Local placeholder image generated:', imageUrl);

      return {
        success: true,
        imageUrl: imageUrl,
        isPlaceholder: true,
        data: {
          width: width,
          height: height,
          text: text,
          fileName: fileName,
          mimeType: 'image/jpeg',
          fileSize: fs.statSync(filePath).size
        }
      };

    } catch (error) {
      console.error('❌ [GEMINI DEBUG] Failed to generate local placeholder:', error);
      throw new Error('Failed to generate placeholder image');
    }
  }

  // Format response for frontend compatibility
  formatResponse(geminiResponse, prompt) {
    return {
      id: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      object: 'image',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-2.5-flash-image-preview',
      data: [{
        url: geminiResponse.data.image,
        revised_prompt: prompt
      }],
      usage: {
        prompt_tokens: prompt.length,
        total_tokens: prompt.length
      }
    };
  }
}

module.exports = GeminiService;
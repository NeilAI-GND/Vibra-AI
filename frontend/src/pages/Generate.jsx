import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateAPI, userAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  SparklesIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const Generate = () => {
  console.log('🔍 [DEBUG] Generate component is rendering');
  const { user, isPaidUser } = useAuth();
  console.log('🔍 [DEBUG] User from auth context:', user);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [presets, setPresets] = useState([]);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [generationType, setGenerationType] = useState('text-to-image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [quota, setQuota] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState({
    width: 1024,
    height: 1024,
    steps: 20,
    guidance: 7.5,
    seed: -1
  });
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchPresets();
    fetchQuota();

  }, []);

  const fetchPresets = async () => {
    try {
      const response = await generateAPI.getPresets();
      console.log('🔍 [DEBUG] Presets API response:', response.data);
      const presetsData = response.data.presets || [];
      setPresets(presetsData);
      
      // Extract unique categories from presets
      const uniqueCategories = [...new Set(presetsData.map(preset => preset.category))].filter(Boolean);
      console.log('🔍 [DEBUG] Extracted categories:', uniqueCategories);
      setCategories(uniqueCategories);
      
      if (presetsData.length > 0) {
        setSelectedPreset(presetsData[0]);
        // Set the first category as default if available
        if (uniqueCategories.length > 0) {
          setSelectedCategory(uniqueCategories[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching presets:', error);
      toast.error('Failed to load presets');
      // Safe fallbacks so UI still works without crashing
      const fallbackCategories = ['artistic', 'photographic', 'digital', 'abstract'];
      setCategories(fallbackCategories);
      setSelectedCategory('');
    }
  };

  const fetchQuota = async () => {
    try {
      const response = await userAPI.getQuota();
      setQuota(response.data);
    } catch (error) {
      console.error('Error fetching quota:', error);
    }
  };

  const handleImageUpload = (event) => {
    console.log('🔍 [FRONTEND DEBUG] handleImageUpload called');
    const file = event.target.files[0];
    
    if (!file) {
      console.log('⚠️ [FRONTEND DEBUG] No file selected');
      return;
    }

    console.log('🔍 [FRONTEND DEBUG] File selected:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Clear previous errors
    setUploadError('');
    setError('');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = `Invalid file type: ${file.type}. Please upload a JPEG, PNG, or WebP image.`;
      console.error('❌ [FRONTEND DEBUG] File type validation failed:', errorMsg);
      setUploadError(errorMsg);
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const errorMsg = `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 10MB.`;
      console.error('❌ [FRONTEND DEBUG] File size validation failed:', errorMsg);
      setUploadError(errorMsg);
      return;
    }

    console.log('✅ [FRONTEND DEBUG] File validation passed');

    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('🔍 [FRONTEND DEBUG] FileReader onload triggered');
      console.log('🔍 [FRONTEND DEBUG] FileReader result length:', e.target.result.length);
      
      setUploadedImage(e.target.result);
      setGenerationType('image-to-image');
      console.log('✅ [FRONTEND DEBUG] Image uploaded and generation type set to image-to-image');
    };
    
    reader.readAsDataURL(file);
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
    setGenerationType('text-to-image');
  };

  const handleGenerate = async () => {
    console.log('🔍 [FRONTEND DEBUG] handleGenerate called');

    // Reset previous errors
    setError('');

    if (!prompt || prompt.trim().length === 0) {
      setError('Please enter a prompt');
      return;
    }

    if (generationType === 'image-to-image' && !uploadedImage) {
      setError('Please upload an image for image-to-image generation');
      return;
    }

    try {
      setIsGenerating(true);
      setGeneratedImages([]);

      let response;
      
      if (generationType === 'text-to-image') {
        console.log('🔍 [FRONTEND DEBUG] Making text-to-image API call with payload:', {
          prompt: prompt?.slice(0, 200),
          preset: selectedPreset?.id,
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid'
        });
        response = await generateAPI.textToImage({
          prompt,
          preset: selectedPreset?.id,
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid'
        });
        console.log('✅ [FRONTEND DEBUG] Text-to-image API response received:', response);
      } else {
        console.log('🔍 [FRONTEND DEBUG] Making image-to-image API call');
        const formData = new FormData();
        
        // Convert base64 to blob for FormData
        const base64Response = await fetch(uploadedImage);
        const blob = await base64Response.blob();
        
        formData.append('image', blob, 'upload.jpg');
        formData.append('prompt', prompt);
        if (selectedPreset?.id) {
          formData.append('preset', selectedPreset.id);
        }
        formData.append('size', '1024x1024');

        const imageFile = formData.get('image');
        console.log('🔍 [FRONTEND DEBUG] FormData prepared for image-to-image:', {
          hasImage: formData.has('image'),
          imageType: imageFile?.type,
          imageSize: imageFile?.size,
          promptPreview: formData.get('prompt')?.slice(0, 200),
          preset: formData.get('preset'),
          size: formData.get('size')
        });

        response = await generateAPI.imageToImage(formData);
        console.log('✅ [FRONTEND DEBUG] Image-to-image API response received:', response);
      }

      const resp = response?.data ?? {};

      if (resp.success || resp.message === 'Image generated successfully') {
        // Post-process specifically for image-to-image to ensure we don't show the input as output
        if (generationType === 'image-to-image') {
          const outputUrl = resp.generation?.generatedImageUrl || resp.generation?.imageUrl;
          const originalUrl = resp.generation?.originalImageUrl;
          const echoed =
            resp.echoedInput === true ||
            (!!outputUrl && !!originalUrl && outputUrl === originalUrl);
        
          if (!outputUrl) {
            console.error('❌ [FRONTEND DEBUG] Image-to-image returned empty result. Full response:', resp);
            setError('Image generation returned no result. Please try again.');
            setIsGenerating(false);
            return;
          }
        
          if (echoed) {
            console.warn('⚠️ [FRONTEND DEBUG] Output image identical to input (echo). Logging full API response:', resp);
            setError('The AI returned the original image unchanged. Try a different prompt or preset.');
            setIsGenerating(false);
            return; // Do not show the input image as a generated result
          }
        }
        const images = resp.images || [resp.generation?.generatedImageUrl || resp.generation?.imageUrl];
        console.log('✅ [FRONTEND DEBUG] Generation successful, images:', images);
        setGeneratedImages(images.filter(Boolean));
        
        // Refresh quota after successful generation
        await fetchQuota();
        
        // Show success message with gallery link
        toast.success(
          <div>
            <p>Image generated successfully!</p>
            <button 
              onClick={() => window.location.href = '/gallery'}
              className="mt-2 text-blue-600 hover:text-blue-800 underline"
            >
              View in Gallery →
            </button>
          </div>,
          { duration: 5000 }
        );
      } else {
        const errMsg = resp.error || 'Failed to generate images. Please try again.';
        console.error('❌ [FRONTEND DEBUG] Generation failed:', resp);
        setError(errMsg);
      }
    } catch (error) {
      console.error('❌ [FRONTEND DEBUG] Error during generation:', error);
      setError(error.response?.data?.error || 'Failed to generate images. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (imageUrl, index) => {
    try {
      // Ensure we fetch from the correct backend URL for relative paths
      const fetchUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `http://localhost:5000${imageUrl}`;
      
      const response = await fetch(fetchUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract the correct file extension from the image URL
      // Handle both relative and absolute URLs properly
      let urlPath;
      if (imageUrl.startsWith('http')) {
        urlPath = new URL(imageUrl).pathname;
      } else {
        // For relative URLs like /uploads/filename.jpg
        urlPath = imageUrl;
      }
      const fileExtension = urlPath.split('.').pop() || 'jpg';
      a.download = `vibra-ai-${Date.now()}-${index + 1}.${fileExtension}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded!');
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
    }
  };

  const presetCategories = {
    'Artistic': presets.filter(p => p.category === 'artistic'),
    'Photographic': presets.filter(p => p.category === 'photographic'),
    'Digital Art': presets.filter(p => p.category === 'digital'),
    'Abstract': presets.filter(p => p.category === 'abstract')
  };

  console.log('🔍 [DEBUG] Generate component about to render, user:', user);

  if (!user) {
    console.log('🔍 [DEBUG] No user found, should redirect to login');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <SparklesIcon className="w-8 h-8 mr-3 text-blue-600" />
            Generate AI Images
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Transform your ideas into stunning visuals with our Gemini-powered image generation.
          </p>
        </div>

        {/* Quota Display */}
        {quota && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Daily Quota
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {quota.generationsUsed} / {quota.generationsLimit} used
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {quota.generationsRemaining} remaining
                </p>
                {quota.status === 'exceeded' && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Quota exceeded
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${quota.usagePercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-orange-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-orange-700 font-medium">{uploadError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Generation Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Generation Type */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Generation Type
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setGenerationType('text-to-image')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    generationType === 'text-to-image'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <SparklesIcon className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <h4 className="font-medium text-gray-900 dark:text-white">Text to Image</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Generate from text description
                  </p>
                </button>
                <button
                  onClick={() => setGenerationType('image-to-image')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    generationType === 'image-to-image'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <PhotoIcon className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <h4 className="font-medium text-gray-900 dark:text-white">Image to Image</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Transform existing image
                  </p>
                </button>
              </div>
            </div>

            {/* Image Upload (for image-to-image) */}
            {generationType === 'image-to-image' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Upload Reference Image
                </h3>
                {uploadedImage ? (
                  <div className="relative">
                    <img
                      src={uploadedImage}
                      alt="Uploaded reference"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <button
                      onClick={removeUploadedImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                  >
                    <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Click to upload an image or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Prompt Input */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Describe Your Image
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      const cat = e.target.value;
                      console.log('🔍 [DEBUG] Category selected:', cat);
                      console.log('🔍 [DEBUG] Available presets:', presets.map(p => ({ id: p.id, category: p.category })));
                      setSelectedCategory(cat);
                      const preset = presets.find(p => p.category === cat) || null;
                      console.log('🔍 [DEBUG] Found preset for category:', preset);
                      setSelectedPreset(preset);
                      setPrompt(preset?.main_prompt || '');
                      setNegativePrompt(preset?.negative_prompt || '');
                      console.log('🔍 [DEBUG] Updated selectedPreset:', preset);
                      console.log('🔍 [DEBUG] Button should be enabled:', !!preset);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt (auto-filled from selected category)
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Prompt is auto-filled from the selected category..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    rows={4}
                    readOnly
                    disabled
                    title="Prompt is auto-filled from the selected category"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="blurry, low quality, distorted..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Advanced Settings
                </h3>
                <AdjustmentsHorizontalIcon className={`w-5 h-5 text-gray-400 transition-transform ${
                  showAdvanced ? 'rotate-90' : ''
                }`} />
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Width
                    </label>
                    <input
                      type="number"
                      value={settings.width}
                      onChange={(e) => setSettings(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Height
                    </label>
                    <input
                      type="number"
                      value={settings.height}
                      onChange={(e) => setSettings(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Steps
                    </label>
                    <input
                      type="number"
                      value={settings.steps}
                      onChange={(e) => setSettings(prev => ({ ...prev, steps: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Guidance
                    </label>
                    <input
                      type="number"
                      value={settings.guidance}
                      onChange={(e) => setSettings(prev => ({ ...prev, guidance: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Seed
                    </label>
                    <input
                      type="number"
                      value={settings.seed}
                      onChange={(e) => setSettings(prev => ({ ...prev, seed: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedPreset || quota?.generationsRemaining === 0}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <LoadingSpinner className="w-5 h-5 mr-2" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    <span>Generate Images</span>
                  </>
                )}
              </button>
              {quota?.generationsRemaining === 0 && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center">
                  <CheckCircleIcon className="w-4 h-4 mr-1 text-red-500" />
                  You've reached your daily limit. Upgrade to Pro for more generations.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar - Presets (hidden for now) */}
          <div className="lg:col-span-1 space-y-6 hidden">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Preset Categories
              </h3>
              <div className="space-y-4">
                {Object.entries(presetCategories).map(([category, categoryPresets]) => (
                  categoryPresets.length > 0 && (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {categoryPresets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setSelectedPreset(preset)}
                            className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                              selectedPreset?.id === preset.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white text-xs font-medium">
                                  {preset.name.charAt(0)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {preset.name}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {preset.description}
                                </p>
                              </div>
                              {selectedPreset?.id === preset.id && (
                                <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Generated Images
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedImages.map((imageUrl, index) => (
                <div
                  key={`generated-${imageUrl}-${index}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group"
                >
                  <div className="aspect-square relative">
                    <img
                      src={imageUrl}
                      alt={`Generated image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                      <button
                        onClick={() => downloadImage(imageUrl, index)}
                        className="opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generate;
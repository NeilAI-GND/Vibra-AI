import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { generateAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  PhotoIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const Gallery = () => {
  const { user } = useAuth();
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedImage, setSelectedImage] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('all');

  useEffect(() => {
    // Load presets for filtering
    const loadPresets = async () => {
      try {
        const res = await generateAPI.getPresets();
        const list = res?.data?.presets || [];
        setPresets(list);
      } catch (e) {
        console.error('Failed to load presets for gallery filter:', e);
      }
    };
    loadPresets();
  }, []);

  useEffect(() => {
    fetchGenerations(true);
  }, [searchTerm, filterStatus, sortBy, selectedPreset]);

  const fetchGenerations = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const res = await userAPI.getGenerations({
        page: currentPage,
        limit: 12,
        search: searchTerm,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy: sortBy,
        preset: selectedPreset === 'all' ? undefined : selectedPreset
      });

      const data = res?.data || {};
      const newGenerations = data.generations || [];
      
      if (reset) {
        setGenerations(newGenerations);
      } else {
        setGenerations(prev => [...prev, ...newGenerations]);
      }
      
      setHasMore(data.pagination?.hasNext || false);
      if (!reset) {
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching generations:', error);
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleDelete = async (generationId) => {
    if (!window.confirm('Are you sure you want to delete this generation?')) {
      return;
    }

    try {
      await userAPI.deleteGeneration(generationId);
      setGenerations(prev => prev.filter(gen => gen._id !== generationId));
      toast.success('Generation deleted successfully');
    } catch (error) {
      console.error('Error deleting generation:', error);
      toast.error('Failed to delete generation');
    }
  };

  const downloadImage = async (imageUrl, prompt, index = 0) => {
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
      const filename = `${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_${index + 1}.${fileExtension}`;
      a.download = filename;
      
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const filteredGenerations = generations.filter(generation => {
    const matchesSearch = generation.prompt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || generation.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading gallery..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <PhotoIcon className="w-8 h-8 mr-3 text-purple-600" />
            Your Gallery
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Browse and manage your Gemini-generated artwork collection.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by prompt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Preset Filter */}
            <div>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Presets</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="prompt">By Prompt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredGenerations.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredGenerations.map((generation) => (
                <div
                  key={generation._id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group hover:shadow-md transition-all duration-200"
                >
                  {/* Image */}
                  <div className="aspect-square relative bg-gray-100 dark:bg-gray-700">
                    {generation.imageUrls && generation.imageUrls.length > 0 ? (
                      <>
                        <img
                          src={generation.imageUrls[0]}
                          alt={generation.prompt}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setSelectedImage(generation)}
                        />
                        {generation.imageUrls.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                            +{generation.imageUrls.length - 1}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PhotoIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedImage(generation)}
                          className="p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {generation.imageUrls && generation.imageUrls.length > 0 && (
                          <button
                            onClick={() => downloadImage(generation.imageUrls[0], generation.prompt)}
                            className="p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Download"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(generation._id)}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <p className="text-sm text-gray-900 dark:text-white font-medium line-clamp-2 mb-2">
                      {generation.prompt}
                    </p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(generation.status)}`}>
                        {generation.status}
                      </span>
                      {generation.preset && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {generation.preset.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {formatDate(generation.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchGenerations(false)}
                  disabled={loadingMore}
                  className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Loading...</span>
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <PhotoIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              No images found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters.' 
                : 'Start creating amazing Gemini artwork to build your gallery!'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => window.location.href = '/generate'}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200"
              >
                <SparklesIcon className="w-5 h-5 mr-2" />
                Generate Your First Image
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Generation Details
                </h3>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Images */}
              {selectedImage.imageUrls && selectedImage.imageUrls.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {selectedImage.imageUrls.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`Generated image ${index + 1}`}
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => downloadImage(imageUrl, selectedImage.prompt, index)}
                        className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt
                  </label>
                  <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    {selectedImage.prompt}
                  </p>
                </div>
                
                {selectedImage.negativePrompt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Negative Prompt
                    </label>
                    <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      {selectedImage.negativePrompt}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedImage.status)}`}>
                      {selectedImage.status}
                    </span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Created
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {formatDate(selectedImage.createdAt)}
                    </p>
                  </div>
                  
                  {selectedImage.preset && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Preset
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedImage.preset.name}
                      </p>
                    </div>
                  )}
                  
                  {selectedImage.metadata && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dimensions
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedImage.metadata.width} × {selectedImage.metadata.height}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
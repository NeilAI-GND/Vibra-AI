import axios from 'axios';
import toast from 'react-hot-toast';

// Prefer Vite dev proxy in development to avoid CORS
const baseURL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL || '/api');

// Create axios instance
const api = axios.create({
  baseURL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }

    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }

    return response;
  },
  (error) => {
    // Log error in development
    if (import.meta.env.DEV) {
      console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.response?.data);
    }

    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          
          // Only redirect to login if not already on auth pages
          if (!window.location.pathname.includes('/login') && 
              !window.location.pathname.includes('/register')) {
            window.location.href = '/login';
            toast.error('Session expired. Please login again.');
          }
          break;

        case 403:
          // Forbidden
          toast.error(data.error || 'Access denied');
          break;

        case 404:
          // Not found
          if (!error.config.url.includes('/auth/me')) {
            toast.error(data.error || 'Resource not found');
          }
          break;

        case 429:
          // Rate limit exceeded
          toast.error(data.error || 'Too many requests. Please try again later.');
          break;

        case 500:
          // Server error
          toast.error('Server error. Please try again later.');
          break;

        default:
          // Other errors
          if (data.error) {
            toast.error(data.error);
          }
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      // Other error
      toast.error('An unexpected error occurred.');
    }

    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data),
  deleteAccount: (password) => api.delete('/auth/account', { data: { password } }),
};

export const userAPI = {
  getQuota: () => api.get('/user/quota'),
  getGenerations: (params) => api.get('/user/generations', { params }),
  getGeneration: (id) => api.get(`/user/generations/${id}`),
  deleteGeneration: (id) => api.delete(`/user/generations/${id}`),
  getStats: () => api.get('/user/stats'),
  getTierInfo: () => api.get('/user/tier-info'),
  upgrade: () => api.post('/user/upgrade'),
};

export const generateAPI = {
  getPresets: () => api.get('/generate/presets'),
  textToImage: (data) => api.post('/generate/text-to-image', data),
  imageToImage: (formData) => api.post('/generate/image-to-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getStatus: (id) => api.get(`/generate/status/${id}`),
  retry: (id) => api.post(`/generate/retry/${id}`),
};

export const adminAPI = {
  getUsers: (params) => api.get('/user/admin/users', { params }),
  updateUserTier: (userId, tier) => api.put(`/user/admin/users/${userId}/tier`, { tier }),
  updateUserStatus: (userId, isActive) => api.put(`/user/admin/users/${userId}/status`, { isActive }),
};

// Utility functions
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
};

// File upload helper
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// Health check
export const healthCheck = () => api.get('/health');

// Export both default and named export for compatibility
export { api };
export default api;
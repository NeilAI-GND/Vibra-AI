import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  SparklesIcon,
  PhotoIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  CreditCardIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
  const { user, isPaidUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentGenerations, setRecentGenerations] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  // Utility to normalize image URLs (handles missing leading slash)
  const normalizeImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads/')) return url;
    if (url.startsWith('uploads/')) return `/${url}`;
    return url;
  };

  const getInitialImageSrc = (generation) => {
    const candidate = generation?.imageUrls?.[0] || generation?.generatedImageUrl || '';
    const normalized = normalizeImageUrl(candidate);
    return normalized.startsWith('http') ? normalized : `/uploads/${normalized.replace(/^\/uploads\//, '')}`;
  };

  const handleImageError = (e, generation) => {
    const img = e.currentTarget;
    const attempts = Number(img.dataset.retry || 0);
    const originalCandidate = generation?.imageUrls?.[0] || generation?.generatedImageUrl || '';
    const pathname = originalCandidate.startsWith('http')
      ? new URL(originalCandidate).pathname
      : `/${originalCandidate.replace(/^\/?/, '')}`;

    if (attempts === 0) {
      img.src = `http://localhost:5000${pathname.startsWith('/uploads/') ? pathname : `/uploads/${pathname.replace(/^\/uploads\//, '')}`}`;
      img.dataset.retry = '1';
      return;
    }

    if (attempts === 1) {
      img.src = `${pathname.startsWith('/uploads/') ? pathname : `/uploads/${pathname.replace(/^\/uploads\//, '')}`}`;
      img.dataset.retry = '2';
      return;
    }

    img.style.display = 'none';
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, generationsRes, quotaRes] = await Promise.all([
        userAPI.getStats(),
        userAPI.getGenerations({ limit: 6 }),
        userAPI.getQuota()
      ]);
      
      // Map backend stats shape to the UI's expected shape
      const s = statsRes?.data?.stats || {};
      setStats({
        totalGenerations: s?.total?.generations ?? 0,
        successRate: s?.total?.successRate ?? 0
      });
      const gens = (generationsRes.data.generations || []).map((gen) => {
        const urls = Array.isArray(gen.imageUrls) && gen.imageUrls.length > 0
          ? gen.imageUrls
          : (gen.generatedImageUrl ? [gen.generatedImageUrl] : []);
        return { ...gen, imageUrls: urls };
      });
      setRecentGenerations(gens);
      // Quota endpoint returns { quota: { ... }, user: { ... } }
      setQuota(quotaRes?.data?.quota || null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  const quickActions = [
    {
      name: 'Generate Image',
      description: 'Create new Gemini-powered artwork',
      href: '/generate',
      icon: SparklesIcon,
      color: 'from-blue-500 to-purple-600',
      disabled: quota?.generationsRemaining === 0
    },
    // Removed 'View Gallery' quick action
    {
      name: 'Upgrade Plan',
      description: 'Get more generations',
      href: '/pricing',
      icon: CreditCardIcon,
      color: 'from-yellow-500 to-orange-600',
      hidden: isPaidUser()
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Here's what's happening with your Gemini-powered creations today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Generations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Generations
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.totalGenerations || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Today's Usage
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {quota?.generationsUsed || 0} / {quota?.generationsLimit || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Success Rate
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.successRate || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Account Tier */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isPaidUser() 
                    ? 'bg-yellow-100 dark:bg-yellow-900' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <UserGroupIcon className={`w-5 h-5 ${
                    isPaidUser() 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Account Tier
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {isPaidUser() ? 'Pro' : 'Free'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.filter(action => !action.hidden).map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.name}
                  to={action.href}
                  className={`
                    relative group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200
                    ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
                  `}
                  onClick={(e) => action.disabled && e.preventDefault()}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {action.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  {action.disabled && (
                    <div className="absolute inset-0 bg-gray-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-1 rounded-full">
                        Quota Exceeded
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Generations */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recent Generations
            </h2>
            {/* Gallery link removed */}
          </div>
          
          {recentGenerations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentGenerations.map((generation) => (
                <div
                  key={generation._id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700">
                    {generation.imageUrls?.[0] ? (
                      <img
                        src={getInitialImageSrc(generation)}
                        alt={generation.prompt}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageError(e, generation)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PhotoIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate mb-2">
                      {generation.prompt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(generation.status)}`}>
                        {generation.status}
                      </span>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <ClockIcon className="w-3 h-3 mr-1" />
                        {formatDate(generation.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No generations yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start creating amazing Gemini artwork today!
              </p>
              <Link
                to="/generate"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200"
              >
                <SparklesIcon className="w-4 h-4 mr-2" />
                Generate Your First Image
              </Link>
            </div>
          )}
        </div>

        {/* Quota Usage */}
        {quota && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Daily Quota Usage
              </h3>
              <ChartBarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Used today</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {quota.generationsUsed} / {quota.generationsLimit}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${quota.usagePercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{quota.generationsRemaining} remaining</span>
                <span>Resets at midnight</span>
              </div>
            </div>
            {quota.status === 'exceeded' && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">
                  You've reached your daily limit. Upgrade to Pro for unlimited generations!
                </p>
                <Link
                  to="/pricing"
                  className="mt-2 inline-flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  View pricing plans →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
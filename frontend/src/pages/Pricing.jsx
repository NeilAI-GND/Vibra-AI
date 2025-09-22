import React from 'react';
import {
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const Pricing = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center">
            <CurrencyDollarIcon className="w-10 h-10 mr-3 text-purple-600" />
            Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Simple, transparent pricing for everyone
          </p>
        </div>

        {/* Current Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-6">
              <SparklesIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Currently Free to Use!
            </h2>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1 mr-3 flex-shrink-0" />
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Important Notice
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                    The app is currently free to use with a limit of 5 images per day. 
                    We are working on implementing a billing system and will keep you updated on its progress.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Features */}
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  What's Included (Free)
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">5 images per day</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">AI-powered image generation</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Gallery management</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">High-quality downloads</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Multiple art styles</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Coming Soon
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <ClockIcon className="w-5 h-5 text-yellow-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Premium subscription plans</span>
                  </li>
                  <li className="flex items-center">
                    <ClockIcon className="w-5 h-5 text-yellow-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Unlimited daily generations</span>
                  </li>
                  <li className="flex items-center">
                    <ClockIcon className="w-5 h-5 text-yellow-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Priority processing</span>
                  </li>
                  <li className="flex items-center">
                    <ClockIcon className="w-5 h-5 text-yellow-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Advanced customization</span>
                  </li>
                  <li className="flex items-center">
                    <ClockIcon className="w-5 h-5 text-yellow-500 mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Commercial usage rights</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Development Status */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-8 border border-purple-200 dark:border-purple-800">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Stay Updated
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              We're actively developing our billing system to provide you with flexible pricing options. 
              Follow our progress and be the first to know when premium features become available.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => window.location.href = '/generate'}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200"
              >
                <SparklesIcon className="w-5 h-5 mr-2" />
                Start Creating Now
              </button>
              <button 
                onClick={() => window.location.href = '/profile'}
                className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
              >
                View Your Usage
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
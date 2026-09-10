import React from 'react';
import { FiLoader, FiRefreshCw } from 'react-icons/fi';

const LoadingSpinner = ({ 
  size = 'md', 
  text = 'Loading...', 
  fullScreen = false,
  showRetry = false,
  onRetry = null,
  timeout = 10000
}) => {
  const [showTimeoutMessage, setShowTimeoutMessage] = React.useState(false);

  React.useEffect(() => {
    if (timeout) {
      const timer = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout]);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const containerClasses = fullScreen 
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    : 'flex flex-col items-center justify-center';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className="relative">
          <FiLoader 
            className={`animate-spin ${sizeClasses[size]} text-blue-600`}
          />
          {showTimeoutMessage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <FiRefreshCw className={`${sizeClasses[size]} text-orange-500 animate-pulse`} />
            </div>
          )}
        </div>
        
        {text && (
          <p className={`mt-2 text-gray-600 ${fullScreen ? 'text-white' : ''}`}>
            {showTimeoutMessage ? 'Taking longer than expected...' : text}
          </p>
        )}

        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FiRefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

// Skeleton loading components
export const SkeletonCard = () => (
  <div className="bg-white rounded-lg shadow p-4 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
    <div className="space-y-2">
      <div className="h-2 bg-gray-200 rounded"></div>
      <div className="h-2 bg-gray-200 rounded w-5/6"></div>
      <div className="h-2 bg-gray-200 rounded w-4/6"></div>
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5 }) => (
  <div className="bg-white rounded-lg shadow overflow-hidden">
    <div className="h-10 bg-gray-200 animate-pulse"></div>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="flex border-b animate-pulse">
        <div className="flex-1 h-8 bg-gray-200 m-2 rounded"></div>
        <div className="flex-1 h-8 bg-gray-200 m-2 rounded"></div>
        <div className="flex-1 h-8 bg-gray-200 m-2 rounded"></div>
        <div className="flex-1 h-8 bg-gray-200 m-2 rounded"></div>
      </div>
    ))}
  </div>
);

export const SkeletonForm = () => (
  <div className="bg-white rounded-lg shadow p-6 space-y-4 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
    <div className="h-10 bg-gray-200 rounded"></div>
    <div className="h-10 bg-gray-200 rounded"></div>
    <div className="h-24 bg-gray-200 rounded"></div>
    <div className="h-10 bg-gray-200 rounded w-1/3"></div>
  </div>
);

export default LoadingSpinner;

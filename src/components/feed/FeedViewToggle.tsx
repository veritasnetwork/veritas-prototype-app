'use client';

import React from 'react';
import { ViewMode } from '@/types/belief.types';
import { List, LayoutGrid } from 'lucide-react';

interface FeedViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export const FeedViewToggle: React.FC<FeedViewToggleProps> = ({
  currentView,
  onViewChange,
  className = ''
}) => {
  const toggleView = () => {
    onViewChange(currentView === 'feed' ? 'grid' : 'feed');
  };

  return (
    <div className={`flex items-center ${className}`}>
      <button
        onClick={toggleView}
        className="
          relative inline-flex items-center px-4 py-2 text-sm font-medium
          bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-all duration-200 ease-in-out
        "
        aria-label={`Switch to ${currentView === 'feed' ? 'grid' : 'feed'} view`}
      >
        <div className="flex items-center gap-2">
          {/* Feed Icon */}
          <div className={`flex items-center gap-1 transition-all duration-200 ${
            currentView === 'feed' 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Feed</span>
          </div>
          
          {/* Toggle Switch */}
          <div className="relative w-10 h-5 mx-2">
            <div className={`
              absolute inset-0 rounded-full transition-colors duration-200
              ${currentView === 'feed' 
                ? 'bg-blue-100 dark:bg-blue-900/30' 
                : 'bg-gray-100 dark:bg-gray-700'
              }
            `} />
            <div className={`
              absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-200
              ${currentView === 'feed' 
                ? 'translate-x-0 bg-blue-600' 
                : 'translate-x-5 bg-gray-600'
              }
            `} />
          </div>
          
          {/* Grid Icon */}
          <div className={`flex items-center gap-1 transition-all duration-200 ${
            currentView === 'grid' 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Grid</span>
          </div>
        </div>
      </button>
    </div>
  );
};

// Alternative compact version for mobile
export const FeedViewToggleCompact: React.FC<FeedViewToggleProps> = ({
  currentView,
  onViewChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ${className}`}>
      <button
        onClick={() => onViewChange('feed')}
        className={`
          flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
          ${currentView === 'feed'
            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }
        `}
      >
        <List className="w-4 h-4" />
        <span>Feed</span>
      </button>
      
      <button
        onClick={() => onViewChange('grid')}
        className={`
          flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
          ${currentView === 'grid'
            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }
        `}
      >
        <LayoutGrid className="w-4 h-4" />
        <span>Grid</span>
      </button>
    </div>
  );
};

// Single icon toggle for very compact spaces
export const FeedViewToggleIcon: React.FC<FeedViewToggleProps> = ({
  currentView,
  onViewChange,
  className = ''
}) => {
  const toggleView = () => {
    onViewChange(currentView === 'feed' ? 'grid' : 'feed');
  };

  return (
    <button
      onClick={toggleView}
      className={`
        p-2 rounded-lg transition-all duration-200
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${className}
      `}
      aria-label={`Switch to ${currentView === 'feed' ? 'grid' : 'feed'} view`}
    >
      {currentView === 'feed' ? (
        <LayoutGrid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      ) : (
        <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      )}
    </button>
  );
}; 
'use client';

import React from 'react';
import { 
  FileText, 
  MessageSquare, 
  Users, 
  BookOpen, 
  Search,
  Filter,
  Inbox,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { ContentType } from '@/types/content.types';

interface EmptyStateProps {
  type?: ContentType | 'all' | 'search' | 'filtered';
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'all',
  message,
  actionLabel,
  onAction
}) => {
  const getIcon = () => {
    switch (type) {
      case 'news':
        return <FileText className="w-12 h-12 text-blue-500 dark:text-blue-400" />;
      case 'opinion':
        return <MessageSquare className="w-12 h-12 text-purple-500 dark:text-purple-400" />;
      case 'conversation':
        return <Users className="w-12 h-12 text-green-500 dark:text-green-400" />;
      case 'blog':
        return <BookOpen className="w-12 h-12 text-orange-500 dark:text-orange-400" />;
      case 'search':
        return <Search className="w-12 h-12 text-gray-500 dark:text-gray-400" />;
      case 'filtered':
        return <Filter className="w-12 h-12 text-gray-500 dark:text-gray-400" />;
      default:
        return <Inbox className="w-12 h-12 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'news':
        return 'No news articles available at the moment';
      case 'opinion':
        return 'No opinion polls to show right now';
      case 'conversation':
        return 'No active conversations yet';
      case 'blog':
        return 'No blog posts available';
      case 'search':
        return 'No results found for your search';
      case 'filtered':
        return 'No content matches your current filters';
      default:
        return 'No content available';
    }
  };

  const getSuggestion = () => {
    switch (type) {
      case 'news':
        return 'Check back later for the latest news and updates';
      case 'opinion':
        return 'Be the first to share your opinion when new polls arrive';
      case 'conversation':
        return 'Start a new conversation or wait for others to begin';
      case 'blog':
        return 'New blog posts are added regularly';
      case 'search':
        return 'Try adjusting your search terms or filters';
      case 'filtered':
        return 'Try removing some filters to see more content';
      default:
        return 'Content will appear here when available';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
            {getIcon()}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {message || getDefaultMessage()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {getSuggestion()}
          </p>
        </div>

        {/* Action Button */}
        {(actionLabel || onAction) && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-6 py-3 bg-veritas-blue hover:bg-veritas-dark-blue text-white rounded-lg transition-colors"
          >
            {actionLabel || 'Refresh'}
          </button>
        )}
      </div>
    </div>
  );
};

// Loading state for filtered views
export const FilteredViewLoading: React.FC<{ contentType?: ContentType }> = ({ contentType }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-veritas-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Loading {contentType || 'content'}...
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Applying filters and ranking by algorithm
          </p>
        </div>
      </div>
    </div>
  );
};

// No algorithm selected state
export const NoAlgorithmState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
            <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            No Algorithm Selected
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select an algorithm to start ranking and filtering content
          </p>
        </div>
        <button
          onClick={() => {
            // Trigger algorithm picker
            const event = new CustomEvent('openAlgorithmPicker');
            window.dispatchEvent(event);
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all shadow-lg hover:shadow-xl"
        >
          <TrendingUp className="w-4 h-4" />
          Choose Algorithm
        </button>
      </div>
    </div>
  );
};

// Content type specific empty states with illustrations
export const ContentTypeEmptyState: React.FC<{ 
  contentType: ContentType;
  onClearFilter?: () => void;
}> = ({ contentType, onClearFilter }) => {
  const illustrations = {
    news: (
      <div className="relative w-32 h-32 mx-auto mb-6">
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-lg transform rotate-3"></div>
        <div className="absolute inset-0 bg-blue-200 dark:bg-blue-800/30 rounded-lg transform -rotate-3"></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
          <div className="space-y-2">
            <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
            <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mt-3"></div>
          </div>
        </div>
      </div>
    ),
    opinion: (
      <div className="relative w-32 h-32 mx-auto mb-6">
        <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full w-32 h-32 flex items-center justify-center">
          <div className="text-4xl font-bold text-purple-500 dark:text-purple-400">?</div>
        </div>
      </div>
    ),
    conversation: (
      <div className="relative w-32 h-32 mx-auto mb-6">
        <div className="flex justify-center items-center gap-2">
          <div className="w-10 h-10 bg-green-200 dark:bg-green-800/30 rounded-full"></div>
          <div className="w-12 h-12 bg-green-300 dark:bg-green-700/30 rounded-full"></div>
          <div className="w-10 h-10 bg-green-200 dark:bg-green-800/30 rounded-full"></div>
        </div>
      </div>
    ),
    blog: (
      <div className="relative w-32 h-32 mx-auto mb-6">
        <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 transform -rotate-6">
          <div className="space-y-2">
            <div className="h-3 bg-orange-300 dark:bg-orange-700 rounded w-full"></div>
            <div className="h-2 bg-orange-200 dark:bg-orange-800 rounded w-full"></div>
            <div className="h-2 bg-orange-200 dark:bg-orange-800 rounded w-3/4"></div>
            <div className="h-2 bg-orange-200 dark:bg-orange-800 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  };

  const messages = {
    news: 'No news articles match your current filters',
    opinion: 'No opinion polls available with these filters',
    conversation: 'No conversations found with current settings',
    blog: 'No blog posts match your criteria'
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="max-w-md w-full text-center">
        {illustrations[contentType]}
        
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {messages[contentType]}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Try adjusting your filters or check back later for new content
        </p>
        
        {onClearFilter && (
          <button
            onClick={onClearFilter}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm text-veritas-blue dark:text-veritas-light-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
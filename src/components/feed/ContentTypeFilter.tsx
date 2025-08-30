'use client';

import React from 'react';
import { ContentType } from '@/types/content.types';
import { useFeed } from '@/contexts/FeedContext';
import { FileText, MessageSquare, Users, BookOpen } from 'lucide-react';

interface ContentTypeFilterProps {
  className?: string;
}

export const ContentTypeFilter: React.FC<ContentTypeFilterProps> = ({ className = '' }) => {
  const { contentTypeFilter, setContentTypeFilter } = useFeed();

  const filterOptions: Array<{ value: ContentType | 'all'; label: string; icon: React.ReactNode }> = [
    { value: 'all', label: 'All', icon: null },
    { value: 'news', label: 'News', icon: <FileText className="h-4 w-4" /> },
    { value: 'opinion', label: 'Opinion', icon: <MessageSquare className="h-4 w-4" /> },
    { value: 'conversation', label: 'Conversation', icon: <Users className="h-4 w-4" /> },
    { value: 'blog', label: 'Blog', icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {filterOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => setContentTypeFilter(option.value)}
          className={`
            px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200
            ${contentTypeFilter === option.value
              ? 'bg-veritas-blue text-white shadow-md'
              : 'bg-white dark:bg-veritas-darker-blue text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-veritas-dark-blue'
            }
            border ${contentTypeFilter === option.value
              ? 'border-veritas-blue'
              : 'border-gray-200 dark:border-gray-700'
            }
          `}
        >
          {option.icon}
          <span className="text-sm font-medium">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

// Compact dot-based filter for PremierHeader
export const ContentTypeDotFilter: React.FC<ContentTypeFilterProps> = ({ className = '' }) => {
  const { contentTypeFilter, setContentTypeFilter } = useFeed();

  const filterOptions: Array<{ value: ContentType | 'all'; label: string; color: string }> = [
    { value: 'all', label: 'All', color: 'bg-gray-400' },
    { value: 'news', label: 'News', color: 'bg-blue-500' },
    { value: 'opinion', label: 'Opinion', color: 'bg-purple-500' },
    { value: 'conversation', label: 'Conversation', color: 'bg-green-500' },
    { value: 'blog', label: 'Blog', color: 'bg-orange-500' },
  ];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {filterOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => setContentTypeFilter(option.value)}
          className="group relative"
          title={option.label}
        >
          <div 
            className={`
              w-3 h-3 rounded-full transition-all duration-200
              ${contentTypeFilter === option.value
                ? `${option.color} scale-125 ring-2 ring-white dark:ring-gray-800 ring-offset-2 ring-offset-transparent`
                : `${option.color} opacity-40 hover:opacity-70`
              }
            `}
          />
          <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};
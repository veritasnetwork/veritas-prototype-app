/**
 * PostHeader Component
 * Displays author information and relevance score
 */

'use client';

import { useState } from 'react';
import type { Author } from '@/types/post.types';
import { formatRelativeTime } from '@/utils/formatters';

interface PostHeaderProps {
  author: Author;
  relevanceScore: number;
  timestamp: Date;
}

export function PostHeader({ author, relevanceScore: initialScore, timestamp }: PostHeaderProps) {
  const [relevanceScore, setRelevanceScore] = useState(initialScore);

  return (
    <div className="flex items-center mb-4">
      {/* Relevance Score */}
      <div className="relative w-10 h-10 mr-3">
        <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="rgb(245 245 245)"
            strokeWidth="3"
            className="dark:stroke-neutral-800"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="rgb(147 197 253)"
            strokeWidth="3"
            strokeDasharray={`${relevanceScore}, 100`}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-veritas-light-blue font-sans">
            {relevanceScore}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={relevanceScore}
          onChange={(e) => setRelevanceScore(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full"
          aria-label="Adjust relevance score"
        />
      </div>

      {/* Author Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-veritas-light-blue to-neutral-200 dark:to-neutral-800 flex items-center justify-center mr-3">
        {author?.avatar ? (
          <img
            src={author.avatar}
            alt={author?.name || 'User'}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold text-white uppercase">
            {author?.name?.[0] || '?'}
          </span>
        )}
      </div>

      {/* Author Info */}
      <div className="flex-1">
        <div className="flex items-center">
          <span className="font-medium text-black dark:text-white mr-2 font-sans text-sm">
            {author?.name || 'Unknown'}
          </span>
          <span className="text-neutral-500 dark:text-neutral-400 text-sm">
            · {formatRelativeTime(timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}
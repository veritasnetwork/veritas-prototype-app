/**
 * PostHeader Component
 * Displays author information and relevance score
 */

'use client';

import type { Author } from '@/types/post.types';
import { formatRelativeTime } from '@/utils/formatters';

interface PostHeaderProps {
  author: Author;
  timestamp: Date;
}

export function PostHeader({ author, timestamp }: PostHeaderProps) {
  return (
    <div className="flex items-center mb-4">

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
/**
 * PostCard Component
 * Main component for displaying individual posts
 */

'use client';

import type { Post } from '@/types/post.types';
import { PostHeader } from './components/PostHeader';
import { OpinionIndicator } from './components/OpinionIndicator';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  // Apply spec fallbacks
  const title = post.headline || 'Untitled';
  const authorName = post.author?.name || 'Unknown';
  const content = post.content || '';

  return (
    <article className="bg-white dark:bg-neutral-900 px-4 md:px-0 py-6 border-b border-neutral-200 dark:border-neutral-700">
      <div>
        {/* Header */}
        <PostHeader
          author={post.author}
          timestamp={post.timestamp}
        />

        {/* Content */}
        <div className="flex items-start gap-2 mb-6">
          <h2 className="flex-1 text-2xl md:text-3xl font-bold text-black dark:text-white leading-snug font-serif">
            {title}
          </h2>

          {/* Opinion Indicator - only for posts with opinion_belief_id */}
          {post.opinion && (
            <OpinionIndicator yesPercentage={post.opinion.yesPercentage} />
          )}
        </div>

        {/* Text Content */}
        {content && (
          <p className="text-neutral-600 dark:text-neutral-300 text-lg leading-relaxed line-clamp-3 font-serif">
            {content}
          </p>
        )}
      </div>
    </article>
  );
}
/**
 * PostCard Component
 * Main component for displaying individual posts
 */

'use client';

import type { Post } from '@/types/post.types';
import { PostHeader } from './components/PostHeader';
import { BeliefIndicator } from './components/BeliefIndicator';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  // Apply spec fallbacks
  const title = post.headline || 'Untitled';
  const authorName = post.author?.name || 'Unknown';
  const content = post.content || '';

  return (
    <article className="bg-black px-4 md:px-0 py-6 border-b border-white border-opacity-20">
      <div>
        {/* Header */}
        <PostHeader
          author={post.author}
          timestamp={post.timestamp}
        />

        {/* Content */}
        <div className="flex items-start gap-2 mb-6">
          <h2 className="flex-1 text-2xl md:text-3xl font-bold text-white leading-snug font-sans">
            {title}
          </h2>

          {/* Belief Indicator - all posts have beliefs */}
          <BeliefIndicator yesPercentage={post.belief.yesPercentage} />
        </div>

        {/* Text Content */}
        {content && (
          <p className="text-white opacity-70 text-lg leading-relaxed line-clamp-3 font-sans">
            {content}
          </p>
        )}
      </div>
    </article>
  );
}
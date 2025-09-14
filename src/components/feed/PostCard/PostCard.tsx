/**
 * PostCard Component
 * Main component for displaying individual posts
 */

'use client';

import { useState } from 'react';
import type { Post } from '@/types/post.types';
import { PostHeader } from './components/PostHeader';
import { OpinionIndicator } from './components/OpinionIndicator';
import { OpinionSubmission } from './components/OpinionSubmission';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOpinionSubmit = async (percentage: number) => {
    // TODO: Implement opinion submission to backend
    console.log('Submitting opinion:', percentage, 'for post:', post.id);
  };

  const isOpinion = post.type === 'opinion';
  const canExpand = isOpinion && post.opinion;

  return (
    <article className="animate-slide-up group relative">
      <div 
        className={`relative bg-white dark:bg-neutral-900 px-4 md:px-0 py-6 border-b border-neutral-200 dark:border-neutral-700 ${
          canExpand ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/80 transition-colors' : ''
        }`}
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
      >
        {/* Header */}
        <PostHeader 
          author={post.author}
          relevanceScore={post.relevanceScore}
          timestamp={post.timestamp}
        />

        {/* Content */}
        <div className="flex items-start gap-2 mb-6">
          <h2 className="flex-1 text-2xl md:text-3xl font-bold text-black dark:text-white leading-snug hover:text-veritas-light-blue transition-colors cursor-pointer font-serif">
            {post.headline}
          </h2>
          
          {/* Opinion Percentage */}
          {isOpinion && post.opinion && (
            <OpinionIndicator yesPercentage={post.opinion.yesPercentage} />
          )}
        </div>
        
        {/* Text Content */}
        {post.type !== 'opinion' && (
          <p className="text-neutral-600 dark:text-neutral-300 text-lg leading-relaxed line-clamp-3 font-serif">
            {post.content}
          </p>
        )}

        {/* Thumbnail */}
        {post.thumbnail && (
          <div className={`overflow-hidden cursor-pointer group/image relative ${post.type !== 'opinion' ? 'mt-6' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity"></div>
            <img
              src={post.thumbnail}
              alt={post.headline}
              className="w-full h-[200px] md:h-[300px] object-cover transform group-hover/image:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
        )}

        {/* Opinion Submission */}
        {isOpinion && isExpanded && (
          <OpinionSubmission
            onCancel={() => setIsExpanded(false)}
            onSubmit={handleOpinionSubmit}
          />
        )}
      </div>
    </article>
  );
}
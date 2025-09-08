'use client';

import { useState } from 'react';
import type { Post } from '@/types/post.types';
import { OpinionChart } from '@/components/charts/OpinionChart';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const [relevance, setRelevance] = useState(post.relevanceScore);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };



  return (
    <article className="animate-slide-up group relative">
      <div className="relative bg-white dark:bg-neutral-900 px-4 md:px-0 py-10 border-b border-neutral-200 dark:border-neutral-700">

          {/* Author info with Relevance Score */}
          <div className="flex items-center mb-4">
            {/* Relevance Score - Top Left */}
            <div className="relative w-10 h-10 mr-3">
              <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgb(245 245 245)"
                  strokeWidth="3"
                  className="dark:stroke-neutral-800"
                />
                {/* Progress circle */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgb(147 197 253)"
                  strokeWidth="3"
                  strokeDasharray={`${relevance}, 100`}
                  className="transition-all duration-300"
                />
              </svg>
              {/* Score text in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-veritas-light-blue font-sans">{relevance}</span>
              </div>
              {/* Invisible input overlay for interaction */}
              <input
                type="range"
                min="0"
                max="100"
                value={relevance}
                onChange={(e) => setRelevance(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full"
              />
            </div>

            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-veritas-light-blue to-neutral-200 dark:to-neutral-800 flex items-center justify-center mr-3">
              {post.author.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white uppercase">
                  {post.author.name[0]}
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-medium text-black dark:text-white mr-2 font-sans text-sm">
                  {post.author.name}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 text-sm">
                  · {formatTimestamp(post.timestamp)}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white mb-4 leading-snug hover:text-veritas-light-blue transition-colors cursor-pointer font-serif">
            {post.headline}
          </h2>
          
          {post.type !== 'opinion' && (
            <p className="text-neutral-600 dark:text-neutral-300 text-lg leading-relaxed mb-6 line-clamp-3 font-serif">
              {post.content}
            </p>
          )}

          {/* Thumbnail if exists */}
          {post.thumbnail && (
            <div className="mb-4 overflow-hidden cursor-pointer group/image relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity"></div>
              <img
                src={post.thumbnail}
                alt={post.headline}
                className="w-full h-[200px] md:h-[300px] object-cover transform group-hover/image:scale-105 transition-transform duration-500"
              />
            </div>
          )}

          {/* Opinion Chart */}
          {post.type === 'opinion' && post.opinion && (
            <div className="mb-4">
              <OpinionChart 
                history={post.opinion.history || []}
                currentPercentage={post.opinion.yesPercentage}
                className="w-full"
              />
            </div>
          )}


      </div>
    </article>
  );
}
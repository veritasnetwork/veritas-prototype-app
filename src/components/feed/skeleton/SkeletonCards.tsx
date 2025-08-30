'use client';

import React from 'react';

// Base skeleton animation
const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className}`} />
);

// News Card Skeleton
export const SkeletonNewsCard: React.FC = () => (
  <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
    {/* Image */}
    <SkeletonPulse className="h-48 w-full" />
    
    {/* Content */}
    <div className="p-4 space-y-3">
      {/* Category */}
      <SkeletonPulse className="h-4 w-20 rounded" />
      
      {/* Title */}
      <SkeletonPulse className="h-6 w-full rounded" />
      <SkeletonPulse className="h-6 w-3/4 rounded" />
      
      {/* Excerpt */}
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-full rounded" />
        <SkeletonPulse className="h-4 w-5/6 rounded" />
      </div>
      
      {/* Meta */}
      <div className="flex gap-4">
        <SkeletonPulse className="h-4 w-24 rounded" />
        <SkeletonPulse className="h-4 w-24 rounded" />
      </div>
    </div>
  </div>
);

// Opinion Card Skeleton
export const SkeletonOpinionCard: React.FC = () => (
  <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
    <div className="space-y-4">
      {/* Question */}
      <SkeletonPulse className="h-6 w-full rounded" />
      
      {/* Large Value Display */}
      <div className="flex justify-center py-4">
        <SkeletonPulse className="h-16 w-32 rounded-lg" />
      </div>
      
      {/* Participants */}
      <SkeletonPulse className="h-4 w-36 rounded mx-auto" />
      
      {/* Action Button */}
      <SkeletonPulse className="h-10 w-full rounded-lg" />
      
      {/* Signals */}
      <div className="flex justify-between">
        <SkeletonPulse className="h-4 w-20 rounded" />
        <SkeletonPulse className="h-4 w-20 rounded" />
      </div>
    </div>
  </div>
);

// Conversation Card Skeleton
export const SkeletonConversationCard: React.FC = () => (
  <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
    <div className="space-y-4">
      {/* Topic */}
      <SkeletonPulse className="h-6 w-full rounded" />
      <SkeletonPulse className="h-6 w-2/3 rounded" />
      
      {/* Description */}
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-full rounded" />
        <SkeletonPulse className="h-4 w-4/5 rounded" />
      </div>
      
      {/* Participants */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          <SkeletonPulse className="h-8 w-8 rounded-full" />
          <SkeletonPulse className="h-8 w-8 rounded-full" />
          <SkeletonPulse className="h-8 w-8 rounded-full" />
        </div>
        <SkeletonPulse className="h-4 w-24 rounded" />
      </div>
      
      {/* Stats */}
      <div className="flex justify-between">
        <SkeletonPulse className="h-4 w-24 rounded" />
        <SkeletonPulse className="h-4 w-24 rounded" />
      </div>
    </div>
  </div>
);

// Blog Card Skeleton
export const SkeletonBlogCard: React.FC = () => (
  <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
    {/* Thumbnail */}
    <SkeletonPulse className="h-48 w-full" />
    
    {/* Content */}
    <div className="p-6 space-y-4">
      {/* Category & Reading Time */}
      <div className="flex justify-between">
        <SkeletonPulse className="h-4 w-20 rounded" />
        <SkeletonPulse className="h-4 w-24 rounded" />
      </div>
      
      {/* Title */}
      <SkeletonPulse className="h-7 w-full rounded" />
      <SkeletonPulse className="h-7 w-3/4 rounded" />
      
      {/* Author */}
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <SkeletonPulse className="h-4 w-32 rounded" />
          <SkeletonPulse className="h-3 w-24 rounded" />
        </div>
      </div>
      
      {/* Tags */}
      <div className="flex gap-2">
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-20 rounded-full" />
        <SkeletonPulse className="h-6 w-18 rounded-full" />
      </div>
    </div>
  </div>
);

// Compact Card Skeleton (for PremierHeader sidebar)
export const SkeletonCompactCard: React.FC = () => (
  <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
    <div className="flex gap-3">
      <SkeletonPulse className="h-16 w-16 rounded flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-4 w-full rounded" />
        <SkeletonPulse className="h-4 w-3/4 rounded" />
        <SkeletonPulse className="h-3 w-20 rounded" />
      </div>
    </div>
  </div>
);

// Mixed Feed Skeleton
export const SkeletonMixedFeed: React.FC = () => (
  <div className="space-y-6">
    {/* Full width news */}
    <SkeletonNewsCard />
    
    {/* Half width opinion + conversation */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonOpinionCard />
      <SkeletonConversationCard />
    </div>
    
    {/* Full width blog */}
    <SkeletonBlogCard />
    
    {/* Half width opinions */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonOpinionCard />
      <SkeletonOpinionCard />
    </div>
  </div>
);
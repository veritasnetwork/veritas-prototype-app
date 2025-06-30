'use client';

import { ReactNode } from 'react';

interface SkeletonCardGroupProps {
  variant: 'featured' | 'accent' | 'primary' | 'mixed' | 'compact';
  className?: string;
  children: ReactNode;
}

export const SkeletonCardGroup: React.FC<SkeletonCardGroupProps> = ({
  variant,
  className = '',
  children
}) => {
  const getPadding = () => {
    switch (variant) {
      case 'featured':
        return 'p-4 sm:p-6 lg:p-8';
      case 'compact':
        return 'p-3 sm:p-4';
      default:
        return 'p-4 sm:p-6';
    }
  };

  const getTitleSize = () => {
    switch (variant) {
      case 'compact':
        return 'h-6 w-48';
      default:
        return 'h-8 w-64';
    }
  };

  const getSubtitleSize = () => {
    switch (variant) {
      case 'compact':
        return 'h-4 w-32';
      default:
        return 'h-5 w-40';
    }
  };

  return (
    <div className={`rounded-2xl ${getPadding()} ${className} animate-pulse`}>
      {/* Skeleton Header */}
      <div className="mb-4 sm:mb-6">
        {/* Title skeleton */}
        <div className={`${getTitleSize()} bg-white/20 dark:bg-white/10 rounded-lg mb-2 shimmer`} />
        
        {/* Subtitle skeleton */}
        <div className={`${getSubtitleSize()} bg-white/15 dark:bg-white/8 rounded-lg shimmer`} />
      </div>

      {/* Content skeleton */}
      <div className="skeleton-content">
        {children}
      </div>
    </div>
  );
}; 
'use client';

interface SkeletonBeliefCardProps {
  theme?: 'light' | 'dark';
  variant?: 'feed' | 'grid';
}

export const SkeletonBeliefCard: React.FC<SkeletonBeliefCardProps> = ({
  variant = 'feed'
}) => {
  // Get sizing based on variant
  const getCardClasses = () => {
    const baseClasses = `
      rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700
      shadow-sm animate-pulse relative overflow-hidden
    `;
    
    if (variant === 'feed') {
      return `${baseClasses} w-full max-w-2xl mx-auto p-6`;
    } else {
      return `${baseClasses} w-full max-w-sm p-4`;
    }
  };

  return (
    <div className={getCardClasses()}>
      {/* Header Section */}
      <div className="flex items-start gap-4 mb-4">
        {/* Image skeleton */}
        <div className="flex-shrink-0 w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        
        {/* Question skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded ${variant === 'feed' ? 'w-full' : 'w-4/5'}`}></div>
          <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded ${variant === 'feed' ? 'w-4/5' : 'w-3/5'}`}></div>
          {variant === 'grid' && (
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          )}
        </div>
      </div>
      
      {/* Consensus Section */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        
        {/* Confidence indicators */}
        <div className="flex items-center gap-1">
          <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        
        {/* Status */}
        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      
      {/* Chart placeholder (only for feed variant) */}
      {variant === 'feed' && (
        <div className="mb-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg"></div>
      )}
      
      {/* News Context */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
      
      {/* Footer metadata */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-gray-400/20 animate-shimmer"></div>
    </div>
  );
}; 
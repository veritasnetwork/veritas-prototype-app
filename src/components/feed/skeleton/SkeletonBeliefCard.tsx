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
      return `${baseClasses} w-full max-w-sm min-h-[280px] p-4`;
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
      
      {/* Truth & Relevance Section */}
      <div className="mb-4">
        <div className={`flex items-center ${variant === 'grid' ? 'gap-2' : 'gap-4'}`}>
          {/* Truth metric */}
          <div className="flex items-center gap-1">
            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded ${variant === 'grid' ? 'w-4' : 'w-8'}`}></div>
          </div>
          
          {/* Relevance metric */}
          <div className="flex items-center gap-1">
            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded ${variant === 'grid' ? 'w-4' : 'w-12'}`}></div>
          </div>
          
          {/* Confidence indicators - only for feed */}
          {variant === 'feed' && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          )}
          
          {/* Status - only for feed */}
          {variant === 'feed' && (
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          )}
        </div>
      </div>
      
      {/* Chart placeholder (only for feed variant) */}
      {variant === 'feed' && (
        <div className="mb-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg"></div>
      )}
      
      {/* News Context - only for feed variant */}
      {variant === 'feed' && (
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
      )}
      
      {/* Footer metadata */}
      <div className={`pt-3 border-t border-gray-100 dark:border-gray-700 ${
        variant === 'grid' ? 'space-y-2' : 'flex items-center justify-between'
      }`}>
        <div className={`flex items-center ${variant === 'grid' ? 'gap-2' : 'gap-4'}`}>
          <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded ${variant === 'grid' ? 'w-8' : 'w-20'}`}></div>
          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-gray-400/20 animate-shimmer"></div>
    </div>
  );
}; 
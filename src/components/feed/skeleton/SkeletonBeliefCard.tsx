'use client';

interface SkeletonBeliefCardProps {
  theme?: 'light' | 'dark';
  variant?: 'feed' | 'grid' | 'large';
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
    } else if (variant === 'large') {
      return `${baseClasses} w-full h-72 md:h-80 p-4 flex flex-col`; // Consistent height with flexbox
    } else {
      return `${baseClasses} w-full max-w-sm min-h-[280px] p-4`;
    }
  };

  return (
    <div className={getCardClasses()}>
      {/* Header Section */}
      <div className="flex items-start gap-3 mb-3 flex-shrink-0">
        {/* Image skeleton */}
        <div className={`flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg ${
          variant === 'large' ? 'w-20 h-20' : 'w-20 h-20'
        }`}></div>
        
        {/* Question skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`bg-gray-200 dark:bg-gray-700 rounded ${
            variant === 'feed' ? 'h-6 w-full' : variant === 'large' ? 'h-5 w-full' : 'h-6 w-4/5'
          }`}></div>
          <div className={`bg-gray-200 dark:bg-gray-700 rounded ${
            variant === 'feed' ? 'h-6 w-4/5' : variant === 'large' ? 'h-5 w-3/4' : 'h-6 w-3/5'
          }`}></div>
          {variant === 'large' && (
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          )}
        </div>
      </div>
      
      {/* Truth & Relevance Section */}
      <div className="mb-3 flex-shrink-0">
        <div className={`flex items-center flex-wrap ${variant === 'grid' ? 'gap-2' : variant === 'large' ? 'gap-2 md:gap-3' : 'gap-4'}`}>
          {/* Truth metric */}
          <div className="flex items-center gap-1">
            <div className={`bg-gray-200 dark:bg-gray-700 rounded ${
              variant === 'large' ? 'h-5 md:h-6 w-8 md:w-10' : 'h-6 w-8'
            }`}></div>
            <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          
          {/* Relevance metric */}
          <div className="flex items-center gap-1">
            <div className={`bg-gray-200 dark:bg-gray-700 rounded ${
              variant === 'large' ? 'h-5 md:h-6 w-8 md:w-10' : 'h-6 w-8'
            }`}></div>
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          
          {/* Informativeness metric - only for large */}
          {variant === 'large' && (
            <div className="flex items-center gap-1">
              <div className="h-5 md:h-6 w-8 md:w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 w-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          )}
          
          {/* Status - only for feed */}
          {variant === 'feed' && (
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          )}
        </div>
      </div>
      
      {/* Chart placeholder - only for feed */}
      {variant === 'feed' && (
        <div className="mb-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg"></div>
      )}
      
      {/* News Context - removed label and blue dot */}
      {(variant === 'feed' || variant === 'large') && (
        <div className={`mb-3 ${variant === 'large' ? 'flex-1 flex flex-col' : ''}`}>
          <div className="space-y-2 flex-1">
            <div className={`bg-gray-200 dark:bg-gray-700 rounded w-full ${
              variant === 'large' ? 'h-4' : 'h-4'
            }`}></div>
            <div className={`bg-gray-200 dark:bg-gray-700 rounded w-3/4 ${
              variant === 'large' ? 'h-4' : 'h-4'
            }`}></div>
            {variant === 'large' && (
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
            )}
          </div>
        </div>
      )}
      
      {/* Footer metadata - removed active discussion */}
      <div className={`pt-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 ${
        variant === 'grid' || variant === 'large' ? 'space-y-2' : 'flex items-center justify-between'
      }`}>
        <div className={`flex items-center ${
          variant === 'grid' ? 'gap-2' : variant === 'large' ? 'gap-3' : 'gap-4'
        }`}>
          <div className={`bg-gray-200 dark:bg-gray-700 rounded ${
            variant === 'grid' ? 'h-3 w-8' : variant === 'large' ? 'h-3 w-20' : 'h-3 w-20'
          }`}></div>
          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className={`bg-gray-200 dark:bg-gray-700 rounded-full ${
          variant === 'large' ? 'h-5 w-16' : 'h-5 w-16'
        }`}></div>
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-gray-400/20 animate-shimmer"></div>
    </div>
  );
}; 
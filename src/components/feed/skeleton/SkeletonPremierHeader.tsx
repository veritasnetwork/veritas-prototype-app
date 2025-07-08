'use client';

export const SkeletonPremierHeader: React.FC = () => {
  return (
    <div className="w-full bg-white dark:bg-gray-900 mb-12 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px]">
          
          {/* Hero Card Skeleton - Left Side (2/3 width on desktop) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse">
            
            {/* Category Badge Skeleton - Top Left */}
            <div className="absolute top-6 left-6 z-20 w-20 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            
            {/* Hero Content Skeleton */}
            <div className="absolute bottom-8 left-8 right-8 space-y-4">
              
              {/* Title Skeleton */}
              <div className="space-y-3">
                <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
                <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-3/5"></div>
              </div>
              
              {/* Context Skeleton */}
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
              
              {/* Excerpt Skeleton */}
              <div className="space-y-2">
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
              </div>
              
              {/* Score Badges Skeleton */}
              <div className="flex items-center gap-4">
                <div className="w-32 h-7 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="w-28 h-7 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              </div>
              
              {/* CTA Skeleton */}
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
            </div>
            
            {/* Navigation Controls Skeleton */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
          
          {/* Small Grid Skeleton - Right Side (1/3 width on desktop) */}
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
            {[...Array(3)].map((_, index) => (
              <div 
                key={index}
                className="bg-gray-200 dark:bg-gray-700 rounded-xl h-36 animate-pulse"
              >
                {/* Small card skeleton content */}
                <div className="p-3 h-full flex flex-col">
                  {/* Header with small image and title */}
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                    </div>
                  </div>
                  
                  {/* Consensus section */}
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-12 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    <div className="h-3 w-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Dots Indicator Skeleton */}
        <div className="flex justify-center mt-6 gap-2">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 
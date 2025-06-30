'use client';

export const SkeletonBeliefDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section Skeleton */}
      <div className="relative bg-gradient-to-br from-[#1B365D] to-[#2D4A6B] border-b border-white/20 dark:border-white/10 pt-20 md:pt-8 animate-pulse">
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 via-transparent to-[#1B365D]/5" />
        
        <div className="relative container mx-auto px-4 py-4 md:py-8 max-w-7xl">
          {/* Breadcrumbs skeleton */}
          <div className="flex items-center space-x-2 mb-6">
            <div className="h-4 w-16 bg-white/20 rounded shimmer" />
            <div className="w-4 h-4 bg-white/15 rounded shimmer" />
            <div className="h-4 w-20 bg-white/20 rounded shimmer" />
            <div className="w-4 h-4 bg-white/15 rounded shimmer" />
            <div className="h-4 w-16 bg-white/20 rounded shimmer" />
          </div>

          {/* Hero Content skeleton */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              {/* Category and status */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="h-6 w-24 bg-white/20 rounded-full shimmer" />
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-white/20 rounded-full shimmer" />
                  <div className="h-4 w-16 bg-white/15 rounded shimmer" />
                </div>
              </div>
              
              {/* Title skeleton */}
              <div className="space-y-3 mb-4">
                <div className="h-8 w-full bg-white/20 rounded-lg shimmer" />
                <div className="h-8 w-4/5 bg-white/20 rounded-lg shimmer" />
              </div>
              
              {/* Description skeleton */}
              <div className="space-y-2">
                <div className="h-5 w-full bg-white/15 rounded shimmer" />
                <div className="h-5 w-3/4 bg-white/15 rounded shimmer" />
              </div>
            </div>

            {/* Quick Actions skeleton */}
            <div className="flex items-center space-x-3 mt-4 md:mt-0 md:ml-8">
              <div className="w-12 h-12 bg-white/20 rounded-2xl shimmer" />
              <div className="w-12 h-12 bg-white/20 rounded-2xl shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid skeleton */}
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          {/* Main Column skeleton */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            
            {/* Main Belief Card skeleton - The Centerpiece */}
            <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl animate-pulse relative">
              {/* Premium inner glow */}
              <div className="absolute inset-px bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-3xl opacity-50 pointer-events-none" />
              
              {/* Content skeleton */}
              <div className="relative space-y-8">
                {/* Heading component skeleton */}
                <div className="space-y-4">
                  <div className="h-6 w-32 bg-white/15 rounded shimmer" />
                  <div className="h-8 w-full bg-white/20 rounded-lg shimmer" />
                  <div className="h-8 w-3/4 bg-white/20 rounded-lg shimmer" />
                </div>
                
                {/* Chart component skeleton */}
                <div className="space-y-4">
                  <div className="h-6 w-40 bg-white/15 rounded shimmer" />
                  <div className="h-64 w-full bg-white/10 rounded-2xl shimmer" />
                </div>
                
                {/* Article component skeleton */}
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex space-x-3">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded shimmer" />
                      <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded shimmer" />
                      <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded shimmer" />
                    </div>
                  </div>
                </div>
                
                {/* Metadata component skeleton */}
                <div className="space-y-3">
                  <div className="h-5 w-24 bg-white/15 rounded shimmer" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-4 w-full bg-white/10 rounded shimmer" />
                    <div className="h-4 w-full bg-white/10 rounded shimmer" />
                    <div className="h-4 w-full bg-white/10 rounded shimmer" />
                    <div className="h-4 w-full bg-white/10 rounded shimmer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Consensus Timeline skeleton */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 w-48 bg-white/20 rounded shimmer" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-white/15 rounded-full shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-full bg-white/15 rounded shimmer" />
                        <div className="h-3 w-1/2 bg-white/10 rounded shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comments Section skeleton */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 animate-pulse">
              <div className="space-y-6">
                <div className="h-6 w-32 bg-white/20 rounded shimmer" />
                {[1, 2, 3].map((index) => (
                  <div key={index} className="flex space-x-4">
                    <div className="w-10 h-10 bg-white/15 rounded-full shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-white/15 rounded shimmer" />
                      <div className="h-4 w-full bg-white/10 rounded shimmer" />
                      <div className="h-4 w-3/4 bg-white/10 rounded shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
          </div>

          {/* Sidebar skeleton */}
          <div className="lg:col-span-1 space-y-6 md:space-y-8">
            
            {/* Performance Stats skeleton */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 w-40 bg-white/20 rounded shimmer" />
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((index) => (
                    <div key={index} className="text-center space-y-2">
                      <div className="h-8 w-16 bg-white/15 rounded mx-auto shimmer" />
                      <div className="h-3 w-20 bg-white/10 rounded mx-auto shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Panel skeleton */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 w-32 bg-white/20 rounded shimmer" />
                <div className="h-12 w-full bg-white/15 rounded-xl shimmer" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-10 w-full bg-white/10 rounded-lg shimmer" />
                  <div className="h-10 w-full bg-white/10 rounded-lg shimmer" />
                </div>
              </div>
            </div>

            {/* Related Beliefs skeleton */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 w-36 bg-white/20 rounded shimmer" />
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-16 bg-white/15 rounded shimmer" />
                      <div className="w-3 h-3 bg-white/15 rounded-full shimmer" />
                    </div>
                    <div className="h-4 w-full bg-white/10 rounded shimmer" />
                    <div className="h-4 w-3/4 bg-white/10 rounded shimmer" />
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Shimmer overlay for premium effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}; 
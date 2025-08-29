'use client';

export const SkeletonContentDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Minimal Header Skeleton - Same background as page */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4 animate-pulse">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          {/* Simple Back to Feed Button skeleton */}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-slate-300 dark:bg-veritas-eggshell/20 rounded shimmer" />
            <div className="h-4 w-24 bg-slate-300 dark:bg-veritas-eggshell/20 rounded shimmer" />
          </div>
        </div>
      </div>

      {/* Main Content Grid skeleton */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Column skeleton */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Hero Image Skeleton (News Article Style) */}
            <div className="relative w-full h-64 md:h-80 bg-slate-200 dark:bg-veritas-darker-blue/60 rounded-2xl overflow-hidden animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 space-y-2">
                <div className="h-8 w-full bg-white/20 rounded-lg shimmer" />
                <div className="h-8 w-3/4 bg-white/20 rounded-lg shimmer" />
              </div>
            </div>

            {/* Main Content - News Article Style (No Card Wrapper) */}
            <div className="space-y-8">
              
              {/* Heading Component Skeleton (when no hero image) */}
              <div className="space-y-4">
                <div className="h-10 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg shimmer" />
                <div className="h-10 w-4/5 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg shimmer" />
              </div>
              
              {/* Chart Component Skeleton */}
              <div className="space-y-4">
                <div className="h-6 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                <div className="h-64 w-full bg-slate-100 dark:bg-veritas-darker-blue/40 rounded-2xl shimmer border border-slate-200 dark:border-veritas-eggshell/10" />
              </div>

              {/* Submit Your Understanding CTA Skeleton */}
              <div className="flex justify-center my-8">
                <div className="h-14 w-64 bg-veritas-orange/20 rounded-2xl shimmer" />
              </div>
              
              {/* Article Component Skeleton */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-1 bg-veritas-orange/30 rounded-full shimmer" />
                  <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                </div>
                <div className="space-y-4">
                  <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  <div className="h-5 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  <div className="h-5 w-2/3 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-veritas-eggshell/10">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-veritas-light-blue/30 rounded-full shimmer" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  </div>
                </div>
              </div>
              

            </div>

          </div>

          {/* Empty Sidebar - No content in actual page */}
          <div className="lg:col-span-1">
            {/* Right column is empty in the actual ContentDetailPage */}
          </div>

          {/* Full Width Sections - Span all 4 columns */}
          <div className="lg:col-span-4 mt-12 space-y-8">
            
            {/* Relevance Signals Skeleton */}
            <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-veritas-eggshell/10 animate-pulse">
              <div className="space-y-6">
                {/* Header with Title and Controls */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-slate-200 dark:bg-veritas-eggshell/10 shimmer">
                      <div className="w-6 h-6" />
                    </div>
                    <div className="h-7 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="w-48 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full shimmer" />
                    {/* Validate Button */}
                    <div className="w-36 h-10 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-xl shimmer" />
                  </div>
                </div>
                
                {/* Signal Progress Bars Grid - Default Summary View */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(15)].map((_, index) => (
                    <div key={index} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-xl p-4">
                      {/* Signal Name and Value */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-slate-300 dark:bg-veritas-eggshell/20 rounded-full shimmer" />
                          <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                        </div>
                        <div className="h-4 w-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-gray-200 dark:bg-veritas-darker-blue/80 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-slate-300 dark:bg-veritas-eggshell/30 rounded-full shimmer" />
                      </div>
                      {/* Metadata */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="h-3 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                        <div className="h-3 w-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Community Discussion Skeleton */}
            <div className="animate-pulse">
              <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 border border-slate-200 dark:border-veritas-eggshell/10 rounded-3xl p-6 md:p-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                    <div className="h-7 w-48 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  </div>
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="flex space-x-4">
                      <div className="w-10 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                        <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                        <div className="h-4 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Shimmer overlay for premium effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-veritas-light-blue/5 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}; 
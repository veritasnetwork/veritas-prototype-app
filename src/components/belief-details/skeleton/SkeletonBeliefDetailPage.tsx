'use client';

export const SkeletonBeliefDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Simplified Header Skeleton */}
      <div className="bg-gradient-to-r from-veritas-secondary/10 to-veritas-secondary/5 dark:from-veritas-secondary/15 dark:to-veritas-secondary/5 border-b border-slate-200 dark:border-veritas-eggshell/10 pt-20 md:pt-8 animate-pulse">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Breadcrumbs skeleton */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="h-4 w-16 bg-slate-300 dark:bg-veritas-eggshell/20 rounded shimmer" />
            <div className="w-1 h-1 bg-slate-300 dark:bg-veritas-eggshell/20 rounded-full shimmer" />
            <div className="h-4 w-20 bg-slate-300 dark:bg-veritas-eggshell/20 rounded shimmer" />
            <div className="w-1 h-1 bg-slate-300 dark:bg-veritas-eggshell/20 rounded-full shimmer" />
            <div className="h-4 w-16 bg-slate-300 dark:bg-veritas-eggshell/20 rounded shimmer" />
          </div>

          {/* Category Badge & Actions skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-6 w-24 bg-gradient-to-r from-amber-500/20 to-blue-600/20 rounded-full shimmer" />
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400/30 rounded-full shimmer" />
                <div className="h-4 w-20 bg-slate-300 dark:bg-veritas-eggshell/20 rounded shimmer" />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-xl shimmer" />
              <div className="w-10 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-xl shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid skeleton */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Column skeleton */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Hero Image Skeleton (News Article Style) */}
            <div className="relative w-full h-64 md:h-80 bg-slate-200 dark:bg-veritas-darker-blue/80 rounded-2xl overflow-hidden animate-pulse">
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
                <div className="h-64 w-full bg-slate-100 dark:bg-veritas-darker-blue/60 rounded-2xl shimmer border border-slate-200 dark:border-veritas-eggshell/10" />
              </div>

              {/* Submit Your Understanding CTA Skeleton */}
              <div className="flex justify-center my-8">
                <div className="h-14 w-64 bg-gradient-to-r from-amber-500/20 to-blue-600/20 rounded-2xl shimmer" />
              </div>
              
              {/* Article Component Skeleton */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-1 bg-amber-500/30 rounded-full shimmer" />
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
                    <div className="w-1 h-1 bg-blue-500/30 rounded-full shimmer" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  </div>
                </div>
              </div>
              

            </div>

          </div>

          {/* Sidebar skeleton */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Simplified Action Panel Skeleton */}
            <div className="space-y-4 animate-pulse">
              {/* Share Your Understanding Button Skeleton */}
              <div className="h-14 w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl shimmer" />
              
              {/* Info Notice Skeleton */}
              <div className="p-3 bg-blue-50 dark:bg-veritas-primary/10 rounded-xl border border-blue-200 dark:border-veritas-primary/20">
                <div className="h-3 w-full bg-blue-200 dark:bg-veritas-primary/30 rounded shimmer" />
              </div>
            </div>

            {/* Related Information Skeleton */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10 animate-pulse">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  <div className="h-6 w-36 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                </div>
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-veritas-eggshell/5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-16 bg-slate-200 dark:bg-veritas-eggshell/15 rounded shimmer" />
                      <div className="w-3 h-3 bg-slate-200 dark:bg-veritas-eggshell/15 rounded-full shimmer" />
                    </div>
                    <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/15 rounded shimmer" />
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/15 rounded shimmer" />
                  </div>
                ))}
              </div>
            </div>
            
          </div>

          {/* Full Width Sections - Span all 4 columns */}
          <div className="lg:col-span-4 mt-12 space-y-8">
            
            {/* Intelligence Evolution - 3 Line Charts Skeleton */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10 animate-pulse">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                  <div className="h-7 w-48 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Truth Chart */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-400/30 rounded shimmer" />
                      <div className="h-5 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                    </div>
                    <div className="h-40 w-full bg-slate-100 dark:bg-veritas-eggshell/5 rounded-lg shimmer" />
                    <div className="h-4 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mx-auto shimmer" />
                  </div>
                  {/* Relevance Chart */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-400/30 rounded shimmer" />
                      <div className="h-5 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                    </div>
                    <div className="h-40 w-full bg-slate-100 dark:bg-veritas-eggshell/5 rounded-lg shimmer" />
                    <div className="h-4 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mx-auto shimmer" />
                  </div>
                  {/* Informativeness Chart */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-purple-400/30 rounded shimmer" />
                      <div className="h-5 w-28 bg-slate-200 dark:bg-veritas-eggshell/10 rounded shimmer" />
                    </div>
                    <div className="h-40 w-full bg-slate-100 dark:bg-veritas-eggshell/5 rounded-lg shimmer" />
                    <div className="h-4 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mx-auto shimmer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Community Discussion Skeleton */}
            <div className="animate-pulse">
              <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/3 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}; 
'use client';

export const SkeletonNewsDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Minimal Header Skeleton */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4 animate-pulse">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
            <div className="h-4 w-24 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Column - 3 columns */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Hero Image Section with Text Overlay */}
            <div className="relative w-full h-64 md:h-80 lg:h-96 bg-slate-200 dark:bg-veritas-darker-blue/60 rounded-2xl overflow-hidden animate-pulse shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 space-y-3">
                {/* Source */}
                <div className="h-4 w-32 bg-white/20 rounded" />
                {/* Title */}
                <div className="space-y-2">
                  <div className="h-8 w-full bg-white/20 rounded-lg" />
                  <div className="h-8 w-3/4 bg-white/20 rounded-lg" />
                </div>
                {/* Context */}
                <div className="h-5 w-2/3 bg-white/20 rounded" />
                {/* Breaking News Badge */}
                <div className="h-6 w-28 bg-red-600/30 rounded inline-block" />
              </div>
            </div>

            {/* Article Content */}
            <div className="space-y-8">
              
              {/* Article Body */}
              <div className="space-y-6">
                {/* Introduction */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-1 bg-veritas-orange/30 rounded-full" />
                    <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                </div>

                {/* Body Paragraphs */}
                {[1, 2, 3].map((section) => (
                  <div key={section} className="space-y-3">
                    <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-5/6 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-2/3 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                ))}

                {/* Metadata Footer */}
                <div className="pt-4 border-t border-slate-200 dark:border-veritas-eggshell/10">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-veritas-light-blue/30 rounded-full" />
                      <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    </div>
                    <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                </div>
              </div>
              
              {/* Chart Component */}
              <div className="space-y-4">
                <div className="h-6 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-64 w-full bg-slate-100 dark:bg-veritas-darker-blue/40 rounded-2xl border border-slate-200 dark:border-veritas-eggshell/10" />
              </div>
            </div>
          </div>

          {/* Sidebar - 1 column (minimal for news) */}
          <div className="lg:col-span-1">
            {/* Source Card */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="h-4 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-2" />
              <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
            </div>
          </div>

          {/* Full Width Relevance Signals */}
          <div className="lg:col-span-4 mt-12 space-y-8">
            <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-veritas-eggshell/10 animate-pulse">
              <div className="space-y-6">
                {/* Header with Title and Controls */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-slate-200 dark:bg-veritas-eggshell/10">
                      <div className="w-6 h-6" />
                    </div>
                    <div className="h-7 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="w-48 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                    {/* Validate Button */}
                    <div className="w-36 h-10 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-xl" />
                  </div>
                </div>
                
                {/* Signal Progress Bars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(12)].map((_, index) => (
                    <div key={index} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-slate-300 dark:bg-veritas-eggshell/20 rounded-full" />
                          <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                        </div>
                        <div className="h-4 w-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-veritas-darker-blue/80 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-slate-300 dark:bg-veritas-eggshell/30 rounded-full" />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="h-3 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                        <div className="h-3 w-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer overlay */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-veritas-light-blue/5 to-transparent animate-shimmer" />
      </div>
    </div>
  );
};
'use client';

export const SkeletonBlogDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Header with back button */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4 animate-pulse">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
            <div className="h-4 w-24 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
          </div>
        </div>
      </div>

      {/* Main Content with Grid Layout */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Article Content - 3 columns */}
          <div className="lg:col-span-3">
            
            {/* Hero Image */}
            <div className="relative w-full h-64 md:h-80 lg:h-96 bg-slate-200 dark:bg-veritas-darker-blue/60 rounded-2xl overflow-hidden mb-8" />
            
            {/* Blog Header */}
            <div className="mb-8">
              {/* Title */}
              <div className="h-10 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-4" />
              <div className="h-8 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-6" />
              
              {/* Author Info */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                <div>
                  <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-2" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-4 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-6 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                ))}
              </div>
            </div>

            {/* Article Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
              {/* Introduction */}
              <div className="mb-8">
                <div className="h-6 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
              </div>

              {/* Body Sections */}
              {[1, 2, 3].map((section) => (
                <div key={section} className="mb-8">
                  <div className="h-7 w-48 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-4" />
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-4 w-5/6 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-4 w-2/3 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                  
                  {/* Occasional Quote/Highlight */}
                  {section === 2 && (
                    <div className="border-l-4 border-slate-200 dark:border-veritas-eggshell/20 pl-4 my-6">
                      <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-2" />
                      <div className="h-4 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-200 dark:border-veritas-eggshell/10 pt-8 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  <div className="h-8 w-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  <div className="h-8 w-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
                <div className="h-8 w-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>
            </div>
          </div>

          {/* Sidebar - 1 column (RIGHT SIDE) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="lg:sticky lg:top-24">
              {/* Table of Contents */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <div className="h-5 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  ))}
                </div>
              </div>

              {/* Reading Time */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <div className="h-4 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-2" />
                <div className="h-6 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>

              {/* Author Bio */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-3" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                  <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  <div className="h-3 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Full Width Sections - span all 4 columns */}
          <div className="lg:col-span-4 space-y-8">
            {/* Related Content */}
            <div>
              <div className="h-8 w-48 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-6" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-5 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-2" />
                        <div className="h-4 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-3" />
                        <div className="h-3 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Relevance Signals */}
            <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 rounded-3xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-slate-200 dark:bg-veritas-eggshell/10">
                    <div className="w-6 h-6" />
                  </div>
                  <div className="h-7 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
                <div className="w-36 h-10 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-xl" />
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
                  </div>
                ))}
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
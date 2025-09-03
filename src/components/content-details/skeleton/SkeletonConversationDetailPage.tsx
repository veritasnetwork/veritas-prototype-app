'use client';

export const SkeletonConversationDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Header Skeleton */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4 animate-pulse">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
            <div className="h-4 w-24 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header with Status Badges */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-10 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg mb-3" />
              <div className="h-6 w-1/2 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-4" />
              <div className="flex items-center gap-3">
                <div className="h-6 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
              <div className="h-8 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Column - Comments Section */}
          <div className="lg:col-span-3 space-y-6">
            {/* Metadata Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                  <div className="h-8 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
              ))}
            </div>

            {/* Opening Statement */}
            <div className="bg-veritas-light-blue/10 dark:bg-veritas-light-blue/20 rounded-xl p-6 border border-veritas-light-blue/30 dark:border-veritas-light-blue/40">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
                <div className="h-5 w-32 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
                <div className="h-4 w-3/4 bg-slate-300 dark:bg-veritas-eggshell/20 rounded" />
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-center justify-between mb-6">
                <div className="h-6 w-48 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-9 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg" />
              </div>

              {/* Comment Input */}
              <div className="mb-6">
                <div className="h-20 bg-slate-100 dark:bg-veritas-darker-blue/60 rounded-lg mb-2" />
                <div className="flex justify-end">
                  <div className="h-10 w-32 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-lg" />
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-4 bg-slate-50 dark:bg-veritas-darker-blue/40 rounded-lg">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                        <div className="h-3 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                        <div className="h-4 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="h-4 w-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                        <div className="h-4 w-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Activity Timeline */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-3 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-3 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement Stats */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-3 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                    <div className="h-5 w-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Join Discussion CTA */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="h-12 w-full bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-lg" />
            </div>

            {/* Top Contributors */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded flex-1" />
                    {i === 1 && <div className="w-4 h-4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Width Relevance Signals */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-slate-200 dark:bg-veritas-eggshell/10">
                    <div className="w-6 h-6" />
                  </div>
                  <div className="h-7 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
                <div className="w-36 h-10 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-xl" />
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
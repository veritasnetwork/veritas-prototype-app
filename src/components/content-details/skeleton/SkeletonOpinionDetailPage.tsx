'use client';

export const SkeletonOpinionDetailPage: React.FC = () => {
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
        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="h-10 w-3/4 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg mx-auto mb-4" />
          <div className="h-6 w-1/2 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mx-auto" />
        </div>

        {/* Main Opinion Card */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 border border-slate-200 dark:border-veritas-eggshell/10">
            {/* Question */}
            <div className="h-8 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-6" />
            
            {/* Central Display Area - Could be percentage, yes/no bar, etc */}
            <div className="flex justify-center items-center mb-8">
              <div className="text-center">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-32 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg" />
                  <div className="h-16 w-16 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                </div>
                <div className="h-4 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mt-4 mx-auto" />
              </div>
            </div>
            
            {/* Progress Bar or Interactive Element */}
            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="h-4 w-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
                <div className="h-4 w-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              
              {/* Submit Button */}
              <div className="flex justify-center mt-6">
                <div className="h-12 w-48 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-6 border border-slate-200 dark:border-veritas-eggshell/10 text-center">
                <div className="w-12 h-12 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-lg mx-auto mb-3" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mx-auto mb-2" />
                <div className="h-4 w-full bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Historical Trend Chart */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
            <div className="h-6 w-48 bg-slate-200 dark:bg-veritas-eggshell/10 rounded mb-4" />
            <div className="h-64 bg-slate-100 dark:bg-veritas-darker-blue/40 rounded-xl" />
          </div>
        </div>

        {/* Relevance Signals */}
        <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-veritas-eggshell/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-slate-200 dark:bg-veritas-eggshell/10">
                <div className="w-6 h-6" />
              </div>
              <div className="h-7 w-40 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-48 h-10 bg-slate-200 dark:bg-veritas-eggshell/10 rounded-full" />
              <div className="w-36 h-10 bg-veritas-primary/20 dark:bg-veritas-light-blue/20 rounded-xl" />
            </div>
          </div>
          
          {/* Signal Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(9)].map((_, index) => (
              <div key={index} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-24 bg-slate-200 dark:bg-veritas-eggshell/10 rounded" />
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

      {/* Shimmer overlay */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-veritas-light-blue/5 to-transparent animate-shimmer" />
      </div>
    </div>
  );
};
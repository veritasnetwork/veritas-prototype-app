'use client';

interface SkeletonBeliefCardProps {
  theme?: 'light' | 'dark';
  compact?: boolean;
}

export const SkeletonBeliefCard: React.FC<SkeletonBeliefCardProps> = ({
  theme = 'light',
  compact = false
}) => {
  const cardPadding = compact ? 'p-4' : 'p-6';
  
  // Match the glassmorphism styling from real cards
  const glassClasses = theme === 'dark' 
    ? 'bg-white/5 border-white/10' 
    : 'bg-white/20 border-white/30';

  return (
    <div className={`
      rounded-2xl ${cardPadding} ${glassClasses}
      border backdrop-blur-md relative overflow-hidden
      hover:scale-[1.02] hover:shadow-2xl transition-all duration-300
    `}>
      {/* Subtle inner glow like real cards */}
      <div className="absolute inset-px bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-2xl opacity-50" />
      
      {/* Premium breathing animation overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 via-transparent to-[#1B365D]/5 rounded-2xl animate-pulse" />
      
      {/* Content Container */}
      <div className="relative z-10 h-full flex flex-col">
        
        {/* Header with category and status */}
        <div className="flex items-start justify-between mb-4">
          {/* Category badge skeleton */}
          <div className="h-6 w-20 bg-white/15 dark:bg-white/10 rounded-full shimmer" />
          
          {/* Status indicator skeleton */}
          <div className="w-3 h-3 bg-white/15 dark:bg-white/10 rounded-full shimmer" />
        </div>

        {/* Main Content */}
        <div className="flex-grow space-y-4">
          {/* Title skeleton - multiple lines */}
          <div className="space-y-2">
            <div className="h-5 w-full bg-white/15 dark:bg-white/10 rounded-lg shimmer" />
            <div className="h-5 w-4/5 bg-white/15 dark:bg-white/10 rounded-lg shimmer" />
          </div>

          {/* Metrics grid skeleton */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="h-6 w-12 bg-white/15 dark:bg-white/10 rounded mx-auto shimmer" />
              <div className="h-3 w-16 bg-white/10 dark:bg-white/8 rounded mx-auto shimmer" />
            </div>
            <div className="text-center space-y-2">
              <div className="h-6 w-12 bg-white/15 dark:bg-white/10 rounded mx-auto shimmer" />
              <div className="h-3 w-16 bg-white/10 dark:bg-white/8 rounded mx-auto shimmer" />
            </div>
            <div className="text-center space-y-2">
              <div className="h-6 w-12 bg-white/15 dark:bg-white/10 rounded mx-auto shimmer" />
              <div className="h-3 w-16 bg-white/10 dark:bg-white/8 rounded mx-auto shimmer" />
            </div>
          </div>
        </div>

        {/* Action buttons skeleton */}
        {!compact ? (
          <div className="mt-6 flex space-x-3">
            <div className="flex-1 h-10 bg-white/10 dark:bg-white/8 rounded-xl shimmer" />
            <div className="flex-1 h-10 bg-white/10 dark:bg-white/8 rounded-xl shimmer" />
          </div>
        ) : (
          <div className="mt-4">
            <div className="w-full h-8 bg-white/10 dark:bg-white/8 rounded-lg shimmer" />
          </div>
        )}
      </div>

      {/* Premium shimmer wave effect */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer" />
      
      {/* Additional glow effect for premium feel */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFB800]/10 to-transparent opacity-50 animate-pulse" />
    </div>
  );
}; 
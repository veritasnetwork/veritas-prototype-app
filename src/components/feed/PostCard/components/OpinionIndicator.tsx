/**
 * OpinionIndicator Component
 * Shows the current opinion percentage for opinion-type posts
 */

'use client';

interface OpinionIndicatorProps {
  yesPercentage: number;
}

export function OpinionIndicator({ yesPercentage }: OpinionIndicatorProps) {
  return (
    <div className="flex-shrink-0">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="rgb(245 245 245)"
            strokeWidth="3"
            className="dark:stroke-neutral-800"
          />
          {/* Progress circle */}
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#EA900E"
            strokeWidth="3"
            strokeDasharray={`${yesPercentage}, 100`}
            className="transition-all duration-300"
          />
        </svg>
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-veritas-orange font-sans">
            {yesPercentage}%
          </span>
        </div>
      </div>
      {/* "Yes" indicator */}
      <div className="text-center mt-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">YES</span>
      </div>
    </div>
  );
}
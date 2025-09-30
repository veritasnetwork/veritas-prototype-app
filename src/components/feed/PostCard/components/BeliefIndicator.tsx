/**
 * BeliefIndicator Component
 * Shows the current belief percentage for posts
 */

'use client';

interface BeliefIndicatorProps {
  yesPercentage: number;
}

export function BeliefIndicator({ yesPercentage }: BeliefIndicatorProps) {
  return (
    <div className="flex-shrink-0">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="white"
            strokeOpacity="0.3"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#B9D9EB"
            strokeWidth="3"
            strokeDasharray={`${yesPercentage}, 100`}
            className="transition-all duration-300"
          />
        </svg>
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-[#B9D9EB] font-sans">
            {yesPercentage}%
          </span>
        </div>
      </div>
      {/* "Yes" indicator */}
      <div className="text-center mt-1">
        <span className="text-xs text-white opacity-50 font-medium">YES</span>
      </div>
    </div>
  );
}
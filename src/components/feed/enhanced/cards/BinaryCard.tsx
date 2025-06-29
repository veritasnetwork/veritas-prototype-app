'use client';

import { Bookmark, Share2 } from 'lucide-react';

interface BinaryCardProps {
  title: string;
  image: string;
  percentage: number;
  volume: string;
  theme?: 'light' | 'dark';
  compact?: boolean;
  onClick?: () => void;
}

export const BinaryCard: React.FC<BinaryCardProps> = ({
  title,
  image,
  percentage,
  volume,
  theme = 'light',
  compact = false,
  onClick
}) => {
  const isDark = theme === 'dark';
  const cardSize = compact ? 'p-3' : 'p-4';
  const titleSize = compact ? 'text-xs' : 'text-sm';
  const circleSize = compact ? 'w-12 h-12' : 'w-20 h-20';

  const getPercentageColor = () => {
    if (percentage >= 70) return '#10b981'; // green
    if (percentage >= 40) return '#FFB800'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div 
      className={`${isDark ? 'bg-white/10 backdrop-blur-sm' : 'bg-white dark:bg-slate-800'} rounded-xl border ${isDark ? 'border-white/20' : 'border-gray-200 dark:border-slate-700'} ${cardSize} hover:shadow-lg transition-all duration-300 group cursor-pointer`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start space-x-3 mb-4">
        <img
          src={image}
          alt=""
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className={`${titleSize} font-medium ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'} line-clamp-2 group-hover:text-[#FFB800] transition-colors`}>
            {title}
          </h3>
        </div>
      </div>

      {/* Percentage Circle */}
      {!compact && (
        <div className="flex justify-center mb-4">
          <div className={`relative ${circleSize}`}>
            <svg className={`${circleSize} transform -rotate-90`} viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke={isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke={getPercentageColor()}
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${percentage * 2.83} ${283 - percentage * 2.83}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
                {percentage}%
              </span>
            </div>
          </div>
        </div>
      )}

      {compact && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDark ? 'text-white/70' : 'text-gray-600 dark:text-slate-400'}`}>
              Chance
            </span>
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
              {percentage}%
            </span>
          </div>
          <div className={`w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 ${isDark ? 'bg-white/10' : ''}`}>
            <div
              className="h-2 rounded-full transition-all duration-1000"
              style={{
                width: `${percentage}%`,
                backgroundColor: getPercentageColor()
              }}
            />
          </div>
        </div>
      )}

      {!compact && (
        <p className={`text-center text-xs ${isDark ? 'text-white/70' : 'text-gray-500 dark:text-slate-400'} mb-4`}>
          chance
        </p>
      )}

      {/* Action Buttons */}
      <div className={`flex space-x-2 ${compact ? 'mb-2' : 'mb-4'}`}>
        <button className="flex-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 font-medium py-2 px-3 rounded-lg text-xs border border-green-200 dark:border-green-700 transition-all hover:scale-105 active:scale-95">
          Yes {compact ? '' : '↗'}
        </button>
        <button className="flex-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium py-2 px-3 rounded-lg text-xs border border-red-200 dark:border-red-700 transition-all hover:scale-105 active:scale-95">
          No {compact ? '' : '↘'}
        </button>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between text-xs ${isDark ? 'text-white/60' : 'text-gray-500 dark:text-slate-400'}`}>
        <span className="font-medium">{volume}</span>
        <div className="flex items-center space-x-2">
          <button className={`hover:${isDark ? 'text-white' : 'text-gray-700 dark:text-slate-300'} transition-colors`}>
            <Share2 className="w-3 h-3" />
          </button>
          <button className={`hover:${isDark ? 'text-white' : 'text-gray-700 dark:text-slate-300'} transition-colors`}>
            <Bookmark className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}; 
'use client';

import { Bookmark, Share2, TrendingUp, TrendingDown } from 'lucide-react';

interface ContinuousCardProps {
  title: string;
  image: string;
  currentValue: number;
  unit: string;
  volume: string;
  theme?: 'light' | 'dark';
  change?: number; // percentage change
  onClick?: () => void;
}

export const ContinuousCard: React.FC<ContinuousCardProps> = ({
  title,
  image,
  currentValue,
  unit,
  volume,
  theme = 'light',
  change = 0,
  onClick
}) => {
  const isDark = theme === 'dark';
  const isPositive = change >= 0;

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  return (
    <div 
      className={`${isDark ? 'bg-white/10 backdrop-blur-sm' : 'bg-white dark:bg-slate-800'} rounded-xl border ${isDark ? 'border-white/20' : 'border-gray-200 dark:border-slate-700'} p-4 hover:shadow-lg transition-all duration-300 group cursor-pointer`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start space-x-3 mb-4">
        <img
          src={image}
          alt=""
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'} line-clamp-2 group-hover:text-[#FFB800] transition-colors`}>
            {title}
          </h3>
        </div>
      </div>

      {/* Current Value */}
      <div className="text-center mb-4">
        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
          {unit === 'USD' ? '$' : ''}{formatValue(currentValue)}{unit !== 'USD' ? ` ${unit}` : ''}
        </div>
        {change !== 0 && (
          <div className={`flex items-center justify-center space-x-1 text-sm mt-1 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Mini Chart Placeholder */}
      <div className={`h-12 ${isDark ? 'bg-white/5' : 'bg-gray-50 dark:bg-slate-700'} rounded-lg mb-4 flex items-center justify-center`}>
        <div className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500 dark:text-slate-400'}`}>
          Chart Preview
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 mb-4">
        <button className="flex-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 font-medium py-2 px-3 rounded-lg text-xs border border-green-200 dark:border-green-700 transition-all hover:scale-105 active:scale-95">
          Buy Higher ↗
        </button>
        <button className="flex-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium py-2 px-3 rounded-lg text-xs border border-red-200 dark:border-red-700 transition-all hover:scale-105 active:scale-95">
          Buy Lower ↘
        </button>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between text-xs ${isDark ? 'text-white/60' : 'text-gray-500 dark:text-slate-400'}`}>
        <span className="font-medium">{volume}</span>
        <div className="flex items-center space-x-2">
          <button className={`hover:${isDark ? 'text-white' : 'text-gray-700 dark:text-slate-300'} transition-colors`}>
            <Share2 className="w-4 h-4" />
          </button>
          <button className={`hover:${isDark ? 'text-white' : 'text-gray-700 dark:text-slate-300'} transition-colors`}>
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}; 
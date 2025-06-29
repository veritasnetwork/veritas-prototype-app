'use client';

import { Bookmark, Share2 } from 'lucide-react';

interface Option {
  label: string;
  percentage: number;
}

interface MultiChoiceCardProps {
  title: string;
  image: string;
  options: Option[];
  volume: string;
  theme?: 'light' | 'dark';
  onClick?: () => void;
}

export const MultiChoiceCard: React.FC<MultiChoiceCardProps> = ({
  title,
  image,
  options,
  volume,
  theme = 'light',
  onClick
}) => {
  const isDark = theme === 'dark';

  const getOptionColor = (index: number) => {
    const colors = ['#10b981', '#FFB800', '#6366f1', '#ef4444', '#8b5cf6'];
    return colors[index % colors.length];
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

      {/* Options List */}
      <div className="space-y-3 mb-4">
        {options.map((option, index) => (
          <div key={option.label} className="flex items-center justify-between">
            <div className="flex-1">
              <div className={`text-sm ${isDark ? 'text-white/90' : 'text-gray-700 dark:text-slate-300'}`}>
                {option.label}
              </div>
              <div className={`w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 mt-1 ${isDark ? 'bg-white/10' : ''}`}>
                <div
                  className="h-1.5 rounded-full transition-all duration-1000"
                  style={{
                    width: `${option.percentage}%`,
                    backgroundColor: getOptionColor(index)
                  }}
                />
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
                {option.percentage}%
              </span>
              <div className="flex space-x-1">
                <button className="bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs font-medium border border-green-200 dark:border-green-700 transition-all hover:scale-105 active:scale-95">
                  Buy
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between text-xs ${isDark ? 'text-white/60' : 'text-gray-500 dark:text-slate-400'} pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-100 dark:border-slate-700'}`}>
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
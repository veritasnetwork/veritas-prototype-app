'use client';

import { Bookmark, Share2 } from 'lucide-react';

interface Candidate {
  name: string;
  percentage: number;
  party: string;
}

interface ElectionCardProps {
  title: string;
  image: string;
  candidates: Candidate[];
  volume: string;
  theme?: 'light' | 'dark';
  onClick?: () => void;
}

export const ElectionCard: React.FC<ElectionCardProps> = ({
  title,
  image,
  candidates,
  volume,
  theme = 'light',
  onClick
}) => {
  const isDark = theme === 'dark';

  const getPartyColor = (party: string) => {
    switch (party) {
      case 'D': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'R': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'I': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
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

      {/* Candidates List */}
      <div className="space-y-3 mb-4">
        {candidates.map((candidate) => (
          <div key={candidate.name} className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
                {candidate.name}
              </span>
              {candidate.party && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPartyColor(candidate.party)}`}>
                  {candidate.party}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
                {candidate.percentage}%
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
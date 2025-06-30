'use client';

import { Belief } from '@/types/belief.types';
import { getAllBeliefs } from '@/lib/data';
import { Eye, Users, TrendingUp } from 'lucide-react';

interface RelatedBeliefsProps {
  belief: Belief;
  onBeliefClick: (beliefId: string) => void;
}

export const RelatedBeliefs: React.FC<RelatedBeliefsProps> = ({ belief, onBeliefClick }) => {
  const getRelatedBeliefs = (): Belief[] => {
    const allBeliefs = getAllBeliefs();
    
    // Filter out current belief and get beliefs from same category
    const categoryBeliefs = allBeliefs.filter(b => 
      b.id !== belief.id && 
      b.category === belief.category
    );
    
    // If we have beliefs in same category, return them (limit 4)
    if (categoryBeliefs.length > 0) {
      return categoryBeliefs
        .sort((a, b) => b.consensusLevel - a.consensusLevel) // Sort by consensus
        .slice(0, 4);
    }
    
    // Fallback: return other beliefs sorted by consensus
    return allBeliefs
      .filter(b => b.id !== belief.id)
      .sort((a, b) => b.consensusLevel - a.consensusLevel)
      .slice(0, 4);
  };

  const relatedBeliefs = getRelatedBeliefs();

  const getCategoryGradient = (category: string): string => {
    switch (category.toLowerCase()) {
      case 'finance':
        return 'from-[#FFB800]/20 to-[#F5A623]/10';
      case 'politics':
        return 'from-[#1B365D]/20 to-[#2D4A6B]/10';
      case 'sports':
        return 'from-[#3B82F6]/20 to-[#2563EB]/10'; // Blue variants
      case 'technology':
        return 'from-[#FCD34D]/20 to-[#F59E0B]/10'; // Yellow variants
      default:
        return 'from-[#1B365D]/20 to-[#FFB800]/10'; // Blue to yellow
    }
  };

  if (relatedBeliefs.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 shadow-2xl shadow-yellow-500/10">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
            <TrendingUp className="w-5 h-5 text-[#FFB800]" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Related Beliefs
          </h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No related beliefs found in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 shadow-2xl shadow-yellow-500/10">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
          <TrendingUp className="w-5 h-5 text-[#FFB800]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Related Beliefs
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            From {belief.category}
          </p>
        </div>
      </div>

      {/* Related beliefs list */}
      <div className="space-y-3">
        {relatedBeliefs.map((relatedBelief) => (
          <div
            key={relatedBelief.id}
            onClick={() => onBeliefClick(relatedBelief.id)}
            className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
          >
            {/* Category badge */}
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r ${getCategoryGradient(relatedBelief.category)} text-slate-700 dark:text-slate-300 border border-white/20`}>
                {relatedBelief.category}
              </span>
              <div className={`w-2 h-2 rounded-full ${
                relatedBelief.status === 'active' 
                  ? 'bg-emerald-400 animate-pulse' 
                  : relatedBelief.status === 'resolved'
                  ? 'bg-blue-400'
                  : 'bg-slate-400'
              }`} />
            </div>

            {/* Title */}
            <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm line-clamp-2 mb-3 group-hover:text-[#FFB800] transition-colors">
              {relatedBelief.title}
            </h4>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  {relatedBelief.participantCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3 h-3 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  {Math.round(relatedBelief.consensusLevel * 100)}%
                </span>
              </div>
            </div>

            {/* View indicator */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ${(relatedBelief.totalStake / 1000).toFixed(0)}K stake
              </span>
              <Eye className="w-3 h-3 text-slate-400 group-hover:text-[#FFB800] transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* View more link */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-[#FFB800] transition-colors font-medium">
          View all {belief.category} beliefs →
        </button>
      </div>
    </div>
  );
}; 
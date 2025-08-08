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
        .sort((a, b) => b.objectRankingScores.truth - a.objectRankingScores.truth) // Sort by truth score
        .slice(0, 4);
    }
    
    // Fallback: return other beliefs sorted by truth score
    return allBeliefs
      .filter(b => b.id !== belief.id)
      .sort((a, b) => b.objectRankingScores.truth - a.objectRankingScores.truth)
      .slice(0, 4);
  };

  const relatedBeliefs = getRelatedBeliefs();


  if (relatedBeliefs.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 border border-slate-200 dark:border-veritas-eggshell/10 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell">
            <TrendingUp className="w-6 h-6 text-white dark:text-veritas-primary" />
          </div>
          <h3 className="text-lg font-bold text-veritas-primary dark:text-veritas-eggshell">
            Related Beliefs
          </h3>
        </div>
        <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
          No related beliefs found in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 border border-slate-200 dark:border-veritas-eggshell/10 rounded-3xl p-6 md:p-8 shadow-2xl">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell">
          <TrendingUp className="w-6 h-6 text-white dark:text-veritas-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-veritas-primary dark:text-veritas-eggshell">
            Related Beliefs
          </h3>
          <p className="text-xs text-veritas-primary/70 dark:text-veritas-eggshell/70">
            From {belief.category || 'mixed categories'}
          </p>
        </div>
      </div>

      {/* Related beliefs list */}
      <div className="space-y-3">
        {relatedBeliefs.map((relatedBelief) => (
          <div
            key={relatedBelief.id}
            onClick={() => onBeliefClick(relatedBelief.id)}
            className="p-4 bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5 transition-all duration-300 cursor-pointer group"
          >
            {/* Category badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-veritas-primary/10 dark:bg-veritas-eggshell/10 text-veritas-primary dark:text-veritas-eggshell border border-veritas-primary/20 dark:border-veritas-eggshell/20">
                {relatedBelief.category || 'general'}
              </span>
              <div className={`w-2 h-2 rounded-full ${
                relatedBelief.status === 'resolved'
                  ? 'bg-blue-400'
                  : relatedBelief.status === 'closed'
                  ? 'bg-slate-400'
                  : 'bg-emerald-400 animate-pulse'
              }`} />
            </div>

            {/* Title */}
            <h4 className="font-medium text-veritas-primary dark:text-veritas-eggshell text-sm line-clamp-2 mb-3 group-hover:text-veritas-orange transition-colors">
              {relatedBelief.heading.title}
            </h4>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3 text-veritas-primary/60 dark:text-veritas-eggshell/60" />
                <span className="text-veritas-primary/70 dark:text-veritas-eggshell/70">
                  {relatedBelief.objectRankingScores.relevance}% relevance
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3 h-3 text-veritas-primary/60 dark:text-veritas-eggshell/60" />
                <span className="text-veritas-primary/70 dark:text-veritas-eggshell/70">
                  {relatedBelief.objectRankingScores.truth}% truth
                </span>
              </div>
            </div>

            {/* View indicator */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-veritas-eggshell/10">
              <span className="text-xs text-veritas-primary/60 dark:text-veritas-eggshell/60">
                {relatedBelief.objectRankingScores.informativeness}% informativeness
              </span>
              <Eye className="w-3 h-3 text-slate-400 group-hover:text-veritas-orange transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* View more link */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-veritas-eggshell/10">
        <button className="w-full text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-orange transition-colors font-medium">
          View all {belief.category} beliefs →
        </button>
      </div>
    </div>
  );
}; 
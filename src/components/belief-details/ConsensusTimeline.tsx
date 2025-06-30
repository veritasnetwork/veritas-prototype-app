'use client';

import { Belief } from '@/types/belief.types';
import { TrendingUp, Clock } from 'lucide-react';

interface ConsensusTimelineProps {
  belief: Belief;
}

export const ConsensusTimeline: React.FC<ConsensusTimelineProps> = ({ belief }) => {
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getConsensusColor = (level: number) => {
    if (level >= 0.7) return 'text-[#3B82F6]'; // Blue for high consensus
    if (level >= 0.4) return 'text-[#FFB800]'; // Brand yellow for medium consensus
    return 'text-slate-500'; // Grey for low consensus
  };

  const getConsensusGradient = (level: number) => {
    if (level >= 0.7) return 'from-[#3B82F6]/20 to-[#2563EB]/10'; // Blue variants
    if (level >= 0.4) return 'from-[#FFB800]/20 to-[#F59E0B]/10'; // Yellow variants
    return 'from-slate-500/20 to-slate-600/10'; // Keep grey for low consensus
  };

  const maxConsensus = Math.max(...belief.consensusHistory.map(h => h.consensusLevel));

  return (
    <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
          <TrendingUp className="w-6 h-6 text-[#FFB800]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Consensus Evolution
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            How community agreement has changed over time
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {belief.consensusHistory.map((point, index) => {
          const isLatest = index === belief.consensusHistory.length - 1;
          const percentage = Math.round(point.consensusLevel * 100);
          const barWidth = (point.consensusLevel / maxConsensus) * 100;
          
          return (
            <div
              key={point.timestamp}
              className={`relative p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] ${
                isLatest 
                  ? 'bg-gradient-to-r from-[#FFB800]/20 to-[#1B365D]/10 border border-[#FFB800]/30' 
                  : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${isLatest ? 'bg-[#FFB800] animate-pulse' : 'bg-slate-400'}`} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {formatDate(point.timestamp)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Entropy: {point.entropy.toFixed(2)} • Quality: {point.entropy < 0.3 ? 'High' : point.entropy < 0.6 ? 'Medium' : 'Low'}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${getConsensusColor(point.consensusLevel)}`}>
                    {percentage}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    consensus
                  </div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getConsensusGradient(point.consensusLevel)} transition-all duration-1000 ease-out`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            Consensus improvement:
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            +{Math.round((belief.consensusLevel - belief.consensusHistory[0].consensusLevel) * 100)}% since creation
          </span>
        </div>
      </div>
    </div>
  );
}; 
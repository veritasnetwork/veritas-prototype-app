'use client';

import { Belief } from '@/types/belief.types';
import { Clock, BarChart3 } from 'lucide-react';

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#10B981]'; // Green for high scores
    if (score >= 60) return 'text-[#FFB800]'; // Yellow for medium scores
    return 'text-slate-500'; // Grey for low scores
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-[#10B981]/20 to-[#059669]/10'; // Green variants
    if (score >= 60) return 'from-[#FFB800]/20 to-[#F59E0B]/10'; // Yellow variants
    return 'from-slate-500/20 to-slate-600/10'; // Grey for low scores
  };

  // Extract timeline data from charts to show evolution of intelligence metrics
  const getTimelineData = () => {
    const timelineEvents: Array<{
      date: string;
      value: number;
      event: string;
      chartTitle: string;
      type: string;
    }> = [];
    
    // Get timeline data from charts (especially continuous charts)
    belief.charts?.forEach(chart => {
      if (chart.type === 'continuous') {
        const continuousData = chart.data as import('@/types/belief.types').ContinuousData;
        if (continuousData.timeline) {
          continuousData.timeline.forEach(point => {
            timelineEvents.push({
              date: point.date,
              value: point.value,
              event: point.event || `${chart.title} update`,
              chartTitle: chart.title,
              type: 'metric'
            });
          });
        }
      }
    });

    // Add creation event
    if (belief.createdAt) {
      timelineEvents.push({
        date: belief.createdAt,
        value: Math.round(((belief.objectRankingScores?.truth || 0) + (belief.objectRankingScores?.relevance || 0) + (belief.objectRankingScores?.informativeness || 0)) / 3),
        event: 'Information object created',
        chartTitle: 'Initial Assessment',
        type: 'creation'
      });
    }

    // Sort by date
    return timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const timelineData = getTimelineData();

  if (timelineData.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
            <BarChart3 className="w-6 h-6 text-[#FFB800]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Intelligence Evolution
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              How information quality metrics have evolved over time
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-600 dark:text-slate-400">
            No timeline data available for this information object.
          </p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...timelineData.map(d => d.value));

  return (
    <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
          <BarChart3 className="w-6 h-6 text-[#FFB800]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Intelligence Evolution
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            How information quality metrics have evolved over time
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {timelineData.map((point, index) => {
          const isLatest = index === timelineData.length - 1;
          const barWidth = (point.value / maxValue) * 100;
          
          return (
            <div
              key={`${point.date}-${index}`}
              className={`relative p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] ${
                isLatest 
                  ? 'bg-gradient-to-r from-[#FFB800]/20 to-[#1B365D]/10 border border-[#FFB800]/30' 
                  : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${
                    isLatest 
                      ? 'bg-[#FFB800] animate-pulse' 
                      : point.type === 'creation' 
                      ? 'bg-[#10B981]' 
                      : 'bg-slate-400'
                  }`} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {formatDate(point.date)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {point.event} • {point.chartTitle}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${getScoreColor(point.value)}`}>
                    {point.value}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    score
                  </div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getScoreGradient(point.value)} transition-all duration-1000 ease-out`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400">Truth Score:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {belief.objectRankingScores?.truth || 0}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400">Relevance Score:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {belief.objectRankingScores?.relevance || 0}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400">Informativeness:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {belief.objectRankingScores?.informativeness || 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 
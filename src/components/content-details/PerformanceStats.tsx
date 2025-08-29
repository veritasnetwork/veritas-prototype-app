'use client';

import { Belief } from '@/types/belief.types';
import { TrendingUp, Users, DollarSign, BarChart, Target, Clock } from 'lucide-react';

interface PerformanceStatsProps {
  belief: Belief;
}

export const PerformanceStats: React.FC<PerformanceStatsProps> = ({ belief }) => {


  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'resolved':
        return 'text-[#FFB800]'; // Brand yellow for resolved
      // 'closed' status no longer exists, but kept for backward compatibility
      case 'closed':
        return 'text-slate-500';
      default:
        return 'text-[#3B82F6]'; // Blue for continuous beliefs
    }
  };

  // Removed formatDaysActive as it's no longer used in the information intelligence structure

  const stats = [
    {
      icon: TrendingUp,
      label: 'Truth Score',
      value: `${belief.objectRankingScores?.truth || 0}%`,
      change: null,
      color: 'text-[#10B981]',
      bgGradient: 'from-[#10B981]/20 to-[#059669]/10'
    },
    {
      icon: Users,
      label: 'Relevance Score',
      value: `${belief.objectRankingScores?.relevance || 0}%`,
      change: null,
      color: 'text-[#3B82F6]',
      bgGradient: 'from-[#3B82F6]/20 to-[#2563EB]/10'
    },
    {
      icon: BarChart,
      label: 'Informativeness Score',
      value: `${belief.objectRankingScores?.informativeness || 0}%`,
      change: null,
      color: 'text-[#FFB800]',
      bgGradient: 'from-[#FFB800]/20 to-[#F5A623]/10'
    },
    {
      icon: DollarSign,
      label: 'Article Credibility',
      value: belief.article.credibility.charAt(0).toUpperCase() + belief.article.credibility.slice(1),
      change: null,
      color: belief.article.credibility === 'high' ? 'text-[#10B981]' : 
            belief.article.credibility === 'medium' ? 'text-[#FFB800]' : 'text-slate-500',
      bgGradient: belief.article.credibility === 'high' 
        ? 'from-[#10B981]/20 to-[#059669]/10'
        : belief.article.credibility === 'medium' 
        ? 'from-[#FFB800]/20 to-[#F59E0B]/10'
        : 'from-slate-500/20 to-slate-600/10'
    },
    {
      icon: Target,
      label: 'Status',
      value: belief.status ? belief.status.charAt(0).toUpperCase() + belief.status.slice(1) : 'Continuous',
      change: null,
      color: getStatusColor(belief.status || 'continuous'),
      bgGradient: !belief.status
        ? 'from-[#3B82F6]/20 to-[#2563EB]/10'
        : belief.status === 'resolved'
        ? 'from-[#FFB800]/20 to-[#F59E0B]/10'
        : 'from-slate-500/20 to-slate-600/10'
    },
    {
      icon: Clock,
      label: 'Charts Available',
      value: (belief.charts?.length || 0).toString(),
      change: null,
      color: 'text-slate-500',
      bgGradient: 'from-slate-500/20 to-slate-600/10'
    }
  ];

  return (
    <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
          <BarChart className="w-6 h-6 text-[#FFB800]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Performance Metrics
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Key indicators of belief quality and engagement
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          
          return (
            <div
              key={stat.label}
              className="p-4 md:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-[1.02] group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.bgGradient} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                </div>
                {stat.change && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                )}
              </div>
              
              <div className="min-w-0">
                <div className={`text-lg md:text-xl lg:text-2xl font-bold ${stat.color} mb-1 truncate`}>
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-tight">
                  {stat.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Insights */}
      <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
        <div className="grid grid-cols-1 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Average Quality Score:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {Math.round(((belief.objectRankingScores?.truth || 0) + (belief.objectRankingScores?.relevance || 0) + (belief.objectRankingScores?.informativeness || 0)) / 3)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 
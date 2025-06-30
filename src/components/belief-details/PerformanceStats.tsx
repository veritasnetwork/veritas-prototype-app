'use client';

import { Belief } from '@/types/belief.types';
import { TrendingUp, Users, DollarSign, BarChart, Target, Clock } from 'lucide-react';

interface PerformanceStatsProps {
  belief: Belief;
}

export const PerformanceStats: React.FC<PerformanceStatsProps> = ({ belief }) => {
  const getEntropyLevel = (entropy: number): string => {
    if (entropy < 0.3) return 'High';
    if (entropy < 0.6) return 'Medium';
    return 'Low';
  };

  const getEntropyColor = (entropy: number): string => {
    if (entropy < 0.3) return 'text-[#3B82F6]'; // Blue for high quality
    if (entropy < 0.6) return 'text-[#FFB800]'; // Brand yellow for medium quality
    return 'text-slate-500'; // Grey for low quality
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'text-[#3B82F6]'; // Blue for active
      case 'resolved':
        return 'text-[#FFB800]'; // Brand yellow for resolved
      case 'closed':
        return 'text-slate-500';
      default:
        return 'text-slate-500';
    }
  };

  const formatDaysActive = (): string => {
    const created = new Date(belief.createdAt);
    const now = belief.resolvedAt ? new Date(belief.resolvedAt) : new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  const stats = [
    {
      icon: TrendingUp,
      label: 'Consensus Strength',
      value: `${Math.round(belief.consensusLevel * 100)}%`,
      change: belief.consensusHistory.length > 1 
        ? `+${Math.round((belief.consensusLevel - belief.consensusHistory[0].consensusLevel) * 100)}%`
        : null,
      color: 'text-[#FFB800]',
      bgGradient: 'from-[#FFB800]/20 to-[#F5A623]/10'
    },
    {
      icon: Users,
      label: 'Participants',
      value: belief.participantCount.toLocaleString(),
      change: null,
      color: 'text-[#3B82F6]',
      bgGradient: 'from-[#3B82F6]/20 to-[#2563EB]/10'
    },
    {
      icon: DollarSign,
      label: 'Total Stake',
      value: belief.totalStake >= 1000000 
        ? `$${(belief.totalStake / 1000000).toFixed(1)}M`
        : belief.totalStake >= 1000
        ? `$${(belief.totalStake / 1000).toFixed(0)}K`
        : `$${belief.totalStake.toLocaleString()}`,
      change: null,
      color: 'text-[#10B981]',
      bgGradient: 'from-[#10B981]/20 to-[#059669]/10'
    },
    {
      icon: BarChart,
      label: 'Information Quality',
      value: getEntropyLevel(belief.entropy),
      change: null,
      color: getEntropyColor(belief.entropy),
      bgGradient: belief.entropy < 0.3 
        ? 'from-[#3B82F6]/20 to-[#2563EB]/10'
        : belief.entropy < 0.6 
        ? 'from-[#FFB800]/20 to-[#F59E0B]/10'
        : 'from-slate-500/20 to-slate-600/10'
    },
    {
      icon: Target,
      label: 'Status',
      value: belief.status.charAt(0).toUpperCase() + belief.status.slice(1),
      change: null,
      color: getStatusColor(belief.status),
      bgGradient: belief.status === 'active'
        ? 'from-[#3B82F6]/20 to-[#2563EB]/10'
        : belief.status === 'resolved'
        ? 'from-[#FFB800]/20 to-[#F59E0B]/10'
        : 'from-slate-500/20 to-slate-600/10'
    },
    {
      icon: Clock,
      label: 'Duration',
      value: formatDaysActive(),
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Average stake per participant:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              ${Math.round(belief.totalStake / belief.participantCount).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Entropy score:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {belief.entropy.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 
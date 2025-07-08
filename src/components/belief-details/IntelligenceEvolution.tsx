'use client';

import { Belief } from '@/types/belief.types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Brain, Target } from 'lucide-react';

interface IntelligenceEvolutionProps {
  belief: Belief;
}

export const IntelligenceEvolution: React.FC<IntelligenceEvolutionProps> = ({ belief }) => {
  
  // Generate mock historical data for the 3 scores
  const generateHistoricalData = () => {
    const data = [];
    const currentDate = new Date();
    
    // Generate 12 data points over the last 30 days
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - (i * 2.5)); // Every 2.5 days
      
      // Simulate score evolution that trends toward current scores
      const truthVariation = (Math.random() - 0.5) * 20;
      const relevanceVariation = (Math.random() - 0.5) * 20;
      const infoVariation = (Math.random() - 0.5) * 20;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        truth: Math.max(0, Math.min(100, belief.objectRankingScores.truth + truthVariation)),
        relevance: Math.max(0, Math.min(100, belief.objectRankingScores.relevance + relevanceVariation)),
        informativeness: Math.max(0, Math.min(100, belief.objectRankingScores.informativeness + infoVariation))
      });
    }
    
    return data;
  };

  const historicalData = generateHistoricalData();

  const metrics = [
    {
      key: 'truth',
      label: 'Truth Score',
      icon: Target,
      color: '#10B981',
      currentValue: belief.objectRankingScores.truth
    },
    {
      key: 'relevance', 
      label: 'Relevance Score',
      icon: Brain,
      color: '#3B82F6',
      currentValue: belief.objectRankingScores.relevance
    },
    {
      key: 'informativeness',
      label: 'Informativeness',
      icon: TrendingUp,
      color: '#F59E0B',
      currentValue: belief.objectRankingScores.informativeness
    }
  ];

  return (
    <div>
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-600/20">
          <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Intelligence Evolution
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            How collective understanding has evolved over time
          </p>
        </div>
      </div>

      {/* Current Scores Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${metric.color}20` }}>
                  <Icon className="w-5 h-5" style={{ color: metric.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {metric.currentValue}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {metric.label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Line Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <div key={metric.key} className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metric.color }} />
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                {metric.label}
              </h4>
            </div>
            
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-slate-600 dark:text-slate-400"
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-slate-600 dark:text-slate-400"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color}
                    strokeWidth={3}
                    dot={{ fill: metric.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: metric.color, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Evolution Summary */}
      <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-blue-50 dark:from-amber-900/20 dark:to-blue-900/20 rounded-2xl border border-amber-200 dark:border-amber-700/30">
        <p className="text-sm text-slate-700 dark:text-slate-300 text-center">
          📊 Intelligence scores represent collective understanding quality as assessed by the Veritas community
        </p>
      </div>
    </div>
  );
}; 
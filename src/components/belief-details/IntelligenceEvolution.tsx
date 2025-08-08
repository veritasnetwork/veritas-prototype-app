'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Brain, Target } from 'lucide-react';

interface IntelligenceEvolutionProps {
  belief: Belief;
}

export const IntelligenceEvolution: React.FC<IntelligenceEvolutionProps> = ({ belief }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Set up observer for class changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  
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

  // Use different Veritas colors for each metric
  const metrics = [
    {
      key: 'truth',
      label: 'Truth Score',
      icon: Target,
      color: isDarkMode ? '#B9D9EB' : '#0C1D51',  // Light blue in dark mode, dark blue in light mode
      bgColor: isDarkMode ? '#B9D9EB' : '#0C1D51',  // For inline style
      currentValue: belief.objectRankingScores.truth
    },
    {
      key: 'relevance', 
      label: 'Relevance Score',
      icon: Brain,
      color: '#EA900E',  // Veritas orange (same in both modes)
      bgColor: '#EA900E',  // For inline style
      currentValue: belief.objectRankingScores.relevance
    },
    {
      key: 'informativeness',
      label: 'Informativeness',
      icon: TrendingUp,
      color: '#F0EAD6',  // Veritas eggshell (same in both modes)
      bgColor: '#F0EAD6',  // For inline style
      currentValue: belief.objectRankingScores.informativeness
    }
  ];

  return (
    <div>
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell">
          <TrendingUp className="w-6 h-6 text-white dark:text-veritas-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
            Intelligence Evolution
          </h3>
          <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
            How collective understanding has evolved over time
          </p>
        </div>
      </div>

      {/* Current Scores Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-2xl p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: metric.bgColor }}>
                  <Icon className="w-5 h-5" style={{ color: (metric.key === 'informativeness' || (metric.key === 'truth' && isDarkMode)) ? '#050A1A' : '#FFFFFF' }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell">
                    {metric.currentValue}%
                  </div>
                  <div className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
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
        {metrics.map((metric) => {
          // Calculate optimal Y-axis domain for each metric
          const metricData = historicalData.map(d => d[metric.key as keyof typeof d] as number).filter(v => !isNaN(v));
          const minValue = Math.min(...metricData);
          const maxValue = Math.max(...metricData);
          // Ensure values are within reasonable bounds (0-100 for percentage scores)
          const domainMin = Math.max(0, minValue > 10 ? minValue - 10 : 0);
          const domainMax = Math.min(100, maxValue);
          const yDomain = [domainMin, domainMax];

          return (
            <div key={metric.key} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-2xl p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: metric.color }} />
                <h4 className="font-semibold text-veritas-primary dark:text-veritas-eggshell">
                  {metric.label}
                </h4>
              </div>
              
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-veritas-primary/60 dark:text-veritas-eggshell/60"
                    />
                    <YAxis 
                      domain={yDomain}
                      tick={{ fontSize: 12 }}
                      className="text-veritas-primary/60 dark:text-veritas-eggshell/60"
                      tickFormatter={(value) => Math.round(value).toString()}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        color: '#0C1D51'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric.key}
                      stroke={metric.color}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, stroke: metric.color, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 
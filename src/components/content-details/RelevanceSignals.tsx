'use client';

import { useState, useEffect, useContext } from 'react';
import { Signal } from '@/types/belief.types';
import { Content } from '@/types/content.types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart2, LineChart as LineChartIcon, Edit3 } from 'lucide-react';
import { ensureContentSignals, getSignalLastValue, getSignalColor } from '@/lib/signals-utils';
import { SignalValidationPanel, SignalUpdates } from './SignalValidationPanel';
import { FeedContext } from '@/contexts/FeedContext';

interface RelevanceSignalsProps {
  belief: Content;
}

export const RelevanceSignals: React.FC<RelevanceSignalsProps> = ({ belief }) => {
  // Try to get context, but handle case where it might not be available
  // This happens when the component is used outside of FeedProvider (e.g., content detail pages)
  const feedContext = useContext(FeedContext);
  const currentAlgorithm = feedContext?.currentAlgorithm || null;
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'graphs'>('summary');
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  
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
  
  // Ensure the content has all signals with historical data
  const signals = ensureContentSignals(belief);
  
  // Convert signals object to array for display
  const signalArray = Object.values(signals).sort((a, b) => {
    // Priority order for main signals
    const priority: { [key: string]: number } = {
      truth: 1,
      relevance: 2,
      informativeness: 3
    };
    
    const aPriority = priority[a.key] || 999;
    const bPriority = priority[b.key] || 999;
    
    return aPriority - bPriority;
  });

  // Transform historical data for charts
  const prepareChartData = (signal: Signal) => {
    if (!signal.historicalData || signal.historicalData.length === 0) {
      return [];
    }
    
    return signal.historicalData.map((point) => ({
      date: new Date(point.timestamp).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit'
      }),
      value: point.value
    }));
  };

  // Handle validation button click
  const handleValidation = () => {
    setShowValidationPanel(true);
  };

  // Handle validation submission
  const handleValidationSubmit = (updates: SignalUpdates) => {
    void updates; // Will be used when backend is connected
    // ⚠️ SECURITY WARNING: These console logs are for DEMONSTRATION ONLY
    // In production, NEVER log sensitive user data like beliefs and predictions
    // This could expose voting patterns and compromise the BTS mechanism's integrity
    // Remove ALL console.log statements before deploying to production
    
    // === START: DEMO-ONLY LOGGING (REMOVE IN PRODUCTION) ===
    // console.log('📊 BTS Signal Validation Submitted to Veritas Protocol:');
    // console.log('====================================================');
    // Object.entries(updates).forEach(([signalKey, values]) => {
    //   console.log(`Signal: ${signalKey}`);
    //   console.log(`  → My Belief: ${values.myBelief}%`);
    //   console.log(`  → Others' Belief (Meta-prediction): ${values.othersBelief}%`);
    //   console.log(`  → BTS Delta: ${Math.abs(values.myBelief - values.othersBelief)}%`);
    // });
    // console.log('====================================================');
    // console.log('This data will be used by Veritas Protocol to:');
    // console.log('1. Calculate your trust score using BTS');
    // console.log('2. Update signal aggregates based on epistemic weight');
    // console.log('3. Redistribute stake based on accuracy');
    // === END: DEMO-ONLY LOGGING ===
    
    // TODO: Production implementation
    // In the future, this will send updates to the Veritas protocol smart contract
    // The contract will use BTS to identify truthful contributions and update signals accordingly
    // Data should be encrypted and sent directly to the blockchain without client-side logging
  };

  return (
    <div>
      {/* Header with Toggle and Validation Button - Mobile optimized */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white dark:text-veritas-primary" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
              Relevance Signals
            </h3>
          </div>
        </div>
        
        {/* Right side controls - Mobile stacked */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
          {/* View Mode Toggle - Simplified for mobile */}
          <div className="flex bg-slate-200 dark:bg-slate-700 rounded-full p-0.5 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('summary')}
              className={`
                flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium 
                transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5
                ${viewMode === 'summary' 
                  ? 'bg-white dark:bg-veritas-eggshell text-veritas-primary dark:text-veritas-darker-blue shadow-sm' 
                  : 'text-veritas-primary/60 dark:text-veritas-eggshell/60 hover:text-veritas-primary/80 dark:hover:text-veritas-eggshell/80'
                }
              `}
            >
              <BarChart2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Summary</span>
              <span className="sm:hidden">Bars</span>
            </button>
            <button
              onClick={() => setViewMode('graphs')}
              className={`
                flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium 
                transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5
                ${viewMode === 'graphs' 
                  ? 'bg-white dark:bg-veritas-eggshell text-veritas-primary dark:text-veritas-darker-blue shadow-sm' 
                  : 'text-veritas-primary/60 dark:text-veritas-eggshell/60 hover:text-veritas-primary/80 dark:hover:text-veritas-eggshell/80'
                }
              `}
            >
              <LineChartIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Graphs</span>
            </button>
          </div>
          
          {/* Validation Button - Full width on mobile */}
          <button
            onClick={handleValidation}
            className="
              px-4 sm:px-5 py-2 sm:py-2.5 bg-veritas-primary dark:bg-veritas-light-blue 
              text-white dark:text-veritas-darker-blue 
              rounded-xl font-bold text-sm sm:text-base
              hover:shadow-xl hover:scale-105 
              transition-all duration-300
              flex items-center justify-center gap-2
            "
          >
            <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Validate Signals</span>
          </button>
        </div>
      </div>

      {/* Summary View - Progress Bars - Mobile optimized */}
      {viewMode === 'summary' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {signalArray.map((signal) => {
            const lastValue = getSignalLastValue(signal);
            const signalColor = getSignalColor(signal.key, isDarkMode);
            
            return (
              <div key={signal.key} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-lg sm:rounded-xl p-3 sm:p-4">
                {/* Signal Name and Value - Mobile optimized */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: signalColor }} />
                    <span className="text-xs sm:text-sm font-medium text-veritas-primary dark:text-veritas-eggshell">
                      {signal.name}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-veritas-primary dark:text-veritas-eggshell">
                    {lastValue}%
                  </span>
                </div>
                
                {/* Progress Bar - Mobile optimized */}
                <div className="w-full h-1.5 sm:h-2 bg-gray-200 dark:bg-veritas-darker-blue/80 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${lastValue}%`,
                      backgroundColor: signalColor
                    }}
                  />
                </div>
                
                {/* Metadata - Mobile optimized */}
                <div className="flex items-center justify-between mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-veritas-primary/50 dark:text-veritas-eggshell/50">
                  <span>{signal.metadata.contributors} contributors</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Graph View - Line Charts - Mobile optimized */}
      {viewMode === 'graphs' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {signalArray.map((signal) => {
            // Icon component removed - was unused
            const chartData = prepareChartData(signal);
            const lastValue = getSignalLastValue(signal);
            const signalColor = getSignalColor(signal.key, isDarkMode);
            
            // Calculate Y-axis domain
            const values = chartData.map(d => d.value).filter(v => !isNaN(v));
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const domainMin = Math.max(0, minValue > 10 ? minValue - 10 : 0);
            const domainMax = Math.min(100, maxValue < 90 ? maxValue + 10 : 100);
            const yDomain = [domainMin, domainMax];

            return (
              <div key={signal.key} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-xl sm:rounded-2xl p-3 sm:p-5">
                {/* Signal Header with Icon and Current Value - Mobile optimized */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shadow-sm" style={{ backgroundColor: signalColor }} />
                    <h4 className="font-semibold text-xs sm:text-sm text-veritas-primary dark:text-veritas-eggshell">
                      {signal.name}
                    </h4>
                  </div>
                  <div className="text-sm sm:text-lg font-bold text-veritas-primary dark:text-veritas-eggshell">
                    {lastValue}%
                  </div>
                </div>
                
                {/* Chart - Mobile optimized */}
                <div className="h-24 sm:h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis 
                        dataKey="date" 
                        hide
                        tick={false}
                      />
                      <YAxis 
                        domain={yDomain}
                        hide
                        tick={false}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDarkMode ? 'rgba(5, 10, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          border: `1px solid ${isDarkMode ? '#F0EAD6' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          color: isDarkMode ? '#F0EAD6' : '#0C1D51',
                          fontSize: '12px'
                        }}
                        formatter={(value: number) => [`${value}%`, signal.name]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={signalColor}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: signalColor, strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Metadata Footer - Mobile optimized */}
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-veritas-eggshell/10">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-veritas-primary/60 dark:text-veritas-eggshell/60">
                    <span>{signal.metadata.contributors} contributors</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Signal Validation Panel */}
      <SignalValidationPanel
        isOpen={showValidationPanel}
        onClose={() => setShowValidationPanel(false)}
        belief={belief}
        currentAlgorithm={currentAlgorithm}
        onSubmit={handleValidationSubmit}
      />
    </div>
  );
};
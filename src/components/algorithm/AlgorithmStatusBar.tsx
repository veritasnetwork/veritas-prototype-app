'use client';

import { useState } from 'react';
import { Sliders, Sparkles, TrendingUp, Shield, Zap, Brain, ChevronRight } from 'lucide-react';
import { Algorithm } from '@/types/algorithm.types';
import { AlgorithmPickerModal } from './AlgorithmPickerModal';

interface AlgorithmStatusBarProps {
  currentAlgorithm: Algorithm | null;
  onAlgorithmChange: (algorithm: Algorithm) => void;
}

export const AlgorithmStatusBar: React.FC<AlgorithmStatusBarProps> = ({
  currentAlgorithm,
  onAlgorithmChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getAlgorithmIcon = () => {
    if (!currentAlgorithm) return Sliders;
    
    const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
      'balanced-discovery': Sliders,
      'truth-seeker': Shield,
      'breaking-news': Zap,
      'deep-analysis': Brain,
      'viral-content': TrendingUp,
    };
    
    return iconMap[currentAlgorithm.id] || Sliders;
  };

  const getTopSignals = () => {
    if (!currentAlgorithm) return [];
    
    // Get top 4 weighted signals
    const sorted = Object.entries(currentAlgorithm.weights)
      .filter(([, weight]) => weight > 0)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([key, weight]) => ({
        key,
        weight,
        displayName: key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }));
    
    return sorted;
  };

  const Icon = getAlgorithmIcon();
  const topSignals = getTopSignals();
  const activeSignalsCount = currentAlgorithm 
    ? Object.values(currentAlgorithm.weights).filter(w => w > 0).length 
    : 0;

  return (
    <>
      {/* Algorithm Status Bar - Entire bar is clickable */}
      <div 
        onClick={() => setIsModalOpen(true)}
        className="flex-1 min-w-0 bg-white/50 dark:bg-veritas-eggshell/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-gray-200/50 dark:border-veritas-eggshell/10 overflow-hidden cursor-pointer hover:bg-white/70 dark:hover:bg-veritas-eggshell/10 transition-all duration-200"
      >
        <div className="flex items-center h-full px-3 md:px-4 py-2 md:py-2.5">
          
          {/* Left Section - Algorithm Identity */}
          <div className="flex items-center space-x-2 md:space-x-3 md:pr-4 md:border-r border-gray-200 dark:border-veritas-eggshell/10">
            <div className="p-1 md:p-1.5 bg-veritas-primary dark:bg-veritas-light-blue rounded-lg">
              <Icon className="w-4 h-4 text-white dark:text-veritas-darker-blue" />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center space-x-1 md:space-x-1.5">
                <span className="font-bold text-xs md:text-sm text-veritas-primary dark:text-veritas-eggshell truncate max-w-[100px] md:max-w-none">
                  {currentAlgorithm?.name || 'No Algorithm'}
                </span>
                {currentAlgorithm?.type === 'user' && (
                  <Sparkles className="w-3 h-3 text-veritas-secondary dark:text-veritas-orange flex-shrink-0" />
                )}
              </div>
              <div className="text-[10px] md:text-xs text-gray-600 dark:text-veritas-eggshell/50 hidden md:block">
                {activeSignalsCount} active signals
              </div>
            </div>
          </div>

          {/* Center Section - Key Signal Indicators - Hidden on mobile, shown on md+ */}
          <div className="hidden md:flex flex-1 items-center px-4 space-x-3 overflow-hidden">
            {topSignals.length > 0 ? (
              topSignals.map((signal, index) => (
                <div key={signal.key} className="flex items-center space-x-2 min-w-0">
                  {index > 0 && (
                    <div className="w-px h-5 bg-gray-200 dark:bg-veritas-eggshell/10 flex-shrink-0" />
                  )}
                  
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] text-gray-500 dark:text-veritas-eggshell/40 uppercase tracking-wider">
                        {signal.displayName}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-bold text-veritas-primary dark:text-veritas-light-blue">
                          {signal.weight}%
                        </span>
                        {/* Mini progress bar */}
                        <div className="w-10 h-1 bg-gray-200 dark:bg-veritas-eggshell/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-veritas-primary dark:bg-veritas-light-blue rounded-full transition-all duration-300"
                            style={{ width: `${signal.weight}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <span className="text-sm text-gray-500 dark:text-veritas-eggshell/40">
                No algorithm selected
              </span>
            )}
          </div>

          {/* Mobile Center - Compact signal dots */}
          <div className="flex md:hidden flex-1 items-center px-3 space-x-2">
            <div className="flex items-center space-x-1.5">
              {topSignals.slice(0, 3).map((signal) => (
                <div key={signal.key} className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-veritas-primary dark:bg-veritas-light-blue rounded-full" />
                  <span className="text-[10px] text-gray-600 dark:text-veritas-eggshell/60 font-medium">
                    {signal.displayName.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Section - Desktop Action Area, Mobile Tap Indicator */}
          <div className="flex items-center">
            {/* Desktop Configure Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
              className="hidden md:flex items-center space-x-2 px-4 py-2 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 rounded-xl transition-all duration-200 group ml-2 font-medium shadow-sm hover:shadow-md"
            >
              <Sliders className="w-4 h-4" />
              <span className="text-sm">
                Configure
              </span>
              <ChevronRight className="w-3 h-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </button>
            
            {/* Mobile Tap Indicator */}
            <div className="md:hidden flex items-center space-x-1 text-gray-500 dark:text-veritas-eggshell/40">
              <span className="text-[10px]">Tap to edit</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm Picker Modal */}
      <AlgorithmPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentAlgorithm={currentAlgorithm}
        onSelectAlgorithm={onAlgorithmChange}
      />
    </>
  );
};
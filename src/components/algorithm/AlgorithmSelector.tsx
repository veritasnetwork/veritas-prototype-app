'use client';

import { useState } from 'react';
import { ChevronDown, Sliders, Sparkles } from 'lucide-react';
import { Algorithm } from '@/types/algorithm.types';
import { AlgorithmPickerModal } from './AlgorithmPickerModal';

interface AlgorithmSelectorProps {
  currentAlgorithm: Algorithm | null;
  onAlgorithmChange: (algorithm: Algorithm) => void;
}

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
  currentAlgorithm,
  onAlgorithmChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getTopSignals = () => {
    if (!currentAlgorithm) return [];
    
    // Get top 3 weighted signals
    const sorted = Object.entries(currentAlgorithm.weights)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([key, weight]) => ({
        key,
        weight
      }));
    
    return sorted;
  };

  const topSignals = getTopSignals();

  return (
    <>
      {/* Algorithm Selector Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="group flex items-center space-x-3 px-4 py-3 bg-white dark:bg-veritas-darker-blue/95 hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10 border border-gray-200 dark:border-veritas-eggshell/10 rounded-2xl transition-all duration-300 hover:shadow-lg dark:hover:shadow-xl hover:scale-105"
      >
        <div className="p-2 bg-gradient-to-r from-veritas-primary to-veritas-secondary dark:from-veritas-light-blue dark:to-veritas-orange rounded-xl">
          <Sliders className="w-4 h-4 text-white dark:text-veritas-darker-blue" />
        </div>
        
        <div className="text-left">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-veritas-primary dark:text-veritas-eggshell">
              {currentAlgorithm?.name || 'Select Algorithm'}
            </span>
            {currentAlgorithm?.type === 'user' && (
              <Sparkles className="w-3 h-3 text-veritas-secondary dark:text-veritas-orange" />
            )}
          </div>
          
          {topSignals.length > 0 && (
            <div className="flex items-center space-x-2 mt-0.5">
              {topSignals.map((signal, index) => (
                <span key={signal.key} className="flex items-center">
                  <span className="text-xs text-gray-500 dark:text-veritas-eggshell/40">
                    {signal.key.replace('_', ' ')}
                  </span>
                  {index < topSignals.length - 1 && (
                    <span className="mx-1 text-gray-400 dark:text-veritas-eggshell/30">·</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-veritas-eggshell/40 group-hover:text-veritas-primary dark:group-hover:text-veritas-eggshell transition-colors" />
      </button>

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
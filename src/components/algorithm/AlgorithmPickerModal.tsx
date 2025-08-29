'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, TrendingUp, Shield, Zap, Globe, Brain, ChevronRight } from 'lucide-react';
import { Algorithm, SignalConfig } from '@/types/algorithm.types';
import { getAllAlgorithms, getAllSignalConfigs } from '@/lib/data';
import { createCustomAlgorithm, normalizeWeights } from '@/lib/algorithmEngine';

interface AlgorithmPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAlgorithm: Algorithm | null;
  onSelectAlgorithm: (algorithm: Algorithm) => void;
}

export const AlgorithmPickerModal: React.FC<AlgorithmPickerModalProps> = ({
  isOpen,
  onClose,
  currentAlgorithm,
  onSelectAlgorithm,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [presetAlgorithms, setPresetAlgorithms] = useState<Algorithm[]>([]);
  const [signalConfigs, setSignalConfigs] = useState<SignalConfig[]>([]);
  const [customWeights, setCustomWeights] = useState<{ [key: string]: number }>({});
  const [customName, setCustomName] = useState('My Algorithm');
  const [hoveredAlgorithm, setHoveredAlgorithm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load algorithms and signal configs
      const algorithms = getAllAlgorithms();
      const signals = getAllSignalConfigs();
      setPresetAlgorithms(algorithms);
      setSignalConfigs(signals);
      
      // Initialize custom weights from current algorithm or defaults
      if (currentAlgorithm?.type === 'user') {
        setCustomWeights(currentAlgorithm.weights);
        setCustomName(currentAlgorithm.name);
        setActiveTab('custom');
      } else {
        // Initialize with default weights
        const defaultWeights: { [key: string]: number } = {};
        signals.forEach(signal => {
          defaultWeights[signal.key] = signal.defaultWeight;
        });
        setCustomWeights(defaultWeights);
      }
    }
  }, [isOpen, currentAlgorithm]);

  const handleCustomWeightChange = (signalKey: string, value: number) => {
    setCustomWeights(prev => ({
      ...prev,
      [signalKey]: value
    }));
  };

  const handleApplyCustom = () => {
    const normalizedWeights = normalizeWeights(customWeights);
    const customAlgorithm = createCustomAlgorithm(
      normalizedWeights,
      customName,
      'Custom algorithm created by user'
    );
    onSelectAlgorithm(customAlgorithm);
    onClose();
  };

  const handleSelectPreset = (algorithm: Algorithm) => {
    onSelectAlgorithm(algorithm);
    onClose();
  };

  const getIconForAlgorithm = (algorithmId: string) => {
    const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
      'balanced-discovery': Sliders,
      'truth-seeker': Shield,
      'breaking-news': Zap,
      'deep-analysis': Brain,
      'viral-content': TrendingUp,
      'global-perspective': Globe,
    };
    return iconMap[algorithmId] || Sliders;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'accuracy': 'from-blue-500 to-blue-600',
      'impact': 'from-orange-500 to-orange-600',
      'quality': 'from-purple-500 to-purple-600',
      'temporal': 'from-red-500 to-red-600',
      'engagement': 'from-yellow-500 to-yellow-600',
    };
    return colors[category] || 'from-gray-500 to-gray-600';
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-white dark:bg-veritas-darker-blue rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200 dark:border-veritas-eggshell/10">
          <div>
            <h2 className="text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell">
              Algorithm Selection
            </h2>
            <p className="text-sm text-gray-600 dark:text-veritas-eggshell/60 mt-1">
              Choose how content is ranked and discovered
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-veritas-eggshell/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-veritas-eggshell/60" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-veritas-eggshell/10">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
              activeTab === 'presets'
                ? 'text-veritas-primary dark:text-veritas-eggshell border-b-2 border-veritas-primary dark:border-veritas-light-blue bg-gray-50/50 dark:bg-veritas-eggshell/5'
                : 'text-gray-600 dark:text-veritas-eggshell/60 hover:text-gray-900 dark:hover:text-veritas-eggshell hover:bg-gray-50 dark:hover:bg-veritas-eggshell/5'
            }`}
          >
            Preset Algorithms
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
              activeTab === 'custom'
                ? 'text-veritas-primary dark:text-veritas-eggshell border-b-2 border-veritas-primary dark:border-veritas-light-blue bg-gray-50/50 dark:bg-veritas-eggshell/5'
                : 'text-gray-600 dark:text-veritas-eggshell/60 hover:text-gray-900 dark:hover:text-veritas-eggshell hover:bg-gray-50 dark:hover:bg-veritas-eggshell/5'
            }`}
          >
            Create Custom Algorithm
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'presets' ? (
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {presetAlgorithms.map(algorithm => {
                  const Icon = getIconForAlgorithm(algorithm.id);
                  const isSelected = currentAlgorithm?.id === algorithm.id;
                  
                  return (
                    <button
                      key={algorithm.id}
                      onClick={() => handleSelectPreset(algorithm)}
                      onMouseEnter={() => setHoveredAlgorithm(algorithm.id)}
                      onMouseLeave={() => setHoveredAlgorithm(null)}
                      className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-veritas-primary dark:border-veritas-light-blue bg-veritas-primary/5 dark:bg-veritas-light-blue/10'
                          : 'border-gray-200 dark:border-veritas-eggshell/10 hover:border-veritas-primary/50 dark:hover:border-veritas-light-blue/50 hover:bg-gray-50 dark:hover:bg-veritas-eggshell/5'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-2 h-2 bg-veritas-primary dark:bg-veritas-light-blue rounded-full animate-pulse" />
                      )}
                      
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 rounded-xl ${
                          isSelected
                            ? 'bg-veritas-primary dark:bg-veritas-light-blue'
                            : 'bg-gray-100 dark:bg-veritas-eggshell/10'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            isSelected
                              ? 'text-white dark:text-veritas-darker-blue'
                              : 'text-gray-600 dark:text-veritas-eggshell/60'
                          }`} />
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-veritas-primary dark:text-veritas-eggshell mb-1">
                            {algorithm.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-veritas-eggshell/60 mb-3">
                            {algorithm.description}
                          </p>
                          
                          {/* Stats */}
                          <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-500 dark:text-veritas-eggshell/40">Users:</span>
                              <span className="font-medium text-gray-700 dark:text-veritas-eggshell/70">
                                {algorithm.popularity?.toLocaleString() || '0'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-500 dark:text-veritas-eggshell/40">Performance:</span>
                              <span className="font-medium text-gray-700 dark:text-veritas-eggshell/70">
                                {algorithm.performance || 0}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Preview top signals on hover */}
                          {hoveredAlgorithm === algorithm.id && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-veritas-eggshell/10">
                              <div className="text-xs text-gray-500 dark:text-veritas-eggshell/40 mb-2">
                                Top Weighted Signals:
                              </div>
                              {Object.entries(algorithm.weights)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 3)
                                .map(([key, weight]) => (
                                  <div key={key} className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-gray-600 dark:text-veritas-eggshell/60">
                                      {signalConfigs.find(s => s.key === key)?.name || key}
                                    </span>
                                    <span className="font-medium text-gray-700 dark:text-veritas-eggshell/70">
                                      {weight}%
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8">
              {/* Custom Algorithm Name */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 dark:text-veritas-eggshell mb-2">
                  Algorithm Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-veritas-eggshell/10 rounded-xl bg-white dark:bg-veritas-eggshell/5 text-gray-900 dark:text-veritas-eggshell placeholder-gray-400 dark:placeholder-veritas-eggshell/40 focus:outline-none focus:ring-2 focus:ring-veritas-primary dark:focus:ring-veritas-light-blue"
                  placeholder="Enter a name for your algorithm"
                />
              </div>

              {/* Signal Sliders - Grouped by Category */}
              <div className="space-y-8">
                {['accuracy', 'impact', 'quality', 'temporal', 'engagement'].map(category => {
                  const categorySignals = signalConfigs.filter(s => s.category === category);
                  if (categorySignals.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-4">
                      <h3 className={`text-sm font-semibold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${getCategoryColor(category)}`}>
                        {category}
                      </h3>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {categorySignals.map(signal => (
                          <div key={signal.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700 dark:text-veritas-eggshell">
                                {signal.name}
                              </label>
                              <span className="text-sm font-bold text-veritas-primary dark:text-veritas-light-blue">
                                {customWeights[signal.key] || 0}%
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-veritas-eggshell/40">
                              {signal.description}
                            </p>
                            <div className="relative">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={customWeights[signal.key] || 0}
                                onChange={(e) => handleCustomWeightChange(signal.key, parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-veritas-eggshell/10 rounded-lg appearance-none cursor-pointer slider"
                                style={{
                                  background: `linear-gradient(to right, ${signal.color} 0%, ${signal.color} ${customWeights[signal.key] || 0}%, rgb(229 231 235) ${customWeights[signal.key] || 0}%, rgb(229 231 235) 100%)`
                                }}
                              />
                              {/* Tick marks */}
                              <div className="absolute w-full flex justify-between text-xs text-gray-400 dark:text-veritas-eggshell/30 mt-1 pointer-events-none">
                                <span>0</span>
                                <span>25</span>
                                <span>50</span>
                                <span>75</span>
                                <span>100</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Apply Custom Algorithm Button */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleApplyCustom}
                  className="flex items-center space-x-2 px-6 py-3 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-xl font-semibold hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors"
                >
                  <span>Apply Custom Algorithm</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  return typeof window !== 'undefined' ? createPortal(
    modalContent,
    document.body
  ) : null;
};
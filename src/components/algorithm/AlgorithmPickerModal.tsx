'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, TrendingUp, Shield, Zap, Globe, Brain, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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
  const [selectedPresetAlgorithm, setSelectedPresetAlgorithm] = useState<Algorithm | null>(null);

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
        // Set selected preset algorithm to current algorithm if it's a preset
        if (currentAlgorithm) {
          setSelectedPresetAlgorithm(currentAlgorithm);
        } else if (algorithms.length > 0) {
          setSelectedPresetAlgorithm(algorithms[0]);
        }
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
    setSelectedPresetAlgorithm(algorithm);
    onSelectAlgorithm(algorithm);
    onClose();
  };
  
  const handlePresetClick = (algorithm: Algorithm) => {
    setSelectedPresetAlgorithm(algorithm);
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
  
  const getSignalColors = () => [
    '#1B365D', '#4BA3F5', '#FFB800', '#FF6B6B', 
    '#4ECDC4', '#95E77E', '#9B59B6', '#F39C12',
    '#E74C3C', '#3498DB', '#2ECC71', '#E67E22',
    '#1ABC9C', '#34495E', '#FFC0CB', '#9B59B6'
  ];

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

  // Memoize chart data to prevent recalculation - normalize weights to percentages
  const chartData = useMemo(() => {
    if (!selectedPresetAlgorithm || signalConfigs.length === 0) return [];
    
    // Calculate total weight
    const totalWeight = Object.values(selectedPresetAlgorithm.weights)
      .filter(weight => weight > 0)
      .reduce((sum, weight) => sum + weight, 0);
    
    // Normalize to percentages
    return Object.entries(selectedPresetAlgorithm.weights)
      .filter(([, weight]) => weight > 0)
      .map(([key, weight]) => ({
        name: signalConfigs.find(s => s.key === key)?.name || key,
        value: Math.round((weight / totalWeight) * 100), // Normalized percentage
        rawWeight: weight, // Keep raw weight for reference
        key
      }));
  }, [selectedPresetAlgorithm, signalConfigs]);

  // Memoize colors
  const signalColors = useMemo(() => getSignalColors(), []);

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
            <div className="p-8 space-y-8">
              {/* Algorithm Summary Section - Expanded */}
              {selectedPresetAlgorithm && signalConfigs.length > 0 && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-veritas-eggshell/5 dark:to-veritas-eggshell/10 rounded-3xl p-6 border-2 border-gray-200 dark:border-veritas-eggshell/10 shadow-lg animate-fade-in">
                  <h3 className="text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell mb-6 flex items-center">
                    <span className="mr-3">Algorithm Overview:</span>
                    <span className="text-veritas-secondary dark:text-veritas-orange">{selectedPresetAlgorithm.name}</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* Left: Enhanced Pie Chart - height determined by content */}
                    <div className="flex flex-col">
                      <h4 className="text-lg font-semibold text-gray-700 dark:text-veritas-eggshell/90 mb-6 text-center">
                        Normalised Signal Weight Distribution For Chosen Algorithm
                      </h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={110}
                            innerRadius={45}
                            fill="#8884d8"
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={600}
                            animationEasing="ease-out"
                          >
                            {chartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={signalColors[index % signalColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `${value}%`}
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                              border: '1px solid #ccc',
                              borderRadius: '8px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      {/* Custom Legend Below Chart */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {chartData.map((item, index) => (
                          <div key={item.key} className="flex items-center space-x-2 text-sm">
                            <div 
                              className="w-4 h-4 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: signalColors[index % signalColors.length] }}
                            />
                            <span className="text-gray-600 dark:text-veritas-eggshell/70 truncate">
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Right: Enhanced Signal List with Progress Bars - fixed height matching left column */}
                    <div className="bg-white dark:bg-veritas-darker-blue/40 rounded-2xl p-6 border border-gray-200 dark:border-veritas-eggshell/10 h-[460px] flex flex-col">
                      <h4 className="text-lg font-semibold text-gray-700 dark:text-veritas-eggshell/90 mb-6">
                        Detailed Signal Weightings
                      </h4>
                      <div className="space-y-4 overflow-y-auto pr-3 flex-1">
                        {Object.entries(selectedPresetAlgorithm.weights)
                          .filter(([, weight]) => weight > 0)
                          .sort(([,a], [,b]) => b - a)
                          .map(([key, weight]) => (
                            <div key={key} className="group">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-700 dark:text-veritas-eggshell/80 font-medium group-hover:text-veritas-primary dark:group-hover:text-veritas-light-blue transition-colors">
                                  {signalConfigs.find(s => s.key === key)?.name || key}
                                </span>
                                <span className="font-bold text-gray-800 dark:text-veritas-eggshell bg-gray-100 dark:bg-veritas-eggshell/10 px-2 py-1 rounded-lg">
                                  {weight}
                                </span>
                              </div>
                              <div className="w-full h-3 bg-gray-200 dark:bg-veritas-eggshell/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-veritas-secondary dark:bg-veritas-orange rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${Math.min(weight, 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Preset Algorithm Cards */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-veritas-eggshell/90">
                    Select a Preset Algorithm
                  </h3>
                  {selectedPresetAlgorithm && selectedPresetAlgorithm.id !== currentAlgorithm?.id && (
                    <button
                      onClick={() => handleSelectPreset(selectedPresetAlgorithm)}
                      className="px-6 py-2.5 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-xl font-medium hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors"
                    >
                      Apply {selectedPresetAlgorithm.name}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {presetAlgorithms.map(algorithm => {
                    const Icon = getIconForAlgorithm(algorithm.id);
                    const isSelected = selectedPresetAlgorithm?.id === algorithm.id;
                  
                  return (
                    <button
                      key={algorithm.id}
                      onClick={() => handlePresetClick(algorithm)}
                      onDoubleClick={() => handleSelectPreset(algorithm)}
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
                          <h3 className="font-semibold text-veritas-primary dark:text-veritas-eggshell mb-3">
                            {algorithm.name}
                          </h3>
                          
                          {/* Stats - Only show users count */}
                          <div className="flex items-center text-xs mb-4">
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-500 dark:text-veritas-eggshell/40">Users:</span>
                              <span className="font-medium text-gray-700 dark:text-veritas-eggshell/70">
                                {algorithm.popularity?.toLocaleString() || '0'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Top signals - Always visible */}
                          <div className="pt-3 border-t border-gray-200 dark:border-veritas-eggshell/10">
                            <div className="text-xs text-gray-500 dark:text-veritas-eggshell/40 mb-2">
                              Top Weighted Signals:
                            </div>
                            {(() => {
                              const totalWeight = Object.values(algorithm.weights)
                                .filter(w => w > 0)
                                .reduce((sum, w) => sum + w, 0);
                              
                              return Object.entries(algorithm.weights)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 3)
                                .map(([key, weight]) => {
                                  const percentage = Math.round((weight / totalWeight) * 100);
                                  return (
                                    <div key={key} className="mb-2">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-gray-600 dark:text-veritas-eggshell/60">
                                          {signalConfigs.find(s => s.key === key)?.name || key}
                                        </span>
                                        <span className="font-medium text-gray-700 dark:text-veritas-eggshell/70">
                                          {percentage}%
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 bg-gray-200 dark:bg-veritas-eggshell/10 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-veritas-primary dark:bg-veritas-light-blue rounded-full transition-all duration-300"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                });
                            })()}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                </div>
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
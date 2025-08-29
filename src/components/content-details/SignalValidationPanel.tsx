'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, CheckCircle, Loader2, Clock } from 'lucide-react';
import { Belief } from '@/types/belief.types';
import { Algorithm } from '@/types/algorithm.types';
import { ensureContentSignals, getSignalColor } from '@/lib/signals-utils';

export interface SignalUpdates {
  [signalKey: string]: {
    myBelief: number;
    othersBelief: number;
  };
}

interface SignalValidationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  belief: Belief;
  currentAlgorithm?: Algorithm | null; // Pass algorithm from parent component
  onSubmit?: (updates: SignalUpdates) => void;
}

export const SignalValidationPanel: React.FC<SignalValidationPanelProps> = ({
  isOpen,
  onClose,
  belief,
  currentAlgorithm,
  onSubmit
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [signalUpdates, setSignalUpdates] = useState<SignalUpdates>({});
  const [totalRelevance, setTotalRelevance] = useState({ myBelief: 50, othersBelief: 50 });
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [timeUntilScoring, setTimeUntilScoring] = useState<string>('');
  
  // Calculate time until next epoch (4-hour epochs starting at midnight UTC)
  const calculateTimeUntilNextEpoch = () => {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinutes = now.getUTCMinutes();
    const currentSeconds = now.getUTCSeconds();
    
    // Epochs at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
    const epochHours = [0, 4, 8, 12, 16, 20];
    
    // Find next epoch hour
    let nextEpochHour = epochHours.find(h => h > currentHour);
    if (!nextEpochHour && nextEpochHour !== 0) {
      nextEpochHour = epochHours[0]; // Next day at midnight
    }
    
    // Calculate time difference
    let hoursUntil = nextEpochHour - currentHour;
    if (hoursUntil <= 0) {
      hoursUntil += 24; // Next day
    }
    
    const minutesUntil = 59 - currentMinutes;
    const secondsUntil = 59 - currentSeconds;
    
    // Adjust hours if minutes are negative
    const totalMinutes = (hoursUntil - 1) * 60 + minutesUntil;
    const displayHours = Math.floor(totalMinutes / 60);
    const displayMinutes = totalMinutes % 60;
    
    return `${displayHours}h ${displayMinutes}m ${secondsUntil}s`;
  };

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  }, []);

  // Portal mounting
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Update countdown timer every second
  useEffect(() => {
    const updateTimer = () => {
      setTimeUntilScoring(calculateTimeUntilNextEpoch());
    };
    
    // Initial update
    updateTimer();
    
    // Update every second
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize signal updates when modal opens
  useEffect(() => {
    if (isOpen) {
      const signals = ensureContentSignals(belief);
      const initialUpdates: SignalUpdates = {};
      
      Object.values(signals).forEach(signal => {
        initialUpdates[signal.key] = {
          myBelief: signal.currentValue,
          othersBelief: signal.currentValue
        };
      });
      
      setSignalUpdates(initialUpdates);
      // Set initial total relevance based on average of all signals
      const avgValue = Object.values(signals).reduce((sum, s) => sum + s.currentValue, 0) / Object.values(signals).length;
      setTotalRelevance({ myBelief: Math.round(avgValue), othersBelief: Math.round(avgValue) });
      
      // Reset submission states
      setSubmitSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, belief]);

  // Handle individual signal updates
  const handleSignalUpdate = (signalKey: string, type: 'myBelief' | 'othersBelief', value: number) => {
    setSignalUpdates(prev => ({
      ...prev,
      [signalKey]: {
        ...prev[signalKey],
        [type]: value
      }
    }));
  };

  // Handle total relevance changes
  const handleTotalRelevanceChange = (type: 'myBelief' | 'othersBelief', newValue: number) => {
    const oldValue = totalRelevance[type];
    const delta = newValue - oldValue;
    
    // Update total relevance
    setTotalRelevance(prev => ({ ...prev, [type]: newValue }));
    
    // Apply proportional change to signals
    setSignalUpdates(prev => {
      const updated = { ...prev };
      
      Object.keys(updated).forEach(signalKey => {
        // If there's an algorithm, only update weighted signals
        // If no algorithm, update all signals equally
        const shouldUpdate = currentAlgorithm 
          ? currentAlgorithm.weights[signalKey] > 0
          : true;
          
        if (shouldUpdate) {
          const currentValue = updated[signalKey][type];
          // Apply proportional change
          const newSignalValue = Math.max(0, Math.min(100, currentValue + delta));
          updated[signalKey] = {
            ...updated[signalKey],
            [type]: Math.round(newSignalValue)
          };
        }
      });
      
      return updated;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Simulate blockchain submission with delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate success
    setIsSubmitting(false);
    setSubmitSuccess(true);
    
    // Call the onSubmit callback
    if (onSubmit) {
      onSubmit(signalUpdates);
    }
    
    // Close modal after showing success for a moment
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const signals = ensureContentSignals(belief);
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

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-white dark:bg-veritas-darker-blue rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200 dark:border-veritas-eggshell/10">
          <div>
            <h2 className="text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell">
              Validate Signals
            </h2>
            <p className="text-sm text-gray-600 dark:text-veritas-eggshell/60 mt-1">
              Adjust signal values based on your belief and what you think others believe
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Countdown Timer */}
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-veritas-eggshell/60">
              <Clock className="w-4 h-4" />
              <div>
                <span className="text-xs uppercase tracking-wider opacity-70">Next scoring in</span>
                <div className="font-mono font-medium text-veritas-primary dark:text-veritas-eggshell">
                  {timeUntilScoring || 'Loading...'}
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-veritas-eggshell/10 transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5 text-gray-500 dark:text-veritas-eggshell/60" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex" style={{ height: 'calc(90vh - 200px)' }}>
          {/* Left Column - Individual Signals (80% width) */}
          <div className="w-4/5 p-8 overflow-y-auto border-r border-gray-200 dark:border-veritas-eggshell/10">
            <div className="space-y-6">
              {signalArray.map(signal => {
                const signalColor = getSignalColor(signal.key, isDarkMode);
                const updates = signalUpdates[signal.key] || { myBelief: 50, othersBelief: 50 };
                
                return (
                  <div key={signal.key} className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-2xl p-6">
                    {/* Signal Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: signalColor }} />
                        <h3 className="font-semibold text-veritas-primary dark:text-veritas-eggshell">
                          {signal.name}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-veritas-eggshell/50">
                        Current: {signal.currentValue}%
                      </div>
                    </div>
                    
                    {/* My Belief Slider */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-veritas-eggshell/80">
                          What I Believe
                        </label>
                        <span className="text-sm font-bold text-veritas-primary dark:text-veritas-eggshell">
                          {updates.myBelief}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={updates.myBelief}
                        onChange={(e) => handleSignalUpdate(signal.key, 'myBelief', parseInt(e.target.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-veritas-darker-blue/80"
                        style={{
                          background: `linear-gradient(to right, ${signalColor} 0%, ${signalColor} ${updates.myBelief}%, rgb(229 231 235) ${updates.myBelief}%, rgb(229 231 235) 100%)`
                        }}
                      />
                    </div>
                    
                    {/* Others Belief Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-veritas-eggshell/80">
                          What Others Believe
                        </label>
                        <span className="text-sm font-bold text-veritas-primary dark:text-veritas-eggshell">
                          {updates.othersBelief}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={updates.othersBelief}
                        onChange={(e) => handleSignalUpdate(signal.key, 'othersBelief', parseInt(e.target.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-veritas-darker-blue/80"
                        style={{
                          background: `linear-gradient(to right, ${signalColor} 0%, ${signalColor} ${updates.othersBelief}%, rgb(229 231 235) ${updates.othersBelief}%, rgb(229 231 235) 100%)`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Right Column - Total Relevance (20% width) */}
          <div className="w-1/5 p-6 bg-slate-50 dark:bg-veritas-darker-blue/40 flex flex-col">
            <div className="flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="font-semibold text-base text-veritas-primary dark:text-veritas-eggshell mb-2">
                  Total Relevance
                </h3>
                <p className="text-xs text-gray-600 dark:text-veritas-eggshell/60 leading-relaxed">
                  Bulk adjust all signals at once
                </p>
                {currentAlgorithm ? (
                  <div className="mt-2 px-2 py-1 bg-veritas-primary/10 dark:bg-veritas-light-blue/10 rounded text-xs">
                    <p className="text-veritas-primary dark:text-veritas-light-blue truncate">
                      {currentAlgorithm.name}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                    <p className="text-gray-600 dark:text-gray-400">
                      No algorithm
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex justify-around items-center py-4">
                {/* My Belief Vertical Slider */}
                <div className="flex flex-col items-center space-y-3">
                  <label className="text-xs font-medium text-gray-700 dark:text-veritas-eggshell/80 text-center">
                    My Belief
                  </label>
                  <div className="relative h-48 w-12">
                    {/* Track */}
                    <div className="absolute inset-x-0 inset-y-0 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    {/* Fill */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-veritas-primary dark:bg-veritas-light-blue rounded-full"
                      style={{ height: `${totalRelevance.myBelief}%` }}
                    />
                    {/* Hidden Input - inverted value to fix drag direction */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={100 - totalRelevance.myBelief}
                      onChange={(e) => handleTotalRelevanceChange('myBelief', 100 - parseInt(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ 
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        writingMode: 'vertical-lr' as any
                      }}
                    />
                  </div>
                  <div className="text-sm font-bold text-veritas-primary dark:text-veritas-eggshell">
                    {totalRelevance.myBelief}%
                  </div>
                </div>
                
                {/* Others Belief Vertical Slider */}
                <div className="flex flex-col items-center space-y-3">
                  <label className="text-xs font-medium text-gray-700 dark:text-veritas-eggshell/80 text-center">
                    Others
                  </label>
                  <div className="relative h-48 w-12">
                    {/* Track */}
                    <div className="absolute inset-x-0 inset-y-0 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    {/* Fill */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-veritas-secondary dark:bg-veritas-orange rounded-full"
                      style={{ height: `${totalRelevance.othersBelief}%` }}
                    />
                    {/* Hidden Input - inverted value to fix drag direction */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={100 - totalRelevance.othersBelief}
                      onChange={(e) => handleTotalRelevanceChange('othersBelief', 100 - parseInt(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ 
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        writingMode: 'vertical-lr' as any
                      }}
                    />
                  </div>
                  <div className="text-sm font-bold text-veritas-primary dark:text-veritas-eggshell">
                    {totalRelevance.othersBelief}%
                  </div>
                </div>
              </div>
              
              <div className="mt-auto p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Info className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Adjusts all weighted signals
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-200 dark:border-veritas-eggshell/10 bg-white dark:bg-veritas-darker-blue/70">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-8 py-3 text-gray-600 dark:text-veritas-eggshell/70 font-medium hover:text-gray-900 dark:hover:text-veritas-eggshell transition-colors disabled:opacity-50 rounded-xl hover:bg-gray-100 dark:hover:bg-veritas-eggshell/10"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <div className="flex items-center gap-4">
              {isSubmitting && (
                <span className="text-sm text-gray-500 dark:text-veritas-eggshell/50">
                  Processing BTS validation...
                </span>
              )}
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center gap-2 disabled:opacity-75 disabled:hover:scale-100 disabled:cursor-not-allowed"
                disabled={isSubmitting || submitSuccess}
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {submitSuccess && <CheckCircle className="w-5 h-5" />}
                <span>
                  {isSubmitting ? 'Submitting...' : submitSuccess ? 'Success!' : 'Submit Validation'}
                </span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Success Overlay */}
        {submitSuccess && (
          <div className="absolute inset-0 bg-white/90 dark:bg-veritas-darker-blue/90 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell mb-2">
                Validation Submitted!
              </h3>
              <p className="text-gray-600 dark:text-veritas-eggshell/70">
                Your signal updates have been submitted to the Veritas Protocol
              </p>
              <p className="text-sm text-gray-500 dark:text-veritas-eggshell/50 mt-2">
                Trust scores and stake will be updated in the next epoch
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Belief } from '@/types/belief.types';
import { TrendingUp, BookOpen, X, Check } from 'lucide-react';

interface ActionPanelProps {
  belief: Belief;
}

// New Component Understanding Modal Component
const ComponentUnderstandingModal: React.FC<{
  belief: Belief;
  isOpen: boolean;
  onClose: () => void;
  onContributeToTruth: () => void;
}> = ({ belief, isOpen, onClose, onContributeToTruth }) => {
  
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return typeof window !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-veritas-darker-blue rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="relative px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-gradient-to-br from-slate-50 to-white dark:from-veritas-darker-blue dark:to-veritas-darker-blue/90 border-b border-slate-200 dark:border-veritas-eggshell/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 mb-4 pr-10">
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell flex-shrink-0">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white dark:text-veritas-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell leading-tight">
                Contribute Your Understanding
              </h2>
              <p className="text-sm sm:text-base text-veritas-primary/70 dark:text-veritas-eggshell/70 leading-tight">
                How Veritas works
              </p>
            </div>
          </div>

          {/* Belief Topic Display */}
          <div className="bg-slate-100 dark:bg-black/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200/50 dark:border-white/10">
            <div className="flex items-start space-x-3">
              {belief.article?.thumbnail && (
                <Image 
                  src={belief.article.thumbnail}
                  alt={belief.heading.title}
                  width={48}
                  height={48}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0"
                  sizes="48px"
                  loading="eager"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-veritas-primary dark:text-veritas-eggshell line-clamp-2 mb-1 text-sm sm:text-base">
                  {belief.heading.title}
                </h3>
                {belief.heading.context && (
                  <p className="text-xs sm:text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 line-clamp-1">
                    {belief.heading.context}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
          {/* Main Explanation */}
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg sm:rounded-xl flex-shrink-0">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-2 sm:mb-3 text-base sm:text-lg">
                    Every Component is a Belief
                  </h4>
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed mb-3 sm:mb-4 text-sm sm:text-base">
                    In Veritas, every component you see is itself a belief that you can contribute to. 
                    The chart, the title, the metadata, and even the types of visualizations - all of these 
                    are nested components that represent collective intelligence.
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed text-sm sm:text-base">
                    You can contribute to the belief content, but also to the metadata, the title, 
                    the chart types, and more. Just click on any component and then submit your contribution.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-800/50 rounded-lg sm:rounded-xl flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 sm:mb-3 text-base sm:text-lg">
                    Full Functionality Coming Soon
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200 leading-relaxed text-sm sm:text-base">
                    We&apos;re building comprehensive component editing features that will allow you to 
                    contribute to every aspect of the intelligence. This includes editing visualizations, 
                    improving metadata, refining titles, and enhancing the overall presentation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Support */}
          <div className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-veritas-eggshell/10">
            <h4 className="font-bold text-veritas-primary dark:text-veritas-eggshell mb-2 sm:mb-3 text-base sm:text-lg">
              Currently Supported
            </h4>
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 leading-relaxed text-sm sm:text-base">
              For now, we support contribution to the truth belief through our Bayesian Truth Serum methodology. 
              This allows you to share your understanding of the topic&apos;s accuracy and relevance.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-slate-50 dark:bg-veritas-darker-blue/60 border-t border-slate-200 dark:border-veritas-eggshell/10">
          <button
            onClick={onContributeToTruth}
            className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-xl sm:rounded-2xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            <div className="flex items-center justify-center space-x-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Contribute to Truth</span>
            </div>
          </button>

          <p className="text-xs text-center text-veritas-primary/60 dark:text-veritas-eggshell/60 mt-2 sm:mt-3">
            Your contribution helps improve collective intelligence
          </p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

// Original Belief Submission Modal Component (renamed for clarity)
const BeliefSubmissionModal: React.FC<{
  belief: Belief;
  isOpen: boolean;
  onClose: () => void;
}> = ({ belief, isOpen, onClose }) => {
  const [certainty, setCertainty] = useState(50);
  const [truthValue, setTruthValue] = useState(50);
  const [othersWillSay, setOthersWillSay] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleCertaintyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCertainty(parseInt(e.target.value));
  };

  const handleTruthValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTruthValue(parseInt(e.target.value));
  };

  const handleOthersWillSayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOthersWillSay(parseInt(e.target.value));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // TODO: Replace with actual API call to submit belief
      // Example API structure:
      // await submitBelief({
      //   beliefId: belief.id,
      //   certainty: certainty,
      //   truthValue: truthValue,
      //   othersWillSay: othersWillSay,
      //   userId: currentUser.id,
      //   timestamp: new Date().toISOString()
      // });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setShowConfirmation(true);
      
      // Auto-close confirmation after 3 seconds (longer for 3 values)
      setTimeout(() => {
        setShowConfirmation(false);
        onClose();
        // Reset all sliders for next time
        setCertainty(50);
        setTruthValue(50);
        setOthersWillSay(50);
      }, 3000);
      
    } catch (error) {
      console.error('Submission failed:', error);
      // TODO: Add proper error handling
      alert('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getValueColor = () => {
    // Always return Veritas orange for consistency
    return 'bg-veritas-orange';
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Confirmation State
  if (showConfirmation) {
        return typeof window !== 'undefined' ? createPortal(
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
        onClick={(e) => {
          // Close modal when clicking on backdrop
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white dark:bg-veritas-darker-blue/95 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-6 sm:p-8 text-center shadow-2xl border border-slate-200 dark:border-veritas-eggshell/10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Check className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h3 className="text-lg sm:text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell mb-3 sm:mb-4">
            Belief Submitted Successfully!
          </h3>
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-slate-50 dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl">
              <span className="text-xs sm:text-sm font-medium text-veritas-primary/70 dark:text-veritas-eggshell/70">Certainty Level:</span>
              <span className="text-sm sm:text-lg font-bold text-veritas-primary dark:text-veritas-eggshell">{certainty}%</span>
            </div>
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-slate-50 dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl">
              <span className="text-xs sm:text-sm font-medium text-veritas-primary/70 dark:text-veritas-eggshell/70">Your Belief:</span>
              <span className="text-sm sm:text-lg font-bold text-veritas-primary dark:text-veritas-eggshell">{truthValue}%</span>
            </div>
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-slate-50 dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl">
              <span className="text-xs sm:text-sm font-medium text-veritas-primary/70 dark:text-veritas-eggshell/70">Others&apos; Belief:</span>
              <span className="text-sm sm:text-lg font-bold text-veritas-primary dark:text-veritas-eggshell">{othersWillSay}%</span>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-veritas-primary/60 dark:text-veritas-eggshell/60">
            Thank you for contributing to collective intelligence
          </div>
        </div>
      </div>,
      document.body
    ) : null;
  }

  return typeof window !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-veritas-darker-blue rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="relative px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-gradient-to-br from-slate-50 to-white dark:from-veritas-darker-blue dark:to-veritas-darker-blue/90 border-b border-slate-200 dark:border-veritas-eggshell/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 mb-4 pr-10">
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell flex-shrink-0">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white dark:text-veritas-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell leading-tight">
                Submit Your Understanding
              </h2>
              <p className="text-sm sm:text-base text-veritas-primary/70 dark:text-veritas-eggshell/70 leading-tight">
                How certain are you about this topic?
              </p>
            </div>
          </div>

          {/* Belief Topic Display */}
          <div className="bg-slate-100 dark:bg-black/30 rounded-2xl p-4 border border-slate-200/50 dark:border-white/10">
            <div className="flex items-start space-x-3">
              {belief.article?.thumbnail && (
                <Image 
                  src={belief.article.thumbnail}
                  alt={belief.heading.title}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-veritas-primary dark:text-veritas-eggshell line-clamp-2 mb-1">
                  {belief.heading.title}
                </h3>
                {belief.heading.context && (
                  <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 line-clamp-1">
                    {belief.heading.context}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Three Sliders Section */}
          <div className="space-y-6 sm:space-y-8">
            {/* Certainty Slider */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-veritas-primary dark:text-veritas-eggshell text-sm sm:text-base">
                    Certainty Level
                  </h4>
                  <p className="text-xs text-veritas-primary/60 dark:text-veritas-eggshell/60 leading-tight">
                    How confident you are in your assessment
                  </p>
                </div>
                <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full ${getValueColor()} text-white font-bold text-sm sm:text-lg flex-shrink-0`}>
                  {certainty}%
                </div>
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 font-medium">
                <span>Unsure</span>
                <span>Very Certain</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={certainty}
                  onChange={handleCertaintyChange}
                  className="w-full h-2.5 sm:h-3 bg-slate-200 dark:bg-veritas-darker-blue/80 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            {/* Truth Value Slider */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-veritas-primary dark:text-veritas-eggshell text-sm sm:text-base">
                    Your Belief
                  </h4>
                  <p className="text-xs text-veritas-primary/60 dark:text-veritas-eggshell/60 leading-tight">
                    What you personally think is true
                  </p>
                </div>
                <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full ${getValueColor()} text-white font-bold text-sm sm:text-lg flex-shrink-0`}>
                  {truthValue}%
                </div>
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 font-medium">
                <span>False</span>
                <span>True</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={truthValue}
                  onChange={handleTruthValueChange}
                  className="w-full h-2.5 sm:h-3 bg-slate-200 dark:bg-veritas-darker-blue/80 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            {/* Others Will Say Slider */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-veritas-primary dark:text-veritas-eggshell text-sm sm:text-base">
                    Others&apos; Belief
                  </h4>
                  <p className="text-xs text-veritas-primary/60 dark:text-veritas-eggshell/60 leading-tight">
                    What you think others will say
                  </p>
                </div>
                <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full ${getValueColor()} text-white font-bold text-sm sm:text-lg flex-shrink-0`}>
                  {othersWillSay}%
                </div>
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 font-medium">
                <span>Others Say False</span>
                <span>Others Say True</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={othersWillSay}
                  onChange={handleOthersWillSayChange}
                  className="w-full h-2.5 sm:h-3 bg-slate-200 dark:bg-veritas-darker-blue/80 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>

          {/* Custom Slider Styles */}
          <style jsx>{`
            .slider::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #EA900E;
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(234, 144, 14, 0.4);
            }
            
            .slider::-moz-range-thumb {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #EA900E;
              cursor: pointer;
              border: none;
              box-shadow: 0 2px 8px rgba(234, 144, 14, 0.4);
            }
            
            .slider::-webkit-slider-track {
              background: rgba(148, 163, 184, 0.5);
            }
            
            .slider::-moz-range-track {
              background: rgba(148, 163, 184, 0.5);
            }
            
            @media (min-width: 640px) {
              .slider::-webkit-slider-thumb {
                width: 24px;
                height: 24px;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
              }
              
              .slider::-moz-range-thumb {
                width: 24px;
                height: 24px;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
              }
            }
          `}</style>

          {/* Information Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg flex-shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1 text-sm sm:text-base">
                  Bayesian Truth Serum
                </h4>
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  Your personal belief, prediction of others&apos; beliefs, and certainty level help reveal collective intelligence and improve truth-finding through advanced statistical analysis.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-slate-50 dark:bg-veritas-darker-blue/60 border-t border-slate-200 dark:border-veritas-eggshell/10">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`
              w-full py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-semibold transition-all duration-300 text-sm sm:text-base
              ${isSubmitting 
                ? 'bg-slate-400 text-white cursor-not-allowed' 
                : 'bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue hover:shadow-lg active:scale-95 hover:scale-105'
              }
            `}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting Your Understanding...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Submit All 3 Rankings</span>
              </div>
            )}
          </button>

          <p className="text-xs text-center text-veritas-primary/60 dark:text-veritas-eggshell/60 mt-2 sm:mt-3">
            Your submission will contribute to the collective understanding of this topic
          </p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

// Simplified ActionPanel Component
export const ActionPanel: React.FC<ActionPanelProps> = ({ belief }) => {
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);



  const handleContributeToTruth = () => {
    setShowComponentModal(false);
    setShowSubmissionModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Share Your Understanding Button */}
      {!hasSubmitted ? (
        <button
          onClick={() => setShowComponentModal(true)}
          className="w-full py-4 px-6 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-2xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <div className="flex items-center justify-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Share Your Understanding</span>
          </div>
        </button>
      ) : (
        <div className="w-full py-4 px-6 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl font-semibold border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span>Understanding Shared</span>
          </div>
        </div>
      )}

      {/* Info Notice */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
          💡 Your understanding helps improve collective intelligence
        </p>
      </div>

      {/* Component Understanding Modal */}
      <ComponentUnderstandingModal
        belief={belief}
        isOpen={showComponentModal}
        onClose={() => setShowComponentModal(false)}
        onContributeToTruth={handleContributeToTruth}
      />

      {/* Belief Submission Modal */}
      <BeliefSubmissionModal
        belief={belief}
        isOpen={showSubmissionModal}
        onClose={() => {
          setShowSubmissionModal(false);
          setHasSubmitted(true);
        }}
      />
    </div>
  );
}; 
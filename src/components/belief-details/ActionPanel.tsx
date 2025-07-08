'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Belief } from '@/types/belief.types';
import { TrendingUp, MessageCircle, Heart, Share2, BookOpen, X, Check } from 'lucide-react';

interface ActionPanelProps {
  belief: Belief;
}

// New Belief Submission Modal Component
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

  const getValueColor = (value: number) => {
    if (value >= 80) return 'from-emerald-500 to-emerald-600';
    if (value >= 60) return 'from-blue-500 to-blue-600';
    if (value >= 40) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          // Close modal when clicking on backdrop
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
              >
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Belief Submitted Successfully!
          </h3>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Certainty Level:</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{certainty}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Your Belief:</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{truthValue}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Others&apos; Belief:</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{othersWillSay}%</span>
            </div>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Thank you for contributing to collective intelligence
          </div>
        </div>
      </div>,
      document.body
    ) : null;
  }

  return typeof window !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
          >
        <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="relative px-6 md:px-8 py-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-700 dark:to-slate-800 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Submit Your Understanding
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                How certain are you about this topic?
              </p>
            </div>
          </div>

          {/* Belief Topic Display */}
          <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-4">
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
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 mb-1">
                  {belief.heading.title}
                </h3>
                {belief.heading.context && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
                    {belief.heading.context}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

                  {/* Main Content */}
          <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8">
          {/* Three Sliders Section */}
          <div className="space-y-8">
            {/* Certainty Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Certainty Level
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    How confident you are in your assessment
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${getValueColor(certainty)} text-white font-bold text-lg`}>
                  {certainty}%
                </div>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-medium">
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
                  className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            {/* Truth Value Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Your Belief
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    What you personally think is true
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${getValueColor(truthValue)} text-white font-bold text-lg`}>
                  {truthValue}%
                </div>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-medium">
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
                  className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            {/* Others Will Say Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Others&apos; Belief
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    What you think others will say is true
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${getValueColor(othersWillSay)} text-white font-bold text-lg`}>
                  {othersWillSay}%
                </div>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-medium">
                <span>Others: False</span>
                <span>Others: True</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={othersWillSay}
                  onChange={handleOthersWillSayChange}
                  className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>

          {/* Global Slider Styles */}
          <style jsx>{`
            .slider::-webkit-slider-thumb {
              appearance: none;
              height: 24px;
              width: 24px;
              border-radius: 50%;
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              cursor: pointer;
              box-shadow: 0 3px 8px rgba(59, 130, 246, 0.4);
              transition: all 0.2s ease-in-out;
              border: 2px solid white;
            }
            .slider::-webkit-slider-thumb:hover {
              transform: scale(1.1);
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
            }
            .slider::-moz-range-thumb {
              height: 24px;
              width: 24px;
              border-radius: 50%;
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              cursor: pointer;
              border: 2px solid white;
              box-shadow: 0 3px 8px rgba(59, 130, 246, 0.4);
            }
          `}</style>
          
          {/* Global Scroll Styles */}
          <style jsx global>{`
            .overflow-y-auto {
              scroll-behavior: smooth;
            }
            .overflow-y-auto::-webkit-scrollbar {
              width: 6px;
            }
            .overflow-y-auto::-webkit-scrollbar-track {
              background: transparent;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.3);
              border-radius: 3px;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.5);
            }
          `}</style>

          {/* Information Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Bayesian Truth Serum
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  Your personal belief, prediction of others&apos; beliefs, and certainty level help reveal collective intelligence and improve truth-finding through advanced statistical analysis.
                </p>
              </div>
            </div>
          </div>
        </div>

                  {/* Footer */}
          <div className="flex-shrink-0 px-6 md:px-8 py-6 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`
              w-full py-4 px-6 rounded-2xl font-semibold text-white transition-all duration-300
              ${isSubmitting 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 hover:from-blue-700 hover:to-purple-700'
              }
            `}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting Your Understanding...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <TrendingUp className="w-5 h-5" />
                <span>Submit All 3 Rankings</span>
              </div>
            )}
          </button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-3">
            Your submission will contribute to the collective understanding of this topic
          </p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

// Updated ActionPanel Component
export const ActionPanel: React.FC<ActionPanelProps> = ({ belief }) => {
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const stats = [
    { 
      icon: TrendingUp, 
      label: 'Truth Score', 
      value: `${belief.objectRankingScores.truth}%`,
      color: 'text-emerald-600 dark:text-emerald-400'
    },
    { 
      icon: BookOpen, 
      label: 'Relevance', 
      value: `${belief.objectRankingScores.relevance}%`,
      color: 'text-blue-600 dark:text-blue-400'
    },
    { 
      icon: MessageCircle, 
      label: 'Engagement', 
      value: Math.floor(Math.random() * 500) + 50,
      color: 'text-purple-600 dark:text-purple-400'
    },
  ];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: belief.heading.title,
        text: belief.article.excerpt || belief.article.content.slice(0, 100) + '...',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // You could add a toast notification here
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-200/60 dark:border-slate-700/60">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Take Action
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              !belief.status
                ? 'bg-emerald-500 animate-pulse' 
                : 'bg-slate-400'
            }`} />
            <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
              {belief.status || 'Active'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {stat.value}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Primary Action Button */}
        <div className="space-y-3">
          {!hasSubmitted ? (
            <button
              onClick={() => setShowSubmissionModal(true)}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] active:scale-95"
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

          {/* Secondary Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button className="flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all duration-200 hover:scale-105">
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">Like</span>
            </button>
            
            <button className="flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all duration-200 hover:scale-105">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Discuss</span>
            </button>
            
            <button 
              onClick={handleShare}
              className="flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all duration-200 hover:scale-105"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
        </div>

        {/* Info Notice */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
            💡 Your understanding helps improve collective intelligence
          </p>
        </div>
      </div>

      {/* Belief Submission Modal */}
      <BeliefSubmissionModal
        belief={belief}
        isOpen={showSubmissionModal}
        onClose={() => {
          setShowSubmissionModal(false);
          setHasSubmitted(true);
        }}
      />
    </>
  );
}; 
'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, X, Users, Zap, Lock } from 'lucide-react';

interface LoginPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginPendingModal: React.FC<LoginPendingModalProps> = ({ isOpen, onClose }) => {
  
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
      <div className="bg-white dark:bg-veritas-darker-blue/95 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-veritas-eggshell/10">
        {/* Header */}
        <div className="relative px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-white dark:bg-veritas-darker-blue/95 border-b border-slate-200 dark:border-veritas-eggshell/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-veritas-primary/60 hover:text-veritas-primary dark:text-veritas-eggshell/60 dark:hover:text-veritas-eggshell transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 mb-4 pr-10">
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell flex-shrink-0">
              <LogIn className="w-6 h-6 sm:w-8 sm:h-8 text-white dark:text-veritas-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-veritas-primary dark:text-veritas-eggshell leading-tight">
                Login Coming Soon
              </h2>
              <p className="text-sm sm:text-base text-veritas-primary/70 dark:text-veritas-eggshell/70 leading-tight">
                Authentication features in development
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
          {/* Login Development Notice */}
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg sm:rounded-xl flex-shrink-0">
                  <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-2 sm:mb-3 text-base sm:text-lg">
                    Authentication System in Development
                  </h4>
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed text-sm sm:text-base">
                    We&apos;re building a comprehensive authentication system that will allow you to create 
                    accounts, contribute to beliefs, and participate in collective intelligence. 
                    The login functionality will be available soon.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-800/50 rounded-lg sm:rounded-xl flex-shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 sm:mb-3 text-base sm:text-lg">
                    What You&apos;ll Be Able to Do
                  </h4>
                  <ul className="text-blue-800 dark:text-blue-200 leading-relaxed space-y-2 text-sm sm:text-base">
                    <li className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Submit your understanding and contribute to beliefs</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Edit and improve individual components</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Track your contributions and build reputation</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Access personalized intelligence feeds</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Current Access */}
          <div className="bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-veritas-eggshell/10">
            <div className="flex items-start space-x-3 sm:space-x-4">
              <div className="p-2 sm:p-3 bg-veritas-primary/10 dark:bg-veritas-eggshell/10 rounded-lg sm:rounded-xl flex-shrink-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-veritas-primary dark:text-veritas-eggshell" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-veritas-primary dark:text-veritas-eggshell mb-2 sm:mb-3 text-base sm:text-lg">
                  Explore Now Without Login
                </h4>
                <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 leading-relaxed text-sm sm:text-base">
                  You can browse all beliefs, read articles, view charts, and explore the intelligence 
                  platform without an account. Full interaction features will require login once available.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-slate-50 dark:bg-veritas-darker-blue/60 border-t border-slate-200 dark:border-veritas-eggshell/10">
          <button
            onClick={onClose}
            className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-xl sm:rounded-2xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>Continue Exploring</span>
            </div>
          </button>

          <p className="text-xs text-center text-veritas-primary/60 dark:text-veritas-eggshell/60 mt-2 sm:mt-3">
            Login functionality coming soon to enhance your Veritas experience
          </p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}; 
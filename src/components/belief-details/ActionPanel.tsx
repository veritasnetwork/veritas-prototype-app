'use client';

import { useState } from 'react';
import { Belief } from '@/types/belief.types';
import { Plus, Share2, Bookmark, Download, X, TrendingUp } from 'lucide-react';

interface ActionPanelProps {
  belief: Belief;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ belief }) => {
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: belief.title,
        text: belief.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // You could add a toast notification here
    }
  };

  const handleBookmark = () => {
    // Add bookmark functionality
    console.log('Bookmark belief:', belief.id);
  };

  const handleExport = () => {
    // Add export functionality
    console.log('Export belief data:', belief.id);
  };

  return (
    <>
      <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-8 shadow-2xl shadow-yellow-500/10">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
            <Plus className="w-6 h-6 text-[#FFB800]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Take Action
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Submit your prediction or interact with this belief
            </p>
          </div>
        </div>

        {/* Primary Action */}
        <button
          onClick={() => setShowSubmissionModal(true)}
          className="w-full p-4 mb-4 bg-gradient-to-r from-[#FFB800] to-[#F5A623] text-[#1B365D] font-bold rounded-2xl hover:shadow-2xl hover:shadow-[#FFB800]/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="flex items-center justify-center space-x-3">
            <TrendingUp className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-lg">Submit Your Belief</span>
          </div>
          <div className="text-sm mt-1 text-[#1B365D]/80">
            Share your prediction and earn rewards for accuracy
          </div>
        </button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleShare}
            className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-[1.05] group"
          >
            <Share2 className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-[#FFB800] transition-colors duration-300 mb-2" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100">
              Share
            </span>
          </button>

          <button
            onClick={handleBookmark}
            className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-[1.05] group"
          >
            <Bookmark className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-[#FFB800] transition-colors duration-300 mb-2" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100">
              Save
            </span>
          </button>

          <button
            onClick={handleExport}
            className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-[1.05] group"
          >
            <Download className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-[#FFB800] transition-colors duration-300 mb-2" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100">
              Export
            </span>
          </button>
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Join {belief.participantCount.toLocaleString()} participants in this prediction
            </p>
            <div className="flex justify-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
              <span>🏆 Earn rewards for accuracy</span>
              <span>📊 Build your reputation</span>
              <span>🤝 Help find truth</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
                    <TrendingUp className="w-6 h-6 text-[#FFB800]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Submit Your Belief
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Advanced prediction interface
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSubmissionModal(false)}
                  className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-10 h-10 text-[#FFB800]" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Coming Soon
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Advanced belief submission interface is under development.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-left">
                    <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Features in development:
                    </h5>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <li>• Probability distribution inputs</li>
                      <li>• Stake selection and risk analysis</li>
                      <li>• Reward/penalty calculations</li>
                      <li>• Historical performance insights</li>
                      <li>• Real-time consensus updates</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => setShowSubmissionModal(false)}
                  className="w-full py-3 px-6 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 
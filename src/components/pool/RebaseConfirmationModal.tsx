'use client';

import { RefreshCw, Clock, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RebaseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRebasing: boolean;
  error: string | null;
  unaccountedSubmissions?: number;
  minRequiredSubmissions?: number;
  cooldownRemaining?: number; // seconds
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function RebaseConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isRebasing,
  error,
  unaccountedSubmissions,
  minRequiredSubmissions,
  cooldownRemaining: initialCooldownRemaining,
}: RebaseConfirmationModalProps) {
  // Local countdown timer for cooldown
  const [cooldownRemaining, setCooldownRemaining] = useState(initialCooldownRemaining || 0);

  // Update local countdown every second
  useEffect(() => {
    if (!isOpen || cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, cooldownRemaining]);

  // Sync with prop updates
  useEffect(() => {
    setCooldownRemaining(initialCooldownRemaining || 0);
  }, [initialCooldownRemaining]);

  if (!isOpen) return null;

  const hasEnoughSubmissions = unaccountedSubmissions !== undefined &&
                                minRequiredSubmissions !== undefined &&
                                unaccountedSubmissions >= minRequiredSubmissions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isRebasing ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-white text-2xl font-bold font-mono mb-2">
              Rebase Pool
            </h2>
          </div>
          {!isRebasing && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status Info */}
        {(unaccountedSubmissions !== undefined || cooldownRemaining > 0) && (
          <div className="space-y-2 mb-4">
            {/* Unaccounted Submissions */}
            {unaccountedSubmissions !== undefined && minRequiredSubmissions !== undefined && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-[#F0EAD6]/10 border-[#F0EAD6]/30">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#F0EAD6]" />
                  <span className="text-sm font-medium text-[#F0EAD6]">
                    New Beliefs
                  </span>
                </div>
                <span className="text-sm font-mono text-[#F0EAD6]">
                  {cooldownRemaining > 0 ? 0 : unaccountedSubmissions} / {minRequiredSubmissions}
                </span>
              </div>
            )}

            {/* Cooldown Timer */}
            {cooldownRemaining > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-orange-500/10 border-orange-500/30">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-300">
                    Cooldown Active
                  </span>
                </div>
                <span className="text-sm font-mono text-orange-300">
                  {formatTimeRemaining(cooldownRemaining)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="space-y-3 mb-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-4">
            <p className="text-gray-300 text-sm mb-3">
              This will:
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#F0EAD6] mt-0.5">•</span>
                <span>Recalculate the collective relevance score.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#F0EAD6] mt-0.5">•</span>
                <span>Resolve the market based on submitted beliefs.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#F0EAD6] mt-0.5">•</span>
                <span>Reward users who were informed and honest.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-4 p-4 rounded-lg ${
            error.includes('Rebase will be available') || error.includes('Cooldown active') || error.includes('Insufficient new activity') || error.includes('Need at least')
              ? 'bg-orange-500/10 border border-orange-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className={`text-sm font-medium ${
              error.includes('Rebase will be available') || error.includes('Cooldown active') || error.includes('Insufficient new activity') || error.includes('Need at least')
                ? 'text-orange-400'
                : 'text-red-400'
            }`}>
              {error.includes('Rebase will be available') || error.includes('Cooldown active') ? error : (
                <>
                  <div>Rebase Failed</div>
                  <div className={`text-xs mt-1 font-normal ${
                    error.includes('Insufficient new activity') || error.includes('Need at least')
                      ? 'text-orange-300'
                      : 'text-red-300'
                  }`}>
                    {error}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isRebasing}
            className="flex-1 px-4 py-2.5 text-gray-400 hover:text-white font-medium rounded-lg transition-colors border border-gray-700 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isRebasing}
            className="flex-1 px-4 py-2.5 bg-[#F0EAD6] hover:bg-[#F0EAD6]/90 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRebasing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Rebasing...
              </>
            ) : (
              'Confirm Rebase'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
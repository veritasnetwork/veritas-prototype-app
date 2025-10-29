'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, ExternalLink, TrendingUp, Users, Award } from 'lucide-react';

interface RebaseDetails {
  bdScore: number; // BD aggregate relevance score (0-1)
  txSignature: string;
  poolAddress: string;
  currentEpoch: number;
  stakeChanges?: {
    totalRewards: number;
    totalSlashes: number;
    participantCount: number;
  };
}

interface RebaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: RebaseDetails;
}

export function RebaseSuccessModal({
  isOpen,
  onClose,
  details,
}: RebaseSuccessModalProps) {
  const [showCheck, setShowCheck] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Animate check mark
      setTimeout(() => setShowCheck(true), 100);
      // Show details after check animation
      setTimeout(() => setShowDetails(true), 600);
    } else {
      setShowCheck(false);
      setShowDetails(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const bdScorePercent = details.bdScore * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden">
        {/* Success Header with Animation */}
        <div className="relative bg-gradient-to-b from-neutral-800 to-neutral-900 px-6 py-8 text-center">
          {/* Animated Check Circle */}
          <div className="flex justify-center mb-4">
            <div
              className={`relative transition-all duration-500 ${
                showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              {/* Pulsing background circles */}
              <div className="absolute inset-0 bg-[#F0EAD6]/20 rounded-full animate-ping" />
              <div className="absolute inset-0 bg-[#F0EAD6]/10 rounded-full animate-pulse" />

              {/* Main check circle */}
              <div className="relative bg-gradient-to-br from-[#F0EAD6] to-[#E8DCC4] rounded-full p-4 shadow-lg shadow-[#F0EAD6]/50">
                <CheckCircle className="w-12 h-12 text-black" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <h2
            className={`text-2xl font-bold text-white transition-all duration-500 ${
              showCheck ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Settlement Complete!
          </h2>
        </div>

        {/* Rebase Details */}
        <div
          className={`px-6 py-6 space-y-4 transition-all duration-500 delay-200 ${
            showDetails ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          {/* BD Score - Main Highlight */}
          <div className="bg-gradient-to-br from-[#F0EAD6]/20 to-[#F0EAD6]/5 rounded-lg p-6 border border-[#F0EAD6]/30">
            <div className="flex items-center justify-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-[#F0EAD6]" />
              <span className="text-sm font-semibold text-[#F0EAD6] uppercase tracking-wide">
                Collective Relevance
              </span>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2">
                {bdScorePercent.toFixed(1)}%
              </div>
              <p className="text-xs text-neutral-400">
                Bayesian Truth Serum aggregate score
              </p>
            </div>
          </div>

          {/* Epoch Info */}
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">Epoch</span>
              <span className="font-mono font-semibold text-white">
                {details.currentEpoch}
              </span>
            </div>
          </div>

          {/* Stake Changes (if available) */}
          {details.stakeChanges && details.stakeChanges.participantCount > 0 && (
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Award className="w-4 h-4 text-[#F0EAD6]" />
                <span>Stake Redistribution</span>
              </div>

              <div className="space-y-2">
                {/* Participants */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-400">Participants</span>
                  </div>
                  <span className="font-mono text-sm text-white">
                    {details.stakeChanges.participantCount}
                  </span>
                </div>

                {/* Total Redistributed (zero-sum: rewards = slashes) */}
                {details.stakeChanges.totalRewards > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-400">Total Redistributed</span>
                    <span className="font-mono text-sm text-[#F0EAD6]">
                      ${details.stakeChanges.totalRewards.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transaction Link */}
          <div className="pt-2">
            <a
              href={`https://solscan.io/tx/${details.txSignature}${
                process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-[#B9D9EB] hover:text-[#A0C9DB] transition-colors"
            >
              <span>View on Solscan</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Action Button */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-[#F0EAD6] hover:bg-[#E8DCC4] text-black rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

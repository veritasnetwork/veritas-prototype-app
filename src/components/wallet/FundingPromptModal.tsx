'use client';

import { FundWalletButton } from './FundWalletButton';

interface FundingPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'SOL' | 'USDC' | 'BOTH';
  requiredAmount?: number;
  currentBalance?: number;
  currentSolBalance?: number;
  requiredSolAmount?: number; // Required SOL (0.01 for trades, 0.02 for deployment)
}

export function FundingPromptModal({
  isOpen,
  onClose,
  type,
  requiredAmount,
  currentBalance = 0,
  currentSolBalance = 0,
  requiredSolAmount = 0.01
}: FundingPromptModalProps) {
  if (!isOpen) return null;

  const usdcShortfall = requiredAmount ? Math.max(0, requiredAmount - currentBalance) : 0;
  const solShortfall = Math.max(0, (type === 'SOL' || type === 'BOTH' ? requiredSolAmount : 0) - currentSolBalance);

  const getMessage = () => {
    if (type === 'SOL') {
      return 'You need SOL to pay for transaction fees.';
    } else if (type === 'USDC') {
      return `You need more USDC to complete this trade.`;
    } else {
      return 'You need SOL for transaction fees and USDC to trade.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-white text-2xl font-bold font-mono mb-2">
              Insufficient Funds
            </h2>
            <p className="text-gray-400 text-sm">
              {getMessage()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Balance Details */}
        <div className="space-y-2 mb-4">
          {(type === 'USDC' || type === 'BOTH') && (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">USDC Balance</span>
                <span className="text-sm font-medium text-white">{currentBalance.toFixed(2)} USDC</span>
              </div>
              {requiredAmount && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Required</span>
                    <span className="text-sm font-medium text-white">{requiredAmount.toFixed(2)} USDC</span>
                  </div>
                  {usdcShortfall > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-xs text-gray-400">Need</span>
                      <span className="text-sm font-medium text-orange-400">+{usdcShortfall.toFixed(2)} USDC</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {(type === 'SOL' || type === 'BOTH') && (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">SOL Balance</span>
                <span className="text-sm font-medium text-white">{currentSolBalance.toFixed(4)} SOL</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Minimum (for fees)</span>
                <span className="text-sm font-medium text-white">{requiredSolAmount.toFixed(2)} SOL</span>
              </div>
              {solShortfall > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-gray-400">Need</span>
                  <span className="text-sm font-medium text-orange-400">+{solShortfall.toFixed(4)} SOL</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fund Buttons */}
        <div className="space-y-3">
          {(type === 'USDC' || type === 'BOTH') && (
            <FundWalletButton variant="compact" currency="USDC" className="w-full" />
          )}
          {(type === 'SOL' || type === 'BOTH') && (
            <FundWalletButton variant="compact" currency="SOL" className="w-full" />
          )}
        </div>

        {/* Info text */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-gray-400 text-xs">
            You can buy crypto with a card, transfer from another wallet, or bridge from other chains.
          </p>
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2.5 text-gray-400 hover:text-white font-medium rounded-lg transition-colors border border-gray-700 hover:border-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

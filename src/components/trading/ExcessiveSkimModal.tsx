/**
 * ExcessiveSkimModal
 * Shown when a trade is blocked due to excessive skim (>30%)
 * Displays recommended deposit amount and provides a deposit button
 */

'use client';

import { useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExcessiveSkimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit: (amount: number) => void;
  skimAmount: number; // Display USDC
  skimPercentage: number;
  tradeAmount: number; // Micro-USDC
  recommendedDeposit: number; // Display USDC
  underwaterInfo?: {
    currentStake: number;
    totalLocks: number;
    deficit: number;
  };
}

export function ExcessiveSkimModal({
  isOpen,
  onClose,
  onDeposit,
  skimAmount,
  skimPercentage,
  tradeAmount,
  recommendedDeposit,
  underwaterInfo
}: ExcessiveSkimModalProps) {
  const [isDepositing, setIsDepositing] = useState(false);

  if (!isOpen) return null;

  const handleDeposit = async () => {
    setIsDepositing(true);
    try {
      await onDeposit(recommendedDeposit);
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-md w-full border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <AlertCircle className="w-6 h-6 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              Your Stake is Underwater
            </h3>
            <p className="text-sm text-gray-400">
              Your existing stake has been penalized for uninformed belief submissions. Top up your stake or close some positions to trade again.
            </p>
          </div>
        </div>

        {/* Trade Details */}
        <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4 border border-[#2a2a2a]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Trade Amount</span>
            <span className="text-sm font-medium text-[#B9D9EB]">
              ${(tradeAmount / 1_000_000).toFixed(2)} USDC
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Additional Deposit Needed</span>
            <span className="text-sm font-medium text-orange-400">
              ${skimAmount.toFixed(2)} USDC
            </span>
          </div>
          {underwaterInfo && (
            <>
              <div className="border-t border-[#2a2a2a] my-2" />
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Your Current Stake</span>
                <span className="text-xs font-mono text-[#B9D9EB]">
                  ${underwaterInfo.currentStake.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Locked in Open Positions</span>
                <span className="text-xs font-mono text-[#B9D9EB]">
                  ${underwaterInfo.totalLocks.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Recommendation */}
        <div className="bg-[#B9D9EB]/10 border border-[#B9D9EB]/20 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-300 mb-3">
            <span className="font-medium text-[#B9D9EB]">Option 1:</span> Deposit{' '}
            <span className="font-semibold text-[#B9D9EB]">${recommendedDeposit.toFixed(2)} USDC</span>{' '}
            to cover your locked positions and enable this trade with 2% skim.
          </p>
          <p className="text-sm text-gray-300">
            <span className="font-medium text-[#B9D9EB]">Option 2:</span> Close all positions (LONG and SHORT) on a post to free up locked stake, then try again.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={isDepositing}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-lg transition-colors text-sm font-medium",
              "bg-[#B9D9EB] hover:bg-[#a3cfe3] text-black",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isDepositing ? 'Processing...' : `Deposit $${recommendedDeposit.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

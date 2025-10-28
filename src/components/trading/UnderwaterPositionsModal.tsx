'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';

interface UnderwaterPosition {
  poolAddress: string;
  postId: string;
  side: 'LONG' | 'SHORT';
  lock: number; // USDC
  balance: number;
}

interface UnderwaterPositionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed?: () => void;
  skimPercentage: number;
  skimAmount: number; // USDC
  tradeAmount: number; // USDC
  underwaterInfo: {
    isUnderwater: boolean;
    currentStake: number; // USDC
    totalLocks: number; // USDC
    deficit: number; // USDC
    positions: UnderwaterPosition[];
  };
  recommendation: string;
}

export function UnderwaterPositionsModal({
  isOpen,
  onClose,
  onProceed,
  skimPercentage,
  skimAmount,
  tradeAmount,
  underwaterInfo,
  recommendation,
}: UnderwaterPositionsModalProps) {
  const [userAcknowledged, setUserAcknowledged] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-neutral-900 rounded-lg shadow-2xl border border-neutral-800">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            ⚠️ High Skim
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Skim Info */}
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
            <div className="space-y-1 text-sm text-neutral-300">
              <p>
                Trade: <span className="font-mono">${tradeAmount.toFixed(2)}</span>
              </p>
              <p>
                Skim: <span className="font-mono text-amber-400">${skimAmount.toFixed(2)} ({skimPercentage}%)</span>
              </p>
              <p className="text-neutral-400 text-xs mt-2">
                Normal: 2%. This is {Math.round(skimPercentage / 2)}x higher.
              </p>
            </div>
          </div>

          {/* Why This Happens */}
          <div className="space-y-2">
            <p className="text-xs text-neutral-400">
              {underwaterInfo.isUnderwater ? (
                <>
                  Stake: ${underwaterInfo.currentStake.toFixed(2)} &lt; Locks: ${underwaterInfo.totalLocks.toFixed(2)} (deficit: ${Math.abs(underwaterInfo.deficit).toFixed(2)})
                </>
              ) : (
                <>
                  Opening new position requires additional collateral
                </>
              )}
            </p>
          </div>

          {/* Underwater Positions */}
          {underwaterInfo.positions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Active Positions</h3>
              <div className="space-y-1.5">
                {underwaterInfo.positions.map((position, idx) => (
                  <Link
                    key={idx}
                    href={`/post/${position.postId}`}
                    className="block bg-neutral-800/50 hover:bg-neutral-800 transition-colors rounded p-2.5 border border-neutral-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          position.side === 'LONG'
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}>
                          {position.side}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {position.balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white">
                        ${position.lock.toFixed(2)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              💡 Close positions to free up collateral and reduce skim to 2%
            </p>
          </div>

          {/* Proceed Option */}
          {onProceed && (
            <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userAcknowledged}
                  onChange={(e) => setUserAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-600 bg-neutral-900 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs text-neutral-300">
                  I understand the ${skimAmount.toFixed(2)} ({skimPercentage}%) skim
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 px-6 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
          {onProceed && (
            <button
              onClick={onProceed}
              disabled={!userAcknowledged}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              Proceed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

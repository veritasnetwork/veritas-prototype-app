/**
 * WithdrawModal Component
 * Modal for withdrawing unlocked stake
 */

'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

interface WithdrawModalProps {
  totalStake: number;
  totalLocked: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function WithdrawModal({
  totalStake,
  totalLocked,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const withdrawable = totalStake - totalLocked;
  const [amount, setAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum > withdrawable) {
      setError('Amount exceeds withdrawable balance');
      return;
    }

    setIsWithdrawing(true);
    try {
      // TODO: Implement withdraw API call
      // const response = await fetch('/api/users/withdraw', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ amount: amountNum }),
      // });
      // if (!response.ok) throw new Error('Withdrawal failed');

      console.log('Withdrawing:', amountNum);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleMaxClick = () => {
    if (withdrawable > 0) {
      setAmount(withdrawable.toFixed(2));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-md w-full border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Withdraw Stake</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stake Breakdown */}
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4 mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Total Stake</span>
            <span className="text-lg font-bold text-white">{formatCurrency(totalStake)}</span>
          </div>
          <div className="border-t border-[#2a2a2a]" />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Locked in Positions</span>
              <div className="group relative">
                <AlertCircle className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#2a2a2a] text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[#3a3a3a] z-10">
                  Locked stake backs your open positions for consensus validation. Close positions to free up stake.
                </div>
              </div>
            </div>
            <span className="text-lg font-medium text-orange-400">-{formatCurrency(totalLocked)}</span>
          </div>
          <div className="border-t border-[#2a2a2a]" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-300">Available to Withdraw</span>
            <span className={`text-xl font-bold ${withdrawable > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(withdrawable)}
            </span>
          </div>
        </div>

        {/* Withdraw Form */}
        {withdrawable > 0 ? (
          <form onSubmit={handleWithdraw} className="space-y-4">
            {/* Amount Input */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Withdraw
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={withdrawable}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-20 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#B9D9EB]"
                  placeholder="0.00"
                  required
                />
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!amount || isWithdrawing}
                className="flex-1 py-2.5 bg-[#F5F5DC] hover:bg-[#F5F5DC]/90 text-[#0f0f0f] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              You have no unlocked stake to withdraw. Close some positions to free up stake.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

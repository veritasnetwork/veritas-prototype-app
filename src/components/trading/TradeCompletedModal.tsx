'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, ExternalLink, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import Link from 'next/link';

interface TradeDetails {
  tradeType: 'buy' | 'sell';
  side: 'LONG' | 'SHORT';
  tokenAmount: number;
  usdcAmount: number; // Display USDC
  price: number; // Price per token in USDC
  skimAmount?: number; // Display USDC (only for buys)
  txSignature: string;
  poolAddress: string;
  postId?: string;
}

interface TradeCompletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: TradeDetails;
}

export function TradeCompletedModal({
  isOpen,
  onClose,
  details,
}: TradeCompletedModalProps) {
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

  const isBuy = details.tradeType === 'buy';
  const isLong = details.side === 'LONG';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
      <div className="relative w-full max-w-md bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden pointer-events-auto">
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
            Trade Completed!
          </h2>
        </div>

        {/* Trade Details */}
        <div
          className={`px-6 py-6 space-y-4 transition-all duration-500 delay-200 ${
            showDetails ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          {/* Main Trade Info */}
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isBuy ? (
                  <TrendingUp className={`w-5 h-5 ${isLong ? 'text-[#B9D9EB]' : 'text-orange-400'}`} />
                ) : (
                  <TrendingDown className={`w-5 h-5 ${isLong ? 'text-[#B9D9EB]' : 'text-orange-400'}`} />
                )}
                <span className="font-semibold text-white">
                  {isBuy ? 'Bought' : 'Sold'}
                </span>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-bold ${
                  isLong
                    ? 'bg-[#B9D9EB]/20 text-[#B9D9EB]'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                {details.side}
              </span>
            </div>

            <div className="space-y-2">
              {/* Token Amount */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">Tokens</span>
                <span className="font-mono font-semibold text-white">
                  {details.tokenAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* USDC Amount */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">
                  {isBuy ? 'Spent' : 'Received'}
                </span>
                <span className="font-mono font-semibold text-white">
                  ${details.usdcAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Price per Token */}
              <div className="flex justify-between items-center pt-2 border-t border-neutral-700">
                <span className="text-sm text-neutral-400">Price per Token</span>
                <span className="font-mono text-sm text-neutral-300">
                  ${details.price.toLocaleString(undefined, {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 6,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Skim Info (only for buys) */}
          {isBuy && details.skimAmount !== undefined && details.skimAmount > 0 && (
            <div className="bg-[#F0EAD6]/10 border border-[#F0EAD6]/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#F0EAD6] mt-0.5" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-[#F0EAD6]">
                      Collateral Locked
                    </span>
                    <span className="font-mono font-semibold text-[#F0EAD6]">
                      ${details.skimAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {((details.skimAmount / details.usdcAmount) * 100).toFixed(1)}% of your trade was locked as collateral for consensus validation.
                    You'll get a reward or penalty when you withdraw depending on the accuracy of your submitted beliefs.
                  </p>
                </div>
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

        {/* Action Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          {details.postId && (
            <Link
              href={`/post/${details.postId}`}
              className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors font-medium text-center"
              onClick={onClose}
            >
              View Post
            </Link>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[#B9D9EB] hover:bg-[#A0C9DB] text-black rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper hook to extract trade details from transaction
export function useTradeDetailsFromTx(txSignature: string, poolAddress: string) {
  const [details, setDetails] = useState<TradeDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!txSignature || !poolAddress) return;

    async function fetchDetails() {
      setLoading(true);
      try {
        // Fetch from our API which has the trade details
        const response = await fetch(`/api/trades/details?signature=${txSignature}`);
        if (response.ok) {
          const data = await response.json();
          setDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch trade details:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [txSignature, poolAddress]);

  return { details, loading };
}

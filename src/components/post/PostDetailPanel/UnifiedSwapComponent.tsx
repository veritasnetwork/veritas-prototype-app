/**
 * UnifiedSwapComponent
 * Compact trading interface with buy/sell toggle
 */

'use client';

import { useState, useMemo } from 'react';
import { ArrowDownUp, AlertCircle, ChevronDown } from 'lucide-react';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { useSellTokens } from '@/hooks/useSellTokens';
import { calculateBuyAmount, calculateSellAmount } from '@/lib/solana/bonding-curve';
import { cn } from '@/lib/utils';

interface UnifiedSwapComponentProps {
  poolAddress: string;
  postId: string;
  currentPrice: number;
  totalSupply: number;
  reserveBalance: number;
  reserveBalanceRaw: number | string;  // Raw value from database (with 12 decimals)
  kQuadratic: number;
  onTradeSuccess?: () => void; // Callback to refresh data after successful trade
}

type SwapMode = 'buy' | 'sell';

export function UnifiedSwapComponent({
  poolAddress,
  postId,
  currentPrice,
  totalSupply,
  reserveBalance,
  reserveBalanceRaw,
  kQuadratic,
  onTradeSuccess
}: UnifiedSwapComponentProps) {
  // State
  const [mode, setMode] = useState<SwapMode>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5'); // 0.5% default
  const [showPreview, setShowPreview] = useState(false);

  // Hooks
  const { buyTokens, loading: buyLoading } = useBuyTokens(onTradeSuccess);
  const { sellTokens, loading: sellLoading } = useSellTokens(onTradeSuccess);

  // Calculate output amount based on bonding curve
  const outputAmount = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return '0';

    try {
      const input = parseFloat(inputAmount);
      // Reserve is stored in micro-USDC (6 decimals) in database
      const reserveMicroUsdc = Number(reserveBalanceRaw);

      if (mode === 'buy') {
        // Calculate tokens received for USDC input
        const tokens = calculateBuyAmount(input, totalSupply, reserveMicroUsdc, kQuadratic);
        return tokens.toFixed(2);
      } else {
        // Calculate USDC received for token input
        const usdc = calculateSellAmount(input, totalSupply, reserveMicroUsdc, kQuadratic);
        return usdc.toFixed(2);
      }
    } catch (error) {
      console.error('Error calculating output:', error);
      return '0';
    }
  }, [inputAmount, mode, totalSupply, reserveBalanceRaw, kQuadratic]);

  // Calculate price impact
  const priceImpact = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return 0;

    const input = parseFloat(inputAmount);
    const output = parseFloat(outputAmount);

    if (mode === 'buy' && output > 0) {
      const avgPrice = input / output;
      return ((avgPrice - currentPrice) / currentPrice * 100);
    } else if (mode === 'sell' && input > 0) {
      const avgPrice = output / input;
      return ((currentPrice - avgPrice) / currentPrice * 100);
    }

    return 0;
  }, [inputAmount, outputAmount, mode, currentPrice]);

  // Toggle between buy and sell - swap the input/output amounts
  const toggleMode = () => {
    setMode(prev => prev === 'buy' ? 'sell' : 'buy');
    // Swap input with output (output becomes new input) - only if output is not 0
    if (outputAmount !== '0') {
      setInputAmount(outputAmount);
    } else {
      setInputAmount('');
    }
    setShowPreview(false);
  };

  // Handle swap execution
  const handleSwap = async () => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    try {
      if (mode === 'buy') {
        // Convert USDC to micro-USDC (6 decimals)
        const microUsdc = Math.floor(amount * 1_000_000);
        console.log('[UnifiedSwapComponent] Buy:', { inputAmount, amount, microUsdc });
        await buyTokens(postId, poolAddress, microUsdc);
      } else {
        await sellTokens(postId, poolAddress, Math.floor(amount));
      }

      // Reset after successful transaction
      setInputAmount('');
      setShowPreview(false);
    } catch (error) {
      console.error('Swap error:', error);
    }
  };

  const isLoading = buyLoading || sellLoading;
  const canSwap = inputAmount && parseFloat(inputAmount) > 0 && !isLoading;

  return (
    <div className="space-y-2">
      {/* Input */}
      <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="flex-1 bg-transparent text-xl font-medium outline-none text-white placeholder-gray-600"
            placeholder="0"
            min="0"
            step={mode === 'buy' ? '0.01' : '1'}
          />
          <div className="px-2 py-1 bg-[#2a2a2a] rounded text-xs font-medium text-white">
            {mode === 'buy' ? 'USDC' : 'SHARES'}
          </div>
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={toggleMode}
          className="p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-full transition-all hover:rotate-180 text-white"
          aria-label="Switch swap direction"
        >
          <ArrowDownUp className="w-4 h-4" />
        </button>
      </div>

      {/* Output */}
      <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#2a2a2a]">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex-1 text-xl font-medium ${outputAmount === '0' ? 'text-gray-600' : 'text-white'}`}>
            {outputAmount}
          </div>
          <div className="px-2 py-1 bg-[#2a2a2a] rounded text-xs font-medium text-white">
            {mode === 'buy' ? 'SHARES' : 'USDC'}
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <button
        onClick={() => canSwap && setShowPreview(true)}
        className={cn(
          "w-full py-2.5 font-medium rounded-lg transition-all text-sm text-white",
          mode === 'buy'
            ? "bg-green-500 hover:bg-green-600"
            : "bg-red-500 hover:bg-red-600"
        )}
      >
        {isLoading ? 'Processing...' : mode === 'buy' ? 'Buy' : 'Sell'}
      </button>

      {/* Compact Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl p-4 max-w-sm w-full border border-[#2a2a2a]">
            <h3 className="text-base font-semibold mb-3 text-white">Confirm {mode === 'buy' ? 'Buy' : 'Sell'}</h3>

            <div className="space-y-2 mb-3">
              <div className="bg-[#0f0f0f] rounded p-2 border border-[#2a2a2a]">
                <p className="text-xs text-gray-400 mb-0.5">You {mode === 'buy' ? 'pay' : 'sell'}</p>
                <p className="text-lg font-medium text-white">
                  {inputAmount} {mode === 'buy' ? 'USDC' : 'SHARES'}
                </p>
              </div>

              <div className="flex justify-center">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>

              <div className="bg-[#0f0f0f] rounded p-2 border border-[#2a2a2a]">
                <p className="text-xs text-gray-400 mb-0.5">You receive</p>
                <p className="text-lg font-medium text-white">
                  ~{outputAmount} {mode === 'buy' ? 'SHARES' : 'USDC'}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-3">
              Min. received: {(parseFloat(outputAmount) * (1 - parseFloat(slippage) / 100)).toFixed(2)} {mode === 'buy' ? 'SHARES' : 'USDC'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSwap();
                  setShowPreview(false);
                }}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-2 font-medium rounded-lg transition-colors text-sm",
                  mode === 'buy'
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                )}
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
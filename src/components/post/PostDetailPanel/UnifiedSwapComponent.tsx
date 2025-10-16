/**
 * UnifiedSwapComponent
 * Compact trading interface with buy/sell toggle
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowDownUp, AlertCircle, ChevronDown } from 'lucide-react';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { useSellTokens } from '@/hooks/useSellTokens';
import { useSwapBalances } from '@/hooks/useSwapBalances';
import { calculateBuyAmount, calculateSellAmount } from '@/lib/solana/bonding-curve';
import { cn } from '@/lib/utils';

/**
 * Calculate required USDC input to get desired token output (reverse of calculateBuyAmount)
 * Given desired tokens, calculate how much USDC is needed
 */
function calculateBuyAmountReverse(
  desiredTokens: number,
  currentSupplyAtomic: number,
  currentReserveMicroUsdc: number,
  kQuadratic: number
): number {
  const TOKEN_PRECISION = 1_000_000;

  // Convert reserves to USDC dollars for formula
  const currentReserveUsdc = currentReserveMicroUsdc / TOKEN_PRECISION;

  // Current supply in shares
  const currentShares = currentSupplyAtomic / TOKEN_PRECISION;

  // Desired new supply
  const newShares = currentShares + desiredTokens;

  // Calculate required reserve using inverse formula: R = k * (s/100)^3 / 3
  const newReserveUsdc = kQuadratic * Math.pow(newShares / 100, 3) / 3;

  // USDC needed
  const usdcNeeded = newReserveUsdc - currentReserveUsdc;

  return Math.max(0, usdcNeeded);
}

/**
 * Calculate required token input to get desired USDC output (reverse of calculateSellAmount)
 * Given desired USDC, calculate how many tokens need to be sold
 */
function calculateSellAmountReverse(
  desiredUsdc: number,
  currentSupplyAtomic: number,
  currentReserveMicroUsdc: number,
  kQuadratic: number
): number {
  const TOKEN_PRECISION = 1_000_000;

  // Convert atomic to shares
  const currentShares = currentSupplyAtomic / TOKEN_PRECISION;

  // Convert reserves to USDC
  const currentReserveUsdc = currentReserveMicroUsdc / TOKEN_PRECISION;

  // Calculate new reserve after payout
  const newReserveUsdc = currentReserveUsdc - desiredUsdc;

  // Calculate new supply using formula: s = (3R/k)^(1/3) * 100
  const newShares = Math.cbrt((3 * newReserveUsdc) / kQuadratic) * 100;

  // Tokens to sell
  const tokensToSell = currentShares - newShares;

  return Math.max(0, tokensToSell);
}

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
  const [outputAmount, setOutputAmount] = useState('');
  const [outputAmountRaw, setOutputAmountRaw] = useState<number>(0); // Store raw value for rotation
  const [lastEdited, setLastEdited] = useState<'input' | 'output'>('input');
  const [slippage, setSlippage] = useState('0.5'); // 0.5% default
  const [showPreview, setShowPreview] = useState(false);

  // Hooks
  const { usdcBalance, shareBalance, loading: balancesLoading, refresh: refreshBalances } = useSwapBalances(poolAddress, postId);

  // Create wrapped callback that refreshes balances after trade
  const handleTradeSuccess = () => {
    refreshBalances();
    if (onTradeSuccess) {
      onTradeSuccess();
    }
  };

  const { buyTokens, loading: buyLoading } = useBuyTokens(handleTradeSuccess);
  const { sellTokens, loading: sellLoading } = useSellTokens(handleTradeSuccess);

  // Get the relevant balance based on mode
  const currentBalance = mode === 'buy' ? usdcBalance : shareBalance;

  // Calculate values based on which field was last edited
  useEffect(() => {
    if (!inputAmount && !outputAmount) return;

    const totalSupplyAtomic = totalSupply * 1_000_000;
    const reserveMicroUsdc = Number(reserveBalanceRaw);

    console.log('[SWAP] useEffect triggered:', {
      mode,
      inputAmount,
      outputAmount,
      lastEdited,
      totalSupply,
      reserveMicroUsdc
    });

    try {
      if (lastEdited === 'input' && inputAmount) {
        const input = parseFloat(inputAmount);
        if (input <= 0) {
          setOutputAmount('');
          return;
        }

        if (mode === 'buy') {
          const tokensAtomic = calculateBuyAmount(input, totalSupplyAtomic, reserveMicroUsdc, kQuadratic);
          const tokensDisplay = tokensAtomic / 1_000_000;
          console.log('[SWAP] Buy calculation:', {
            input,
            tokensAtomic,
            tokensDisplay,
            tokensDisplayFixed: tokensDisplay.toFixed(2)
          });
          setOutputAmountRaw(tokensDisplay); // Store raw value
          setOutputAmount(tokensDisplay.toFixed(2));
        } else {
          const tokensToSellAtomic = input * 1_000_000;
          const usdc = calculateSellAmount(tokensToSellAtomic, totalSupplyAtomic, reserveMicroUsdc, kQuadratic);
          console.log('[SWAP] Sell calculation:', {
            input,
            tokensToSellAtomic,
            usdc,
            usdcFixed: usdc.toFixed(2)
          });
          setOutputAmountRaw(usdc); // Store raw value
          setOutputAmount(usdc.toFixed(2));
        }
      } else if (lastEdited === 'output' && outputAmount) {
        const output = parseFloat(outputAmount);
        if (output <= 0) {
          setInputAmount('');
          return;
        }

        if (mode === 'buy') {
          // User wants to receive `output` tokens, calculate required USDC
          const usdcNeeded = calculateBuyAmountReverse(output, totalSupplyAtomic, reserveMicroUsdc, kQuadratic);
          setInputAmount(usdcNeeded.toFixed(2));
        } else {
          // User wants to receive `output` USDC, calculate required tokens
          const tokensNeeded = calculateSellAmountReverse(output, totalSupplyAtomic, reserveMicroUsdc, kQuadratic);
          setInputAmount(tokensNeeded.toFixed(2));
        }
      }
    } catch (error) {
      console.error('Error calculating amounts:', error);
    }
  }, [inputAmount, outputAmount, lastEdited, mode, totalSupply, reserveBalanceRaw, kQuadratic]);

  // Handle input field change
  const handleInputChange = (value: string) => {
    setInputAmount(value);
    setLastEdited('input');
  };

  // Handle output field change
  const handleOutputChange = (value: string) => {
    setOutputAmount(value);
    setLastEdited('output');
  };

  // Calculate price impact
  const priceImpact = useMemo(() => {
    const input = parseFloat(inputAmount);
    const output = parseFloat(outputAmount);

    if (!input || !output || input <= 0 || output <= 0) return 0;

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
    console.log('[SWAP] Toggle START:', {
      currentMode: mode,
      inputAmount,
      outputAmount,
      outputAmountRaw,
      willSwitchTo: mode === 'buy' ? 'sell' : 'buy'
    });

    setMode(prev => prev === 'buy' ? 'sell' : 'buy');
    // Use the raw value if available to avoid rounding loss
    const newInput = outputAmountRaw > 0 ? outputAmountRaw.toString() : outputAmount;

    console.log('[SWAP] Toggle - using as new input:', {
      outputAmountRaw,
      outputAmount,
      newInput,
      willUseRaw: outputAmountRaw > 0
    });

    setInputAmount(newInput);
    setOutputAmount(''); // Clear output, it will be recalculated
    setOutputAmountRaw(0); // Clear raw value
    setLastEdited('input'); // Trigger recalculation from new input
    setShowPreview(false);
  };

  // Handle MAX button click
  const handleMaxClick = () => {
    if (currentBalance > 0) {
      setInputAmount(currentBalance.toFixed(mode === 'buy' ? 2 : 0));
      setLastEdited('input');
    }
  };

  // Handle swap execution
  const handleSwap = async () => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    try {
      if (mode === 'buy') {
        // Convert USDC to micro-USDC (6 decimals)
        const microUsdc = Math.floor(amount * 1_000_000);
        await buyTokens(postId, poolAddress, microUsdc);
      } else {
        // Convert display tokens to atomic units for selling
        const tokensAtomic = Math.floor(amount * 1_000_000);
        await sellTokens(postId, poolAddress, tokensAtomic);
      }

      // Reset after successful transaction
      setInputAmount('');
      setOutputAmount('');
      setOutputAmountRaw(0);
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
      <div className="bg-[#0f0f0f] rounded-lg p-4 md:p-3 border border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-2 md:mb-1.5">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => handleInputChange(e.target.value)}
            className="flex-1 bg-transparent text-xl md:text-xl font-medium outline-none text-white placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-h-[44px] md:min-h-0"
            placeholder="0"
            min="0"
            step={mode === 'buy' ? '0.01' : '1'}
          />
          <div className="px-3 py-2 md:px-2 md:py-1 bg-[#2a2a2a] rounded text-sm md:text-xs font-medium text-white">
            {mode === 'buy' ? 'USDC' : 'SHARES'}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={handleMaxClick}
            className="px-3 py-2 md:px-1.5 md:py-0.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded text-sm md:text-xs font-medium text-[#B9D9EB] hover:text-white transition-colors disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0"
            disabled={balancesLoading || currentBalance === 0}
          >
            MAX
          </button>
          <span className="text-sm md:text-xs text-gray-300">
            {balancesLoading ? '...' : currentBalance.toFixed(mode === 'buy' ? 2 : 0)} <span className="text-gray-400">{mode === 'buy' ? 'USDC' : 'SHARES'}</span>
          </span>
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={toggleMode}
          className="p-3 md:p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-full transition-all hover:rotate-180 text-white min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
          aria-label="Switch swap direction"
        >
          <ArrowDownUp className="w-5 h-5 md:w-4 md:h-4" />
        </button>
      </div>

      {/* Output */}
      <div className="bg-[#0f0f0f] rounded-lg p-4 md:p-3 border border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={outputAmount}
            onChange={(e) => handleOutputChange(e.target.value)}
            className="flex-1 bg-transparent text-xl md:text-xl font-medium outline-none text-white placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-h-[44px] md:min-h-0"
            placeholder="0"
            min="0"
            step={mode === 'buy' ? '1' : '0.01'}
          />
          <div className="px-3 py-2 md:px-2 md:py-1 bg-[#2a2a2a] rounded text-sm md:text-xs font-medium text-white">
            {mode === 'buy' ? 'SHARES' : 'USDC'}
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <button
        onClick={() => canSwap && setShowPreview(true)}
        className={cn(
          "w-full py-3 md:py-2.5 font-medium rounded-lg transition-all text-base md:text-sm text-white min-h-[44px] md:min-h-0",
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
                className="flex-1 py-3 md:py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors text-base md:text-sm min-h-[44px] md:min-h-0"
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
                  "flex-1 py-3 md:py-2 font-medium rounded-lg transition-colors text-base md:text-sm min-h-[44px] md:min-h-0",
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
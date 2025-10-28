/**
 * Example usage of TradeCompletedModal with useBuyTokens
 *
 * This shows how to integrate the trade completion modal
 * into your trading UI components.
 */

'use client';

import { useState } from 'react';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { TradeCompletedModal } from './TradeCompletedModal';

interface TradeDetails {
  tradeType: 'buy' | 'sell';
  side: 'LONG' | 'SHORT';
  tokenAmount: number;
  usdcAmount: number;
  price: number;
  skimAmount?: number;
  txSignature: string;
  poolAddress: string;
  postId?: string;
}

export function TradingPanel({ postId, poolAddress }: { postId: string; poolAddress: string }) {
  const [amount, setAmount] = useState(100);
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [completedTrade, setCompletedTrade] = useState<TradeDetails | null>(null);

  const { buyTokens, isLoading } = useBuyTokens();

  const handleBuy = async () => {
    try {
      // Call the buy function
      const result = await buyTokens(postId, poolAddress, amount, side);

      // Check if it's a warning about underwater positions
      if (result && 'requiresConfirmation' in result) {
        // Handle underwater warning (show UnderwaterPositionsModal)
        // ... handled elsewhere in your UI
        return;
      }

      // Success! Show completion modal with trade details
      if (result && 'tradeDetails' in result) {
        setCompletedTrade(result.tradeDetails);
      }
    } catch (error) {
      console.error('Trade failed:', error);
      // Show error toast/notification
    }
  };

  return (
    <div>
      <div className="space-y-4">
        {/* Side selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setSide('LONG')}
            className={`flex-1 py-2 rounded ${
              side === 'LONG' ? 'bg-green-600' : 'bg-neutral-700'
            }`}
          >
            LONG
          </button>
          <button
            onClick={() => setSide('SHORT')}
            className={`flex-1 py-2 rounded ${
              side === 'SHORT' ? 'bg-red-600' : 'bg-neutral-700'
            }`}
          >
            SHORT
          </button>
        </div>

        {/* Amount input */}
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full px-4 py-2 bg-neutral-800 rounded"
          placeholder="Amount (USDC)"
        />

        {/* Buy button */}
        <button
          onClick={handleBuy}
          disabled={isLoading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-700 rounded font-semibold"
        >
          {isLoading ? 'Processing...' : 'Buy Tokens'}
        </button>
      </div>

      {/* Trade Completed Modal */}
      <TradeCompletedModal
        isOpen={!!completedTrade}
        onClose={() => setCompletedTrade(null)}
        details={completedTrade!}
      />
    </div>
  );
}

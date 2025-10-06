/**
 * PostCard Component
 * Main component for displaying individual posts
 */

'use client';

import { useState } from 'react';
import type { Post } from '@/types/post.types';
import { PostHeader } from './components/PostHeader';
import { BeliefIndicator } from './components/BeliefIndicator';
import { usePoolPrice } from '@/hooks/usePoolPrice';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  // Apply spec fallbacks
  const title = post.headline || 'Untitled';
  const authorName = post.author?.name || 'Unknown';
  const content = post.content || '';

  // Fetch pool price if pool address exists
  const { poolPrice, loading: priceLoading } = usePoolPrice(post.poolAddress ? post.id : undefined);

  // Buy tokens functionality
  const { buyTokens, isLoading: isBuying } = useBuyTokens();
  const { address: solanaAddress } = useSolanaWallet();
  const [buyAmount, setBuyAmount] = useState('1'); // Default 1 USDC
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState(false);

  const handleBuy = async () => {
    if (!solanaAddress) {
      setBuyError('Please connect your Solana wallet');
      return;
    }

    const amount = parseFloat(buyAmount);
    if (isNaN(amount) || amount <= 0) {
      setBuyError('Please enter a valid amount');
      return;
    }

    try {
      setBuyError(null);
      setBuySuccess(false);

      // Convert USDC amount to base units (1 USDC = 1_000_000 base units)
      const usdcBaseAmount = Math.floor(amount * 1_000_000);

      console.log(`Buying tokens with ${amount} USDC (${usdcBaseAmount} base units)`);

      await buyTokens(post.id, usdcBaseAmount);

      setBuySuccess(true);

      // Refresh the page after 2 seconds to show updated pool price
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Buy error:', err);
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          setBuyError('Transaction cancelled');
        } else {
          setBuyError(err.message);
        }
      } else {
        setBuyError('Failed to buy tokens');
      }
    }
  };

  return (
    <article className="card p-6 mb-4 hover:shadow-md transition-all">
      <div>
        {/* Header */}
        <PostHeader
          author={post.author}
          timestamp={post.timestamp}
        />

        {/* Content */}
        <div className="flex items-start gap-4 mb-4">
          <h2 className="flex-1 text-xl md:text-2xl font-bold text-text-primary leading-snug font-sans">
            {title}
          </h2>

          {/* Belief Indicator - all posts have beliefs */}
          <BeliefIndicator yesPercentage={post.belief.yesPercentage} />
        </div>

        {/* Text Content */}
        {content && (
          <p className="text-text-secondary text-base leading-relaxed line-clamp-3 font-sans">
            {content}
          </p>
        )}

        {/* Pool Price Display & Buy Interface */}
        {post.poolAddress && (
          <div className="mt-4 pt-4 border-t border-white border-opacity-10 space-y-3">
            {/* Price Display */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Pool Price:</span>
              {priceLoading ? (
                <span className="text-text-secondary">Loading...</span>
              ) : poolPrice ? (
                <div className="text-right">
                  <div className="text-text-primary font-semibold">
                    ${poolPrice.currentPrice.toFixed(4)} USDC
                  </div>
                  <div className="text-text-secondary text-xs mt-1">
                    Supply: {poolPrice.tokenSupply < 0.01 ? poolPrice.tokenSupply.toExponential(2) : poolPrice.tokenSupply.toFixed(2)} • Reserve: ${poolPrice.reserve.toFixed(2)}
                  </div>
                </div>
              ) : (
                <span className="text-text-secondary opacity-70">N/A</span>
              )}
            </div>

            {/* Buy Interface */}
            {solanaAddress && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="USDC amount"
                  min="0.01"
                  step="0.01"
                  disabled={isBuying}
                  className="input text-sm flex-1 max-w-[120px]"
                />
                <button
                  onClick={handleBuy}
                  disabled={isBuying || !buyAmount}
                  className="btn-primary text-sm py-2 px-4"
                >
                  {isBuying ? 'Buying...' : 'Buy Tokens'}
                </button>
              </div>
            )}

            {/* Success/Error Messages */}
            {buySuccess && (
              <div className="text-sm text-green-500 font-medium">
                ✓ Purchase successful! Refreshing...
              </div>
            )}
            {buyError && (
              <div className="text-sm text-error">
                {buyError}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
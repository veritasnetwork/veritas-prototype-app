/**
 * PostCard Component
 * Main component for displaying individual posts
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Post } from '@/types/post.types';
import { PostHeader } from './components/PostHeader';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { useSellTokens } from '@/hooks/useSellTokens';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { formatPoolData } from '@/lib/solana/bonding-curve';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  // Apply spec fallbacks
  const title = post.title || 'Untitled';
  const authorName = post.author?.name || 'Unknown';
  const content = post.content || '';

  // Local state for pool data that can be updated independently
  const [localPoolData, setLocalPoolData] = useState({
    tokenSupply: post.poolTokenSupply,
    reserveBalance: post.poolReserveBalance,
    kQuadratic: post.poolKQuadratic,
  });

  // Calculate pool metrics using local pool data
  const poolPrice = localPoolData.tokenSupply !== undefined &&
                    localPoolData.reserveBalance !== undefined &&
                    localPoolData.kQuadratic !== undefined
    ? formatPoolData(localPoolData.tokenSupply, localPoolData.reserveBalance, localPoolData.kQuadratic)
    : null;

  // Buy tokens functionality
  const { buyTokens, isLoading: isBuying } = useBuyTokens();
  const { sellTokens, isLoading: isSelling } = useSellTokens();
  const { address: solanaAddress } = useSolanaWallet();
  const [buyAmount, setBuyAmount] = useState('1'); // Default 1 USDC
  const [sellAmount, setSellAmount] = useState('1'); // Default 1 token
  const [buyError, setBuyError] = useState<string | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState(false);
  const [sellSuccess, setSellSuccess] = useState(false);

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

      if (!post.poolAddress) {
        throw new Error('Pool address not found for this post');
      }

      await buyTokens(post.id, post.poolAddress, usdcBaseAmount);

      // Sync pool data from chain to database
      if (post.poolAddress && post.poolAddress.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        try {
          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/solana-sync-pool`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              post_id: post.id,
              pool_address: post.poolAddress,
            }),
          });

          if (!syncResponse.ok) {
            const errorText = await syncResponse.text();
            console.warn('Failed to sync pool data:', errorText);
          } else {
            const syncData = await syncResponse.json();

            // Update local pool data with synced values
            setLocalPoolData({
              tokenSupply: parseInt(syncData.token_supply || '0'),
              reserveBalance: parseInt(syncData.reserve || '0'),
              kQuadratic: localPoolData.kQuadratic, // k doesn't change
            });
          }
        } catch (syncError) {
          console.warn('Error syncing pool data:', syncError);
        }
      } else {
        console.warn('No pool address available for post:', post.id);
      }

      setBuySuccess(true);
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

  const handleSell = async () => {
    if (!solanaAddress) {
      setSellError('Please connect your Solana wallet');
      return;
    }

    const amount = parseFloat(sellAmount);
    if (isNaN(amount) || amount <= 0) {
      setSellError('Please enter a valid amount');
      return;
    }

    try {
      setSellError(null);
      setSellSuccess(false);

      // Convert token amount to base units (assuming same precision as buy)
      const tokenBaseAmount = Math.floor(amount * 1_000_000);

      if (!post.poolAddress) {
        throw new Error('Pool address not found for this post');
      }

      await sellTokens(post.id, post.poolAddress, tokenBaseAmount);

      // Sync pool data from chain to database
      if (post.poolAddress && post.poolAddress.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        try {
          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/solana-sync-pool`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              post_id: post.id,
              pool_address: post.poolAddress,
            }),
          });

          if (!syncResponse.ok) {
            const errorText = await syncResponse.text();
            console.warn('Failed to sync pool data:', errorText);
          } else {
            const syncData = await syncResponse.json();

            // Update local pool data with synced values
            setLocalPoolData({
              tokenSupply: parseInt(syncData.token_supply || '0'),
              reserveBalance: parseInt(syncData.reserve || '0'),
              kQuadratic: localPoolData.kQuadratic, // k doesn't change
            });
          }
        } catch (syncError) {
          console.warn('Error syncing pool data:', syncError);
        }
      } else {
        console.warn('No pool address available for post:', post.id);
      }

      setSellSuccess(true);
    } catch (err) {
      console.error('Sell error:', err);
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          setSellError('Transaction cancelled');
        } else {
          setSellError(err.message);
        }
      } else {
        setSellError('Failed to sell tokens');
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

        {/* Content - Clickable area */}
        <div
          className="mb-4 cursor-pointer"
          onClick={() => router.push(`/post/${post.id}`)}
        >
          <h2 className="text-xl md:text-2xl font-bold text-text-primary leading-snug font-sans hover:text-accent-primary transition-colors">
            {title}
          </h2>
        </div>

        {/* Text Content - Clickable area */}
        {content && (
          <p
            className="text-text-secondary text-base leading-relaxed line-clamp-3 font-sans cursor-pointer hover:text-text-primary transition-colors"
            onClick={() => router.push(`/post/${post.id}`)}
          >
            {content}
          </p>
        )}

        {/* View Details Button */}
        <div className="mt-4 pt-4 border-t border-white border-opacity-10">
          <button
            onClick={() => router.push(`/post/${post.id}`)}
            className="text-accent-primary hover:text-accent-dark font-medium text-sm transition-colors"
          >
            View Details & Charts →
          </button>
        </div>

        {/* Pool Price Display & Buy Interface */}
        {post.poolAddress && (
          <div className="mt-4 pt-4 border-t border-white border-opacity-10 space-y-3">
            {/* Price Display */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Pool Price:</span>
              {poolPrice ? (
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

            {/* Buy/Sell Interface */}
            {solanaAddress && (
              <div className="space-y-2">
                {/* Buy Interface */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="USDC amount"
                    min="0.01"
                    step="0.01"
                    disabled={isBuying || isSelling}
                    className="input text-sm flex-1 max-w-[120px]"
                  />
                  <button
                    onClick={handleBuy}
                    disabled={isBuying || isSelling || !buyAmount}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    {isBuying ? 'Buying...' : 'Buy Tokens'}
                  </button>
                </div>

                {/* Sell Interface */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="Token amount"
                    min="0.01"
                    step="0.01"
                    disabled={isBuying || isSelling}
                    className="input text-sm flex-1 max-w-[120px]"
                  />
                  <button
                    onClick={handleSell}
                    disabled={isBuying || isSelling || !sellAmount}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    {isSelling ? 'Selling...' : 'Sell Tokens'}
                  </button>
                </div>
              </div>
            )}

            {/* Success/Error Messages */}
            {buySuccess && (
              <div className="text-sm text-green-500 font-medium">
                ✓ Purchase successful! Refreshing...
              </div>
            )}
            {sellSuccess && (
              <div className="text-sm text-green-500 font-medium">
                ✓ Sell successful! Refreshing...
              </div>
            )}
            {buyError && (
              <div className="text-sm text-error">
                {buyError}
              </div>
            )}
            {sellError && (
              <div className="text-sm text-error">
                {sellError}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
/**
 * CompactPostCard Component
 * Minimal, tweet-like post card for displaying posts in space-limited contexts
 * Used in: Portfolio holdings, search results, related posts
 * Phase 8: Updated to support new schema
 */

'use client';

import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/utils/formatters';
import { getPostTitle, getPostPreview, type Post } from '@/types/post.types';
import { calculateICBSPrice, TokenSide } from '@/lib/solana/icbs-pricing';

export interface CompactPostCardProps {
  post: Post & {
    author: {
      username: string;
      display_name?: string;
    };
    timestamp: string | Date;
  };
  // Optional: User's holdings for this post
  holdings?: {
    long_balance: number;
    short_balance: number;
    token_balance: number;
    current_value_usdc: number;
    total_usdc_spent: number;
    total_usdc_received: number;
    total_lock_usdc: number;
    price_long: number;
    price_short: number;
  };
  // Optional: Click handler (defaults to navigating to post)
  onClick?: () => void;
}

/**
 * Get current LONG token price using ICBS formula
 */
function getCurrentLongPrice(pool: {
  poolSupplyLong?: number;
  poolSupplyShort?: number;
}): number {
  if (!pool.poolSupplyLong || !pool.poolSupplyShort) {
    return 0;
  }

  try {
    return calculateICBSPrice(
      pool.poolSupplyLong,
      pool.poolSupplyShort,
      TokenSide.Long
    );
  } catch {
    return 0;
  }
}

export function CompactPostCard({ post, holdings, onClick }: CompactPostCardProps) {
  const router = useRouter();

  // Get title and preview using new schema helpers
  const title = getPostTitle(post);
  const preview = getPostPreview(post, 60);

  // Calculate current LONG price
  const currentPrice = getCurrentLongPrice({
    poolSupplyLong: post.poolSupplyLong,
    poolSupplyShort: post.poolSupplyShort,
  });

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/post/${post.id}?mode=trade`);
    }
  };

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/profile/${post.author.username}`);
  };

  // Calculate P&L if holdings data available
  const profitLoss = holdings
    ? holdings.current_value_usdc - (holdings.total_usdc_spent - holdings.total_usdc_received)
    : 0;
  const profitLossPercent = holdings && (holdings.total_usdc_spent - holdings.total_usdc_received) > 0
    ? (profitLoss / (holdings.total_usdc_spent - holdings.total_usdc_received)) * 100
    : 0;

  return (
    <article
      onClick={handleClick}
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] hover:shadow-lg transition-all duration-200 cursor-pointer group"
    >
      {/* Header: Title + Author */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white line-clamp-2 mb-1 group-hover:text-[#B9D9EB] transition-colors">
            {title}
          </h3>
          <button
            onClick={handleUsernameClick}
            className="text-xs text-gray-400 hover:text-[#B9D9EB] hover:underline transition-colors"
          >
            @{post.author.username}
          </button>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatRelativeTime(post.timestamp)}
        </span>
      </div>

      {/* Holdings Details (conditional) */}
      {holdings && holdings.token_balance !== undefined && holdings.current_value_usdc !== undefined && (
        <div className="border-t border-[#2a2a2a] pt-3 space-y-2">
          {/* Position Breakdown: LONG vs SHORT */}
          <div className="flex items-center gap-2">
            {holdings.long_balance > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded">
                <span className="text-[10px] font-medium text-green-400">LONG</span>
                <span className="text-xs font-semibold text-white">
                  {holdings.long_balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-gray-400">@${holdings.price_long.toFixed(4)}</span>
              </div>
            )}
            {holdings.short_balance > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded">
                <span className="text-[10px] font-medium text-orange-400">SHORT</span>
                <span className="text-xs font-semibold text-white">
                  {holdings.short_balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-gray-400">@${holdings.price_short.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* Value & P&L */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">
                ${holdings.current_value_usdc.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400">value</span>
            </div>

            {profitLoss !== 0 && (
              <div className={`flex items-center gap-1 ${profitLoss >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                <span className="text-xs font-semibold">
                  {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} USDC
                </span>
                <span className="text-[10px] opacity-80">
                  ({profitLoss >= 0 ? '+' : ''}{profitLossPercent.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {/* Locked Value */}
          {holdings.total_lock_usdc > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-400">
                ${holdings.total_lock_usdc.toFixed(2)} locked
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * HoldingCard Component
 * Displays individual token holdings (LONG or SHORT) with comprehensive metrics
 * Shows: Position type, token amount, current value, P&L, market prediction, cost basis
 */

'use client';

import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/utils/formatters';
import { getPostTitle, type Post } from '@/types/post.types';
import { PostPreviewThumbnail } from './PostPreviewThumbnail';

export type TokenType = 'LONG' | 'SHORT';

export interface HoldingCardProps {
  post: Post & {
    author: {
      username: string;
      display_name?: string;
    };
    timestamp: string | Date;
  };
  tokenType: TokenType;
  holdings: {
    token_balance: number;        // Amount of tokens held
    current_value_usdc: number;   // Current value in USDC
    total_usdc_spent: number;     // Total USDC spent buying
    total_usdc_received: number;  // Total USDC received from selling
    belief_lock: number;          // Locked USDC for this position
    current_price: number;        // Current price per token
    entry_price?: number;         // Weighted average entry price
  };
  pool: {
    supply_long: number;          // Total LONG supply
    supply_short: number;         // Total SHORT supply
    price_long: number;           // Current LONG price
    price_short: number;          // Current SHORT price
    is_settled?: boolean;         // Whether pool has settled
    settled_relevance?: number;   // Final relevance score if settled
  };
}

export function HoldingCard({ post, tokenType, holdings, pool }: HoldingCardProps) {
  const router = useRouter();

  // Debug: Log token volume

  // Get post title
  const title = getPostTitle(post);

  // Use entry_price from API if available, otherwise fall back to calculation
  const avgPrice = holdings.entry_price !== undefined && holdings.entry_price > 0
    ? holdings.entry_price
    : (holdings.total_usdc_spent - holdings.total_usdc_received) / holdings.token_balance;

  // Calculate cost basis using entry price (more accurate than total_usdc_spent - total_usdc_received)
  const costBasis = avgPrice * holdings.token_balance;

  // Calculate balance value at current market price (no slippage)
  const balanceValue = holdings.token_balance * holdings.current_price;

  // Calculate P&L using balance value at current market price (no slippage)
  const profitLoss = balanceValue - costBasis;
  const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

  // Calculate market-implied relevance from price ratio
  // Market prediction = LONG price / (LONG price + SHORT price)
  const totalPrice = pool.price_long + pool.price_short;
  const marketPrediction = totalPrice > 0 ? (pool.price_long / totalPrice) * 100 : 50;

  // Calculate total market cap (supply * price)
  const totalMarketCap = (pool.supply_long * pool.price_long) + (pool.supply_short * pool.price_short);

  // Position styling based on token type
  const isLong = tokenType === 'LONG';
  const positionBg = isLong ? 'bg-[#B9D9EB]/10' : 'bg-orange-500/10';
  const positionBorder = isLong ? 'border-[#B9D9EB]/30' : 'border-orange-500/30';
  const positionText = isLong ? 'text-[#B9D9EB]' : 'text-orange-400';

  const handleClick = () => {
    router.push(`/post/${post.id}`);
  };

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/profile/${post.author.username}`);
  };

  return (
    <article
      onClick={handleClick}
      className={`relative bg-white/5 backdrop-blur-sm border border-white/10 md:rounded-xl rounded-none overflow-hidden hover:bg-white/[0.07] transition-all duration-200 cursor-pointer group md:border-x border-x-0 md:border-t border-t md:border-b border-b-0 last:border-b ${
        isLong
          ? 'hover:shadow-[0_0_30px_rgba(185,217,235,0.15)] hover:border-[#B9D9EB]/30'
          : 'hover:shadow-[0_0_30px_rgba(251,146,60,0.15)] hover:border-orange-500/30'
      }`}
    >
      {/* Color accent bar on left edge */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isLong ? 'bg-[#B9D9EB]' : 'bg-orange-500'}`} />

      <div className="flex gap-4 md:p-4 md:pl-5 p-6 pl-7">
        {/* Left: Post Preview Thumbnail (96x96) - Only for media posts and articles with covers */}
        {(post.post_type === 'image' ||
          post.post_type === 'video' ||
          (post.post_type === 'text' && post.cover_image_url)) && (
          <div className="flex-shrink-0">
            <PostPreviewThumbnail post={post} />
          </div>
        )}

        {/* Post Info & Metrics */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Header Row: Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative max-h-[2.8rem] mb-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-shrink min-w-0">
                    <h3 className="font-semibold text-sm group-hover:text-[#B9D9EB] transition-colors truncate bg-[linear-gradient(to_right,white_300px,white_300px,rgba(255,255,255,0.6)_350px,rgba(255,255,255,0.2)_400px)] bg-clip-text text-transparent">
                      {title.length > 50 ? title.slice(0, 50) : title}
                    </h3>
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400 hover:text-[#B9D9EB] transition-colors cursor-pointer">
                    Read more
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {/* Position Badge */}
                <div className={`flex items-center gap-1.5 px-2 py-0.5 ${positionBg} border ${positionBorder} rounded`}>
                  <span className={`text-xs font-bold ${positionText}`}>{tokenType}</span>
                </div>
                <button
                  onClick={handleUsernameClick}
                  className="hover:text-[#B9D9EB] hover:underline transition-colors"
                >
                  {post.author.display_name || post.author.username}
                </button>
                <span>•</span>
                <span>{formatRelativeTime(post.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="flex items-center justify-between">
            {/* Left: Metrics with dividers */}
            <div className="flex items-center divide-x divide-[#2a2a2a]">
              {/* Balance */}
              <div className="pr-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Balance</div>
                <div className="text-sm font-semibold text-white">
                  {holdings.token_balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Price */}
              <div className="px-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Price</div>
                <div className="text-sm font-semibold text-white">${holdings.current_price.toFixed(4)}</div>
              </div>

              {/* Value */}
              <div className="px-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Value</div>
                <div className="text-sm font-semibold text-white">${balanceValue.toFixed(2)}</div>
              </div>

              {/* Volume */}
              <div className="px-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Volume</div>
                <div className="text-sm font-semibold text-white">
                  ${(post.token_volume_usdc || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Relevance */}
              <div className="pl-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Relevance</div>
                <div className="text-sm font-semibold text-white">
                  {pool.is_settled && pool.settled_relevance !== undefined
                    ? `${(pool.settled_relevance * 100).toFixed(1)}%`
                    : `${marketPrediction.toFixed(1)}%`
                  }
                </div>
              </div>
            </div>

            {/* Right: P&L */}
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${profitLoss >= 0 ? 'text-[#B9D9EB]' : 'text-orange-400'}`}>
                {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
              </span>
              <span className={`text-base font-bold px-2.5 py-1 rounded-md ${
                profitLoss >= 0
                  ? 'bg-[#B9D9EB]/20 text-[#B9D9EB] border border-[#B9D9EB]/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}>
                {profitLoss >= 0 ? '+' : ''}{profitLossPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

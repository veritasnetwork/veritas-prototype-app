/**
 * HoldingCard Component
 * Split-card layout for displaying user holdings with post preview
 * Left: Scaled-down post preview (96x96)
 * Right: Holdings metrics and position details
 */

'use client';

import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/utils/formatters';
import { getPostTitle, type Post } from '@/types/post.types';
import { PostPreviewThumbnail } from './PostPreviewThumbnail';

export interface HoldingCardProps {
  post: Post & {
    author: {
      username: string;
      display_name?: string;
    };
    timestamp: string | Date;
  };
  holdings: {
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
}

export function HoldingCard({ post, holdings }: HoldingCardProps) {
  const router = useRouter();

  // Get post title
  const title = getPostTitle(post);

  // Calculate P&L
  const profitLoss = holdings.current_value_usdc - (holdings.total_usdc_spent - holdings.total_usdc_received);
  const profitLossPercent = (holdings.total_usdc_spent - holdings.total_usdc_received) > 0
    ? (profitLoss / (holdings.total_usdc_spent - holdings.total_usdc_received)) * 100
    : 0;

  const handleClick = () => {
    router.push(`/post/${post.id}?mode=trade`);
  };

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/profile/${post.author.username}`);
  };

  return (
    <article
      onClick={handleClick}
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#3a3a3a] hover:shadow-lg transition-all duration-200 cursor-pointer group"
    >
      <div className="flex gap-4 p-4">
        {/* Left: Post Preview Thumbnail (96x96) */}
        <div className="flex-shrink-0">
          <PostPreviewThumbnail post={post} />
        </div>

        {/* Right: Holdings Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Header: Title + Author + Time */}
          <div className="mb-2">
            <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 group-hover:text-[#B9D9EB] transition-colors">
              {title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <button
                onClick={handleUsernameClick}
                className="hover:text-[#B9D9EB] hover:underline transition-colors"
              >
                @{post.author.username}
              </button>
              <span>•</span>
              <span>{formatRelativeTime(post.timestamp)}</span>
            </div>
          </div>

          {/* Holdings Metrics */}
          <div className="space-y-2">
            {/* Position Breakdown: LONG vs SHORT */}
            <div className="flex items-center gap-2 flex-wrap">
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
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded">
                  <span className="text-[10px] font-medium text-red-400">SHORT</span>
                  <span className="text-xs font-semibold text-white">
                    {holdings.short_balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-gray-400">@${holdings.price_short.toFixed(4)}</span>
                </div>
              )}
            </div>

            {/* Value & P&L Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-white">
                  ${holdings.current_value_usdc.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400">value</span>
              </div>

              {profitLoss !== 0 && (
                <div className={`flex items-center gap-1 ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
        </div>
      </div>
    </article>
  );
}

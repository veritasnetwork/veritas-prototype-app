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
    token_balance: number;
    current_value_usdc: number;
  };
  // Optional: Click handler (defaults to navigating to post)
  onClick?: () => void;
}

/**
 * Get current LONG token price using ICBS formula
 */
function getCurrentLongPrice(pool: {
  poolLongTokenSupply?: number;
  poolShortTokenSupply?: number;
}): number {
  if (!pool.poolLongTokenSupply || !pool.poolShortTokenSupply) {
    return 0;
  }

  try {
    return calculateICBSPrice(
      pool.poolLongTokenSupply,
      pool.poolShortTokenSupply,
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
    poolLongTokenSupply: post.poolLongTokenSupply,
    poolShortTokenSupply: post.poolShortTokenSupply,
  });

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/post/${post.id}`);
    }
  };

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/profile/${post.author.username}`);
  };

  return (
    <article
      onClick={handleClick}
      className="bg-eggshell rounded-lg p-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 cursor-pointer"
    >
      {/* Top Row: Title + Price */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3
          className="font-medium text-text-primary line-clamp-1"
          style={{ maxWidth: '70%' }}
        >
          {title}
        </h3>
        <span className="text-sm font-medium text-text-secondary whitespace-nowrap">
          ${currentPrice.toFixed(4)}
        </span>
      </div>

      {/* Middle Row: Author + Timestamp */}
      <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
        <button
          onClick={handleUsernameClick}
          className="hover:text-text-primary hover:underline transition-colors"
        >
          @{post.author.username}
        </button>
        <span>•</span>
        <span>{formatRelativeTime(post.timestamp)}</span>
      </div>

      {/* Bottom Row: Holdings (conditional) */}
      {holdings && (
        <div className="flex items-center gap-3 text-xs">
          <span className="font-medium text-text-primary">
            {holdings.token_balance.toLocaleString()} tokens
          </span>
          <span className="text-text-tertiary">•</span>
          <span className="font-medium text-success">
            ${holdings.current_value_usdc.toFixed(2)}
          </span>
        </div>
      )}
    </article>
  );
}

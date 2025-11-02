/**
 * CompactProfilePostCard Component
 * Smaller post card for profile pages
 * Similar to HoldingCard but without holdings metrics
 */

'use client';

import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/utils/formatters';
import { getPostTitle, type Post } from '@/types/post.types';
import { PostPreviewThumbnail } from './PostPreviewThumbnail';
import { formatPoolDataFromDb } from '@/lib/solana/sqrt-price-helpers';

interface CompactProfilePostCardProps {
  post: Post;
}

export function CompactProfilePostCard({ post }: CompactProfilePostCardProps) {
  const router = useRouter();

  const title = getPostTitle(post);

  const handleClick = () => {
    router.push(`/post/${post.id}`);
  };

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.author?.username) {
      router.push(`/profile/${post.author.username}`);
    }
  };

  // Calculate pool metrics from cached ICBS data
  const poolData = post.poolSupplyLong !== undefined &&
                    post.poolSupplyShort !== undefined &&
                    post.poolSqrtPriceLongX96 &&
                    post.poolSqrtPriceShortX96 &&
                    post.poolVaultBalance !== undefined
    ? formatPoolDataFromDb(
        post.poolSupplyLong,
        post.poolSupplyShort,
        post.poolSqrtPriceLongX96,
        post.poolSqrtPriceShortX96,
        post.poolVaultBalance
      )
    : null;

  // Use market implied relevance from database (if available)
  const marketImpliedRelevance = (post as any).marketImpliedRelevance ??
    (poolData && poolData.marketCap > 0
      ? (poolData.marketCapLong !== undefined && poolData.marketCapShort !== undefined
          ? poolData.marketCapLong / (poolData.marketCapLong + poolData.marketCapShort)
          : 0.5)
      : null);

  return (
    <article
      onClick={handleClick}
      className="relative bg-white/5 backdrop-blur-sm border border-white/10 md:rounded-xl rounded-none overflow-hidden hover:bg-white/[0.07] hover:shadow-[0_0_30px_rgba(185,217,235,0.15)] hover:border-[#B9D9EB]/30 transition-all duration-200 cursor-pointer group md:border-x border-x-0 md:border-t border-t md:border-b border-b-0 last:border-b"
    >
      <div className="flex gap-4 md:p-4 p-6">
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
                {post.author && (
                  <>
                    <button
                      onClick={handleUsernameClick}
                      className="hover:text-[#B9D9EB] hover:underline transition-colors"
                    >
                      @{post.author.username}
                    </button>
                    <span>•</span>
                  </>
                )}
                <span>{formatRelativeTime(post.timestamp || (post as any).created_at)}</span>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="flex items-center justify-between">
            {/* Left: Metrics with dividers */}
            <div className="flex items-center divide-x divide-[#2a2a2a]">
              {/* LONG Price */}
              {poolData && (
                <div className="pr-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Long Price</div>
                  <div className="text-sm font-semibold text-white">${poolData.priceLong.toFixed(4)}</div>
                </div>
              )}

              {/* SHORT Price */}
              {poolData && (
                <div className="px-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Short Price</div>
                  <div className="text-sm font-semibold text-white">${poolData.priceShort.toFixed(4)}</div>
                </div>
              )}

              {/* Total Volume */}
              {post.totalVolumeUsdc !== undefined && post.totalVolumeUsdc > 0 && (
                <div className="px-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Volume</div>
                  <div className="text-sm font-semibold text-white">
                    ${post.totalVolumeUsdc >= 1000
                      ? (post.totalVolumeUsdc / 1000).toFixed(1) + 'k'
                      : post.totalVolumeUsdc.toFixed(0)}
                  </div>
                </div>
              )}

              {/* Relevance */}
              {marketImpliedRelevance !== null && !isNaN(marketImpliedRelevance) && (
                <div className="pl-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Relevance</div>
                  <div className="text-sm font-semibold text-white">
                    {(marketImpliedRelevance * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

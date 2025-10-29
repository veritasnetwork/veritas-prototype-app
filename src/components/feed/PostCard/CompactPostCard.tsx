/**
 * CompactPostCard Component
 * Grid-optimized card for Explore page
 */

'use client';

import { useRouter } from 'next/navigation';
import type { Post } from '@/types/post.types';
import { getPostTitle, getPostPreview } from '@/types/post.types';
import { calculateICBSPrice, TokenSide, calculateMarketPrediction } from '@/lib/solana/icbs-pricing';

interface CompactPostCardProps {
  post: Post;
  onClick?: () => void;
}

export function CompactPostCard({ post, onClick }: CompactPostCardProps) {
  const router = useRouter();

  // Get preview text for display
  const preview = getPostPreview(post, 120);

  // Calculate pool metrics using ICBS
  const poolData = post.poolSupplyLong && post.poolSupplyShort
    ? {
        longPrice: calculateICBSPrice(post.poolSupplyLong, post.poolSupplyShort, TokenSide.Long),
        shortPrice: calculateICBSPrice(post.poolSupplyLong, post.poolSupplyShort, TokenSide.Short),
        prediction: calculateMarketPrediction(post.poolSupplyLong, post.poolSupplyShort),
      }
    : null;

  // Calculate total pool value (virtual reserves)
  // Note: poolSupplyLong and poolSupplyShort are already in display units from API
  const poolValue = poolData
    ? post.poolSupplyLong! * poolData.longPrice +
      post.poolSupplyShort! * poolData.shortPrice
    : null;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/post/${post.id}?mode=trade`);
    }
  };

  return (
    <article
      onClick={handleClick}
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/50 transition-all cursor-pointer"
    >
      {/* Featured Image/Media with Pool Badge */}
      <div className="relative w-full h-40 bg-gradient-to-br from-gray-800 to-gray-900">
        {/* Show actual image/video for media posts */}
        {post.post_type === 'image' && post.media_urls?.[0] && (
          <img
            src={post.media_urls[0]}
            alt={post.caption || 'Post image'}
            className="w-full h-full object-cover"
          />
        )}

        {/* Pool Size Badge */}
        {post.poolAddress && poolValue && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-medium text-blue-400 border border-blue-500/30">
            ${poolValue.toFixed(2)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Preview text - no title */}
        <p className="text-sm text-white leading-relaxed line-clamp-3 mb-3">
          {preview || 'No content'}
        </p>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{post.author.display_name || post.author.username}</span>
          <span>•</span>
          <span>{new Date(post.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
    </article>
  );
}

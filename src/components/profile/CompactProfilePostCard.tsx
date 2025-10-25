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

interface CompactProfilePostCardProps {
  post: Post;
}

export function CompactProfilePostCard({ post }: CompactProfilePostCardProps) {
  const router = useRouter();

  const title = getPostTitle(post);

  const handleClick = () => {
    router.push(`/post/${post.id}?mode=trade`);
  };

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.author?.username) {
      router.push(`/profile/${post.author.username}`);
    }
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

        {/* Right: Post Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Header: Title + Timestamp */}
          <div className="mb-2">
            <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 group-hover:text-[#B9D9EB] transition-colors">
              {title}
            </h3>
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
              <span>{formatRelativeTime(post.created_at || post.timestamp)}</span>
            </div>
          </div>

          {/* Pool Status Badge (if deployed) */}
          {post.poolAddress && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-[10px] font-medium text-blue-400">Market Active</span>
              </div>

              {/* Quick metrics if available */}
              {post.poolLongTokenSupply && post.poolShortTokenSupply && (
                <div className="text-[10px] text-gray-500">
                  {(post.poolLongTokenSupply + post.poolShortTokenSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
                </div>
              )}
            </div>
          )}

          {/* No Pool Badge */}
          {!post.poolAddress && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded w-fit">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-medium text-gray-400">Pending Deployment</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

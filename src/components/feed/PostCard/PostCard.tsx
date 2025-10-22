/**
 * PostCard Component
 * Redesigned with content-first approach and overlay UI
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Post } from '@/types/post.types';
import { getPostTitle, getPostPreview, isShortFormPost } from '@/types/post.types';
import { TrendingUp, DollarSign, BarChart3, FileText, Play } from 'lucide-react';
import { usePanel } from '@/components/post/PostDetailPanel';
import { FEATURES } from '@/config/features';
import { RichTextRenderer } from '@/components/common/RichTextRenderer';
import { formatPoolDataFromDb } from '@/lib/solana/sqrt-price-helpers';

interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  isSelected?: boolean;
}

export function PostCard({ post, onPostClick, isSelected = false }: PostCardProps) {
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const { isOpen, selectedPostId, closePanel } = FEATURES.POST_DETAIL_PANEL ? usePanel() : { isOpen: false, selectedPostId: null, closePanel: () => {} };

  // Initialize expansion state based on whether this post's panel is open
  const [isExpanded, setIsExpanded] = useState(
    post.post_type === 'text' && isOpen && selectedPostId === post.id
  );

  // State for fetched full content
  const [fullContentJson, setFullContentJson] = useState(post.content_json || null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Determine if panel is open for this post - use isSelected prop if provided, otherwise fall back to panel state
  const isPanelOpenForThisPost = isSelected || (FEATURES.POST_DETAIL_PANEL && isOpen && selectedPostId === post.id);

  // Fetch full content when expanded (if not already loaded)
  useEffect(() => {
    if (isExpanded && post.post_type === 'text' && !fullContentJson && !loadingContent) {
      const fetchFullContent = async () => {
        try {
          setLoadingContent(true);
          const response = await fetch(`/api/posts/${post.id}`);
          if (!response.ok) throw new Error('Failed to fetch post');
          const data = await response.json();
          setFullContentJson(data.content_json);
        } catch (err) {
          console.error('Error fetching full content:', err);
        } finally {
          setLoadingContent(false);
        }
      };
      fetchFullContent();
    }
  }, [isExpanded, post.id, post.post_type, fullContentJson, loadingContent]);

  // Sync expansion state with panel state for this specific post
  useEffect(() => {
    if (post.post_type === 'text') {
      // Only contract if:
      // 1. Panel is open for a different post (selectedPostId changed)
      // 2. Panel was closed (but not in the same render cycle as expansion)
      if (selectedPostId !== post.id && isExpanded && isOpen) {
        setIsExpanded(false);
      }
    }
  }, [isOpen, selectedPostId, post.id, post.post_type, isExpanded]);

  // Scroll article to top when expanded
  useEffect(() => {
    if (isExpanded && articleRef.current && post.post_type === 'text' && (post.article_title || post.cover_image_url)) {
      // Small delay to allow expansion animation to start
      setTimeout(() => {
        // Get the article's position and scroll it to the top of viewport
        const rect = articleRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = rect.top + scrollTop;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }, 150);
    }
  }, [isExpanded, post.post_type, post.article_title, post.cover_image_url]);

  const handleClick = (e?: React.MouseEvent) => {
    // For text posts, check if content is truncated before allowing expansion
    if (post.post_type === 'text') {
      // For short-form posts, never expand (they show full content already)
      if (isShortFormPost(post)) {
        // Just open the panel for trading
        if (onPostClick) {
          onPostClick(post.id);
        }
        return;
      }

      // For long-form posts, check if content is actually truncated
      const contentLength = post.content_text?.length || 0;
      const previewLength = 150; // matches getPostPreview call below
      const canExpand = contentLength > previewLength || post.article_title || post.cover_image_url;

      if (canExpand) {
        const willExpand = !isExpanded;
        setIsExpanded(willExpand);

        // Only open panel if expanding (not collapsing)
        if (willExpand && onPostClick) {
          onPostClick(post.id);
        }
        // Close panel if collapsing - only call closePanel if we're in a panel context
        // (not in Feed.tsx which doesn't use PanelProvider)
        else if (!willExpand && onPostClick) {
          // In Feed.tsx context, onPostClick handles toggling
          onPostClick(post.id);
        }
      } else {
        // Content fits in preview, just open panel for trading
        if (onPostClick) {
          onPostClick(post.id);
        }
      }
    } else {
      // For media posts, always open panel
      if (onPostClick) {
        onPostClick(post.id);
      }
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setIsExpanded(!isExpanded);
  };

  // Get content preview or full content
  const preview = getPostPreview(post, 150);
  const fullContent = post.content_text || preview;

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

  // Determine background for different post types
  const getBackgroundElement = () => {
    if (post.post_type === 'image' && post.media_urls && post.media_urls.length > 0) {
      return (
        <img
          src={post.media_urls[0]}
          alt={post.caption || 'Post image'}
          className="w-full h-full object-cover"
        />
      );
    } else if (post.post_type === 'video' && post.media_urls && post.media_urls.length > 0) {
      return (
        <>
          <img
            src={post.media_urls[0]}
            alt={post.caption || 'Video thumbnail'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-8 h-8 text-black ml-1" />
            </div>
          </div>
        </>
      );
    } else if (post.post_type === 'text') {
      // MODE 0: Short-form tweet-like post (no title, no cover, ≤500 chars)
      if (isShortFormPost(post)) {
        return (
          <div className="w-full h-full bg-[#1a1a1a] p-4">
            {!isExpanded && (
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {post.content_text || 'No content'}
                </p>
              </div>
            )}

            {isExpanded && (
              <div className="w-full h-full overflow-y-auto">
                {loadingContent ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full"></div>
                  </div>
                ) : fullContentJson ? (
                  <RichTextRenderer content={fullContentJson} />
                ) : (
                  <p className="text-gray-400">No content available</p>
                )}
              </div>
            )}
          </div>
        );
      }

      // MODE 1: Cover Image + Title (Featured Article Style)
      if (post.cover_image_url && post.article_title) {
        return (
          <div className="w-full h-full relative">
            {!isExpanded && (
              <>
                {/* COLLAPSED: Full-bleed cover with title overlay at bottom */}
                <img
                  src={post.cover_image_url}
                  alt={post.article_title}
                  className="w-full h-full object-cover"
                />

                {/* Bottom gradient for title readability */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10" />

                {/* Title overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                  <h2
                    className="font-bold text-white leading-tight line-clamp-2"
                    style={{
                      fontSize: post.article_title && post.article_title.length > 50
                        ? 'clamp(1rem, 2.5vw, 1.25rem)'  // Smaller for long titles
                        : 'clamp(1.25rem, 3vw, 1.75rem)', // Larger for short titles
                    }}
                  >
                    {post.article_title}
                  </h2>
                </div>
              </>
            )}

            {isExpanded && (
              <>
                {/* EXPANDED: Cover at top, then title, then content */}
                <div className="w-full h-full bg-[#1a1a1a] overflow-y-auto">
                  {/* Cover Image (fixed height when expanded) */}
                  <div className="w-full h-64 overflow-hidden">
                    <img
                      src={post.cover_image_url}
                      alt={post.article_title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content area */}
                  <div className="p-8">
                    {/* Title */}
                    <h2 className="text-3xl font-bold text-white mb-6">
                      {post.article_title}
                    </h2>

                    {/* Rich text content */}
                    {loadingContent ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full"></div>
                      </div>
                    ) : fullContentJson ? (
                      <RichTextRenderer content={fullContentJson} />
                    ) : (
                      <p className="text-gray-400">No content available</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }

      // MODE 2: Text-only article (no cover, possibly no title)
      return (
        <div className="w-full h-full bg-[#1a1a1a]">
          {!isExpanded && (
            <>
              {/* COLLAPSED: Content preview with fade effect */}
              <div className="w-full h-full overflow-hidden pt-8 pb-12 px-4 relative">
                <div className="prose prose-invert prose-sm max-w-none w-full">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {preview || 'No content'}
                  </p>
                </div>

                {/* Fade gradient at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/80 to-transparent pointer-events-none" />
              </div>

              {/* "Read More" text at bottom */}
              <div className="absolute bottom-3 left-4">
                <span className="text-xs text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors">
                  Read More →
                </span>
              </div>
            </>
          )}

          {isExpanded && (
            <div className="w-full h-full overflow-y-auto p-8">
              {/* Optional title (if provided without cover) */}
              {post.article_title && (
                <h2 className="text-3xl font-bold text-white mb-6">
                  {post.article_title}
                </h2>
              )}

              {/* Full rich text content */}
              {loadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full"></div>
                </div>
              ) : fullContentJson ? (
                <RichTextRenderer content={fullContentJson} />
              ) : (
                <p className="text-gray-400">No content available</p>
              )}
            </div>
          )}
        </div>
      );
    }
  };

  const contentToShow = post.post_type === 'text' ? (isExpanded ? fullContent : preview) : post.caption;

  // Substack-style: Caption outside card for media posts, Author outside for articles
  const hasCaption = (post.post_type === 'image' || post.post_type === 'video') && post.caption;
  const showAuthorAbove = hasCaption || post.post_type === 'text';

  return (
    <article
      ref={articleRef}
      className="cursor-pointer group mx-1"
      onClick={(e) => {
        handleClick(e);
      }}
    >
      {/* Author and Caption - Outside the content card (Substack style) */}
      {showAuthorAbove && (
        <div className="mb-2">
          {/* Author Info with Belief & Price */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[#F0EAD6] flex items-center justify-center text-gray-700 text-xs font-bold">
              {post.author?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-white font-medium text-xs">@{post.author?.username || 'anonymous'}</span>

            {/* Price pill next to username */}
            {poolData && (
              <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center justify-center">
                <span className="font-semibold text-[#EA900E] text-xs">${poolData.currentPrice.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* User's caption/comment - Only for media posts */}
          {hasCaption && (
            <p className="text-white text-sm leading-relaxed">
              {post.caption}
            </p>
          )}
        </div>
      )}

      {/* Content Card - The article/media preview */}
      <div
        className={`relative bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 ${
          isPanelOpenForThisPost
            ? 'ring-2 ring-[#B9D9EB]'
            : 'group-hover:ring-2 group-hover:ring-gray-600/50'
        }`}
      >
        <div className={`relative w-full transition-all duration-500 ${
          post.post_type === 'image' || post.post_type === 'video'
            ? 'aspect-[3/2]'
            : 'h-auto'
        }`}>
          {/* Background - Image, Video, or Gradient */}
          {getBackgroundElement()}

          {/* Author Info - Only for media without caption (text posts show author above now) */}
          {!showAuthorAbove && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-[#F0EAD6] flex items-center justify-center text-gray-700 text-sm font-bold">
                {post.author?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-white font-medium text-sm">@{post.author?.username || 'anonymous'}</span>
              {/* Price pill next to username (for posts without author above) */}
              {poolData && (
                <div className="bg-black/70 rounded-full px-2 py-0.5 ml-2">
                  <span className="font-semibold text-[#EA900E] text-xs">${poolData.currentPrice.toFixed(4)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
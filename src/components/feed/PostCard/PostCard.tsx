/**
 * PostCard Component
 * Redesigned with content-first approach and overlay UI
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Post } from '@/types/post.types';
import { getPostTitle, getPostPreview, isShortFormPost } from '@/types/post.types';
import { TrendingUp, DollarSign, BarChart3, FileText, Play, Volume2, VolumeX, Pause } from 'lucide-react';
import { usePanel } from '@/components/post/PostDetailPanel';
import { FEATURES } from '@/config/features';
import { RichTextRenderer } from '@/components/common/RichTextRenderer';
import { formatPoolDataFromDb } from '@/lib/solana/sqrt-price-helpers';
import { useVideoPriority } from '@/hooks/useVideoPriority';
import { getMediaDisplayMode } from '@/lib/utils/media';

interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  isSelected?: boolean;
  compact?: boolean; // For grid layouts (Explore page) - shorter text previews
  disabled?: boolean; // Disable click interactions (e.g., during pull-to-refresh)
}

export function PostCard({ post, onPostClick, isSelected = false, compact = false, disabled = false }: PostCardProps) {
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { isOpen, selectedPostId, closePanel } = FEATURES.POST_DETAIL_PANEL ? usePanel() : { isOpen: false, selectedPostId: null, closePanel: () => {} };

  // No longer expanding posts - they navigate to their own page
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // State for fetched full content
  const [fullContentJson, setFullContentJson] = useState(post.content_json || null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Lazy loading state
  const [shouldLoadMedia, setShouldLoadMedia] = useState(post.post_type === 'text'); // Text loads immediately

  // Register video with priority manager (only plays 2-3 videos closest to viewport center)
  const { setUserPaused, setHovered } = useVideoPriority(videoRef, cardRef, post.id, post.post_type === 'video' && shouldLoadMedia);

  // Determine if panel is open for this post - use isSelected prop if provided, otherwise fall back to panel state
  const isPanelOpenForThisPost = isSelected || (FEATURES.POST_DETAIL_PANEL && isOpen && selectedPostId === post.id);

  // Viewport detection for lazy loading
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Load media when entering viewport with margin
          if (entry.isIntersecting && !shouldLoadMedia) {
            setShouldLoadMedia(true);
          }
        });
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0.1,
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [shouldLoadMedia]);

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
        if (!articleRef.current) return;
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
    if (disabled) {
      console.log('[PostCard] Click ignored - card is disabled');
      return;
    }
    console.log('[PostCard] Click detected on post:', post.id, 'Type:', post.post_type);
    // Always just open the panel for trading, never expand
    if (onPostClick) {
      console.log('[PostCard] Calling onPostClick with:', post.id);
      onPostClick(post.id);
    } else {
      console.log('[PostCard] No onPostClick handler provided!');
    }
  };

  const handleReadMore = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (disabled) {
      console.log('[PostCard] Read More ignored - card is disabled');
      return;
    }
    // Store post data in sessionStorage for instant loading on the post page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`post_${post.id}`, JSON.stringify(post));
    }
    // Navigate to post page in trade mode
    router.push(`/post/${post.id}?mode=trade`);
  };

  // Get content preview or full content
  // For text-only posts without cover, show more preview text (up to 800 chars before truncating)
  // In compact mode (grid), use much shorter previews to keep heights standard: 100 chars max
  const previewLength = compact
    ? 100  // Very short for grid - keeps card heights consistent
    : (post.post_type === 'text' && !post.cover_image_url && !isShortFormPost(post) ? 800 : 150);
  const preview = getPostPreview(post, previewLength);
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

  // Use market implied relevance from database (if available)
  // This comes from implied_relevance_history table and is used for both ranking and display
  const marketImpliedRelevance = (post as any).marketImpliedRelevance ??
    // Fallback: calculate from pool data if database value not available
    (poolData && poolData.marketCap > 0
      ? (poolData.marketCapLong !== undefined && poolData.marketCapShort !== undefined
          ? poolData.marketCapLong / (poolData.marketCapLong + poolData.marketCapShort)
          : 0.5)
      : null);

  // Check if content is actually truncated (needs Read More button) - define before getBackgroundElement
  const needsReadMore = (post.content_text?.length || 0) > previewLength + 50; // +50 for some buffer

  // Determine background for different post types
  const getBackgroundElement = () => {
    if (post.post_type === 'image' && post.media_urls && post.media_urls.length > 0) {
      // Use aspect ratio if available, otherwise calculate from display mode
      const ratio = post.aspect_ratio || (16 / 9);
      const displayMode = post.aspect_ratio ? getMediaDisplayMode(ratio) : 'native';
      const isExtreme = displayMode === 'letterbox' || displayMode === 'pillarbox';

      // Lazy load images - only load when shouldLoadMedia is true
      if (!shouldLoadMedia) {
        return (
          <div className={`w-full bg-gray-800 animate-pulse ${isExtreme ? 'flex items-center justify-center' : ''}`} style={{ minHeight: '200px', maxHeight: '600px' }} />
        );
      }

      return (
        <img
          src={post.media_urls[0]}
          alt={post.caption || 'Post image'}
          loading="lazy"
          className={`w-full ${isExtreme ? 'max-w-full max-h-full object-contain' : 'h-auto'}`}
        />
      );
    } else if (post.post_type === 'video' && post.media_urls && post.media_urls.length > 0) {
      // For videos: media_urls = [thumbnail, video] or [video] for old posts
      const videoUrl = post.media_urls.length > 1 ? post.media_urls[1] : post.media_urls[0];
      const posterUrl = post.media_urls.length > 1 ? post.media_urls[0] : undefined;

      const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
          videoRef.current.muted = !isMuted;
          setIsMuted(!isMuted);
        }
      };

      const togglePause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
          const newPausedState = !isPaused;
          setIsPaused(newPausedState);
          setUserPaused(newPausedState);
        }
      };

      // Lazy load videos - show poster until shouldLoadMedia is true
      if (!shouldLoadMedia) {
        return (
          <div className="relative w-full h-full bg-gray-800">
            {posterUrl && (
              <img
                src={posterUrl}
                alt="Video thumbnail"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            )}
          </div>
        );
      }

      // Use aspect ratio if available
      const ratio = post.aspect_ratio || (16 / 9);
      const displayMode = post.aspect_ratio ? getMediaDisplayMode(ratio) : 'native';
      const isExtreme = displayMode === 'letterbox' || displayMode === 'pillarbox';

      return (
        <div
          className={`relative w-full ${isExtreme ? 'flex items-center justify-center bg-black' : ''}`}
          style={isExtreme ? { maxHeight: '90vh' } : undefined}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            loop
            muted
            playsInline
            preload="metadata"
            className={`w-full ${isExtreme ? 'max-h-full object-contain' : 'h-auto'}`}
          />
          {/* Pause/Resume Toggle - Bottom Left */}
          <button
            onClick={togglePause}
            className="absolute bottom-4 left-4 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white/70 hover:text-white transition-all z-10"
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
          {/* Mute/Unmute Toggle - Bottom Right */}
          <button
            onClick={toggleMute}
            className="absolute bottom-4 right-4 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white/70 hover:text-white transition-all z-10"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>
      );
    } else if (post.post_type === 'text') {
      // MODE 0: Short-form tweet-like post (no title, no cover, ≤500 chars)
      if (isShortFormPost(post)) {
        return (
          <div className="w-full lg:bg-[#1a1a1a] lg:p-4 relative">
            {!isExpanded && (
              <>
                <div className={compact ? 'max-h-[120px] overflow-hidden' : ''}>
                  <p className="text-gray-200 text-sm leading-relaxed m-0 w-full break-words overflow-wrap-anywhere">
                    {compact ? preview : (post.content_text || 'No content')}
                  </p>
                </div>
                {compact && needsReadMore && (
                  <button
                    onClick={handleReadMore}
                    className="mt-2 text-xs text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors"
                  >
                    Read More →
                  </button>
                )}
              </>
            )}

            {isExpanded && (
              <div className="w-full h-full overflow-y-auto lg:p-4">
                {loadingContent ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full"></div>
                  </div>
                ) : fullContentJson ? (
                  <RichTextRenderer content={fullContentJson} />
                ) : (
                  <p className="text-gray-400">No content available</p>
                )}

                {/* Removed collapse button - expansion no longer used */}
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
                    className="font-bold text-white leading-tight line-clamp-2 mb-2"
                    style={{
                      fontSize: post.article_title && post.article_title.length > 50
                        ? 'clamp(1rem, 2.5vw, 1.25rem)'  // Smaller for long titles
                        : 'clamp(1.25rem, 3vw, 1.75rem)', // Larger for short titles
                    }}
                  >
                    {post.article_title}
                  </h2>

                  {/* Read More button */}
                  <button
                    onClick={handleReadMore}
                    className="text-sm text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors"
                  >
                    Read More →
                  </button>
                </div>
              </>
            )}

            {isExpanded && (
              <>
                {/* EXPANDED: Cover at top, then title, then content */}
                <div className="w-full h-full lg:bg-[#1a1a1a] overflow-y-auto">
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

                    {/* Removed collapse button - expansion no longer used */}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }

      // MODE 2: Text-only article (no cover, possibly no title)
      return (
        <div className="w-full lg:bg-[#1a1a1a] relative">
          {!isExpanded && (
            <>
              {/* COLLAPSED: Content preview - in compact mode, use fixed height to match other cards */}
              <div className={`w-full lg:pt-6 ${needsReadMore ? 'pb-16' : 'lg:pb-6'} lg:px-6 relative ${compact ? 'max-h-[180px] overflow-hidden' : (needsReadMore ? 'max-h-[400px] overflow-hidden' : '')}`}>
                <div className="prose prose-invert max-w-none w-full">
                  {post.content_json ? (
                    <RichTextRenderer content={post.content_json} />
                  ) : (
                    <p className="text-gray-200 text-base leading-relaxed break-words overflow-wrap-anywhere">
                      {preview || 'No content'}
                    </p>
                  )}
                </div>

                {/* Only show fade gradient if content is truncated */}
                {needsReadMore && (
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent pointer-events-none" />
                )}
              </div>

              {/* "Read More" text at bottom - only if content is truncated */}
              {needsReadMore && (
                <div className="absolute bottom-4 left-6 z-10">
                  <button
                    onClick={handleReadMore}
                    className="text-sm text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors bg-[#1a1a1a] px-2 py-1 rounded"
                  >
                    Read More →
                  </button>
                </div>
              )}
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

              {/* Removed collapse button - expansion no longer used */}
            </div>
          )}
        </div>
      );
    }
  };

  const contentToShow = post.post_type === 'text' ? (isExpanded ? fullContent : preview) : post.caption;

  // Substack-style: Caption outside card for media posts, Author outside for articles
  const hasCaption = (post.post_type === 'image' || post.post_type === 'video') && post.caption;
  const showAuthorAbove = post.post_type === 'image' || post.post_type === 'text' || hasCaption;

  return (
    <article
      ref={cardRef}
      className="cursor-pointer group"
      onClick={(e) => {
        handleClick(e);
      }}
    >
      {/* Author and Caption - Outside the content card (Substack style) */}
      {showAuthorAbove && (
        <div className="mb-2 lg:mb-2">
          {/* Author Info with Belief & Price */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[#F0EAD6] flex items-center justify-center text-gray-700 text-xs font-bold">
              {(post.author?.display_name?.[0] || post.author?.username?.[0])?.toUpperCase() || '?'}
            </div>
            <span className="text-white font-medium text-xs">{post.author?.display_name || post.author?.username || 'anonymous'}</span>

            {/* Market implied relevance pill */}
            {marketImpliedRelevance !== null && !isNaN(marketImpliedRelevance) && (
              <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-[#B9D9EB] mr-1" />
                <span className="font-semibold text-[#B9D9EB] text-xs">{(marketImpliedRelevance * 100).toFixed(1)}%</span>
              </div>
            )}

            {/* Total volume pill */}
            {post.totalVolumeUsdc !== undefined && post.totalVolumeUsdc > 0 && (
              <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-gray-400 mr-1" />
                <span className="font-semibold text-gray-300 text-xs">${post.totalVolumeUsdc >= 1000 ? (post.totalVolumeUsdc / 1000).toFixed(1) + 'k' : post.totalVolumeUsdc.toFixed(0)}</span>
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
      {/* Mobile: Rounded corners for images */}
      {/* Desktop: Card with rounded corners and hover ring */}
      <div
        className={`relative overflow-hidden transition-all duration-1000
          rounded-xl lg:bg-[#1a1a1a]
          ${isPanelOpenForThisPost
            ? 'lg:ring-2 lg:ring-[#B9D9EB]'
            : 'lg:group-hover:ring-2 lg:group-hover:ring-gray-600/50'
          }`}
      >
        <div className="relative w-full h-auto">
          {/* Background - Image, Video, or Gradient */}
          {getBackgroundElement()}

          {/* Author Info - Only for media without caption (text posts show author above now) */}
          {!showAuthorAbove && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-[#F0EAD6] flex items-center justify-center text-gray-700 text-sm font-bold">
                {(post.author?.display_name?.[0] || post.author?.username?.[0])?.toUpperCase() || '?'}
              </div>
              <span className="text-white font-medium text-sm">{post.author?.display_name || post.author?.username || 'anonymous'}</span>
              {/* Market implied relevance pill (for posts without author above) */}
              {marketImpliedRelevance !== null && !isNaN(marketImpliedRelevance) && (
                <div className="bg-black/70 rounded-full px-2 py-0.5 ml-2 flex items-center">
                  <TrendingUp className="w-3 h-3 text-[#B9D9EB] mr-1" />
                  <span className="font-semibold text-[#B9D9EB] text-xs">{(marketImpliedRelevance * 100).toFixed(1)}%</span>
                </div>
              )}
              {/* Total volume pill (for posts without author above) */}
              {post.totalVolumeUsdc !== undefined && post.totalVolumeUsdc > 0 && (
                <div className="bg-black/70 rounded-full px-2 py-0.5 ml-2 flex items-center">
                  <BarChart3 className="w-3 h-3 text-gray-400 mr-1" />
                  <span className="font-semibold text-gray-300 text-xs">${post.totalVolumeUsdc >= 1000 ? (post.totalVolumeUsdc / 1000).toFixed(1) + 'k' : post.totalVolumeUsdc.toFixed(0)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
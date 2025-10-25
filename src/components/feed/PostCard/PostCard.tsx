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

interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  isSelected?: boolean;
}

export function PostCard({ post, onPostClick, isSelected = false }: PostCardProps) {
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isOpen, selectedPostId, closePanel } = FEATURES.POST_DETAIL_PANEL ? usePanel() : { isOpen: false, selectedPostId: null, closePanel: () => {} };

  // No longer expanding posts - they navigate to their own page
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

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
    // Always just open the panel for trading, never expand
    if (onPostClick) {
      onPostClick(post.id);
    }
  };

  const handleReadMore = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    // Store post data in sessionStorage for instant loading on the post page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`post_${post.id}`, JSON.stringify(post));
    }
    // Navigate to post page in read mode for article reading
    router.push(`/post/${post.id}?mode=read`);
  };

  // Get content preview or full content
  // For text-only posts without cover, show more preview text (up to 600 chars)
  const previewLength = post.post_type === 'text' && !post.cover_image_url && !isShortFormPost(post) ? 600 : 150;
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
    (poolData ? poolData.marketCapLong / (poolData.marketCapLong + poolData.marketCapShort) : null);

  // Determine background for different post types
  const getBackgroundElement = () => {
    if (post.post_type === 'image' && post.media_urls && post.media_urls.length > 0) {
      const displayMode = (post as any).image_display_mode || 'contain';
      const useContain = displayMode === 'contain';

      return (
        <img
          src={post.media_urls[0]}
          alt={post.caption || 'Post image'}
          className={`w-full ${useContain ? 'h-auto object-contain' : 'h-full object-cover'}`}
          style={useContain ? { maxHeight: '600px' } : undefined}
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
          if (isPaused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
          setIsPaused(!isPaused);
        }
      };

      return (
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
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
          <div className="w-full h-full bg-[#1a1a1a] p-4">
            {!isExpanded && (
              <div className="prose prose-invert prose-sm max-w-none">
                {post.content_json ? (
                  <RichTextRenderer content={post.content_json} />
                ) : (
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {post.content_text || 'No content'}
                  </p>
                )}
              </div>
            )}

            {isExpanded && (
              <div className="w-full h-full overflow-y-auto p-4">
                {loadingContent ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full"></div>
                  </div>
                ) : fullContentJson ? (
                  <RichTextRenderer content={fullContentJson} />
                ) : (
                  <p className="text-gray-400">No content available</p>
                )}

                {/* Collapse button at bottom */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleToggleExpand}
                    className="text-sm text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors"
                  >
                    ← Collapse
                  </button>
                </div>
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

                    {/* Collapse button at bottom */}
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={handleToggleExpand}
                        className="text-sm text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors"
                      >
                        ← Collapse
                      </button>
                    </div>
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
              {/* COLLAPSED: Content preview with fade effect - show more text for text-only posts */}
              <div className="w-full overflow-hidden pt-6 pb-16 px-6 relative h-64">
                <div className="prose prose-invert max-w-none w-full overflow-hidden">
                  {post.content_json ? (
                    <RichTextRenderer content={post.content_json} />
                  ) : (
                    <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                      {preview || 'No content'}
                    </p>
                  )}
                </div>

                {/* Fade gradient at bottom - taller gradient for more lines */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent pointer-events-none" />
              </div>

              {/* "Read More" text at bottom */}
              <div className="absolute bottom-4 left-6 z-10">
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

              {/* Collapse button at bottom */}
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleToggleExpand}
                  className="text-sm text-[#B9D9EB] font-medium hover:text-[#D0E7F4] transition-colors"
                >
                  ← Collapse
                </button>
              </div>
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

            {/* Market implied relevance pill */}
            {marketImpliedRelevance !== null && (
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
      <div
        className={`relative bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-1000 ${
          isPanelOpenForThisPost
            ? 'ring-2 ring-[#B9D9EB]'
            : 'group-hover:ring-2 group-hover:ring-gray-600/50'
        }`}
      >
        <div className={`relative w-full transition-all duration-2000 ${
          post.post_type === 'video' || (post.post_type === 'image' && (post as any).image_display_mode === 'cover')
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
              {/* Market implied relevance pill (for posts without author above) */}
              {marketImpliedRelevance !== null && (
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
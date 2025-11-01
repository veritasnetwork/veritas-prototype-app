/**
 * PostDetailPage Component
 * Standalone post detail page with split-view layout
 * Left: Post content (title, author, media, full content)
 * Right: Trading interface (chart, swap, metrics)
 */

'use client';

import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';
import { getPostTitle, getPostPreview } from '@/types/post.types';
import { RichTextRenderer } from '@/components/common/RichTextRenderer';
import { usePoolData } from '@/hooks/usePoolData';
import { useTradeHistory } from '@/hooks/api/useTradeHistory';
import { formatRelativeTime } from '@/utils/formatters';
import type { Post } from '@/types/post.types';
import Image from 'next/image';
import { Volume2, VolumeX, Pause, Play, TrendingUp, BarChart3 } from 'lucide-react';
import { formatPoolDataFromDb } from '@/lib/solana/sqrt-price-helpers';
import { OnboardingModal } from '@/components/auth/OnboardingModal';

// Lazy load trading panel
const TradingPanel = lazy(() => import('@/components/post/TradingPanel').then(mod => ({ default: mod.TradingPanel })));

interface PostDetailPageClientProps {
  postId: string;
}

// Loading skeleton component for lazy-loaded cards
function LoadingCard({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl ${height} flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  );
}

export function PostDetailPageClient({ postId }: PostDetailPageClientProps) {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { needsOnboarding, isLoading: authLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [viewMode, setViewMode] = useState<'read' | 'trade'>('trade');
  const [isClosing, setIsClosing] = useState(false);

  // Load cached post and URL params on client-side only (after hydration)
  useEffect(() => {
    // Try to get cached post data from sessionStorage for instant loading
    const cached = sessionStorage.getItem(`post_${postId}`);
    if (cached) {
      try {
        const cachedPost = JSON.parse(cached);
        setPost(cachedPost);
        setLoading(false);
      } catch (e) {
        console.warn('Failed to parse cached post data');
      }
    }

    // Check URL params for mode override
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'trade' || modeParam === 'read') {
      setViewMode(modeParam);
    }
  }, [postId]);

  // Prepare initial pool data from post for instant rendering
  const initialPoolData = post?.poolAddress && post.poolPriceLong && post.poolPriceShort &&
    post.poolSupplyLong !== null && post.poolSupplyShort !== null ? {
    priceLong: post.poolPriceLong,
    priceShort: post.poolPriceShort,
    supplyLong: post.poolSupplyLong ?? 0,
    supplyShort: post.poolSupplyShort ?? 0,
    f: post.poolF || 1,
    betaNum: post.poolBetaNum || 1,
    betaDen: post.poolBetaDen || 2,
    vaultBalance: post.poolVaultBalance || 0,
    totalSupply: (post.poolSupplyLong || 0) + (post.poolSupplyShort || 0),
    currentPrice: 0,
    reserveBalance: post.poolVaultBalance || 0,
    marketCap: 0,
    rLong: post.poolSupplyLong ?? 0,
    rShort: post.poolSupplyShort ?? 0,
  } : undefined;

  // Fetch pool data only after post is available (either cached or loaded)
  const shouldFetchPoolData = post?.poolAddress;
  const { poolData, loading: poolLoading } = usePoolData(
    shouldFetchPoolData ? post.poolAddress : undefined,
    shouldFetchPoolData ? post.id : undefined,
    initialPoolData // Pass initial data for instant rendering
  );
  const { data: tradeHistory, isLoading: tradesLoading } = useTradeHistory(shouldFetchPoolData ? post.id : undefined);

  // Fetch post data (or refresh if already cached)
  useEffect(() => {
    const fetchPost = async () => {
      try {
        console.log('[PostDetailPage] Fetching post:', postId);
        console.log('[PostDetailPage] API URL:', `/api/posts/${postId}`);
        console.log('[PostDetailPage] Current origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR');

        // If we have cached data, don't show loading state but still refresh in background
        if (!post) {
          setLoading(true);
        }
        setError(null);

        const response = await fetch(`/api/posts/${postId}`);
        console.log('[PostDetailPage] Response status:', response.status);
        console.log('[PostDetailPage] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[PostDetailPage] Error response body:', errorText);

          if (response.status === 404) {
            console.error('[PostDetailPage] Post not found:', postId);
            setError('Post not found');
          } else {
            console.error('[PostDetailPage] Failed to load post:', response.status, response.statusText);
            setError(`Failed to load post (${response.status})`);
          }
          return;
        }

        const data = await response.json();
        console.log('[PostDetailPage] Post loaded successfully:', data.id);
        setPost(data);

        // Update cache with fresh data
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`post_${postId}`, JSON.stringify(data));
        }
      } catch (err) {
        console.error('[PostDetailPage] Error fetching post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]); // Only re-fetch when postId changes

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0f0f]">
        <div className="w-full px-6 py-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-8"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          <div className="max-w-5xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 w-64 bg-[#1a1a1a] rounded"></div>
              <div className="h-96 bg-[#1a1a1a] rounded-xl"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 bg-[#1a1a1a] rounded-xl"></div>
                <div className="h-64 bg-[#1a1a1a] rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <main className="min-h-screen bg-[#0f0f0f]">
        <div className="w-full px-6 py-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-8"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          <div className="max-w-lg mx-auto text-center py-16">
            <h2 className="text-xl font-bold text-white mb-4">
              {error || 'Post Not Found'}
            </h2>
            <p className="text-gray-400 mb-6">
              The post you're looking for doesn't exist or has been removed.
            </p>
            <button
              onClick={() => router.push('/feed')}
              className="px-6 py-3 bg-[#B9D9EB] text-[#0C1D51] rounded-xl font-medium hover:bg-[#B9D9EB]/90 transition-all duration-200 hover:scale-105"
            >
              Go to Feed
            </button>
          </div>
        </div>
      </main>
    );
  }

  const hasPool = !!post.poolAddress;
  const title = getPostTitle(post);

  // Calculate pool metrics from cached ICBS data (same as PostCard)
  const poolDataFromDb = post.poolSupplyLong !== undefined &&
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

  // Use market implied relevance from reserves (if available)
  const marketImpliedRelevance = (post as any).marketImpliedRelevance ??
    (poolData && poolData.rLong !== undefined && poolData.rShort !== undefined
      ? poolData.rLong / (poolData.rLong + poolData.rShort)
      : null);

  console.log('[PostDetailPage] Render state:', {
    postId: post.id,
    poolAddress: post.poolAddress,
    hasPool,
    poolData,
    poolLoading,
    viewMode,
    marketImpliedRelevance,
    totalVolumeUsdc: post.totalVolumeUsdc
  });

  const handleAuthorClick = () => {
    if (post.author?.username) {
      router.push(`/profile/${post.author.username}`);
    }
  };

  const handleViewModeChange = (mode: 'read' | 'trade') => {
    if (mode === 'read' && viewMode === 'trade') {
      // Start animation immediately - set closing first to keep panel visible
      setIsClosing(true);
      // Force animation frame to ensure immediate rendering
      requestAnimationFrame(() => {
        setViewMode(mode);
      });
      // Clean up after animation completes
      setTimeout(() => {
        setIsClosing(false);
      }, 1000);
    } else {
      // Switching to trade mode or already in read mode
      setViewMode(mode);
      setIsClosing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f0f0f]">
      <div className="w-full px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-6"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Animated Layout Container */}
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-6 relative">
            {/* LEFT COLUMN: Post Content - animates width */}
            <div className={`space-y-6 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              viewMode === 'trade' ? 'lg:w-1/2' : 'lg:w-full'
            } ${viewMode === 'read' ? 'lg:max-w-none' : ''}`}>
              {/* Post Header Card */}
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  {/* Author Info and Metrics */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleAuthorClick}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      {post.author?.avatar_url ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#B9D9EB] to-[#0C1D51]">
                          <Image
                            src={post.author.avatar_url}
                            alt={post.author.username}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B9D9EB] to-[#0C1D51] flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {post.author?.username?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-white font-medium">
                          {post.author?.display_name || post.author?.username}
                        </p>
                        <p className="text-gray-400 text-sm">@{post.author?.username}</p>
                      </div>
                    </button>

                    {/* Market implied relevance pill */}
                    {marketImpliedRelevance !== null && (
                      <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-[#B9D9EB] mr-1.5" />
                        <span className="font-semibold text-[#B9D9EB] text-sm">{(marketImpliedRelevance * 100).toFixed(1)}%</span>
                      </div>
                    )}

                    {/* Total volume pill */}
                    {post.totalVolumeUsdc !== undefined && post.totalVolumeUsdc > 0 && (
                      <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-gray-400 mr-1.5" />
                        <span className="font-semibold text-gray-300 text-sm">${post.totalVolumeUsdc >= 1000 ? (post.totalVolumeUsdc / 1000).toFixed(1) + 'k' : post.totalVolumeUsdc.toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#0f0f0f] rounded-lg p-0.5">
                    <button
                      onClick={() => handleViewModeChange('read')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'read'
                          ? 'bg-[#B9D9EB] text-[#0C1D51]'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Read
                    </button>
                    <button
                      onClick={() => handleViewModeChange('trade')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'trade'
                          ? 'bg-[#B9D9EB] text-[#0C1D51]'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Trade
                    </button>
                  </div>
                </div>

                {/* Post Title - only show for text posts with title or if there's an article_title */}
                {((post as any).title || post.article_title) && (
                  <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
                )}

                {/* Timestamp */}
                <p className="text-sm text-gray-400">
                  {formatRelativeTime(post.timestamp || (post as any).created_at)}
                </p>
              </div>

              {/* Media (if image/video post) */}
              {post.post_type === 'image' && post.media_urls && post.media_urls.length > 0 && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-1 gap-2 p-2">
                    {post.media_urls.map((url, index) => (
                      <div key={index} className="relative aspect-video rounded-lg overflow-hidden">
                        <Image
                          src={url}
                          alt={`Post image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  {post.caption && (
                    <div className="p-4 border-t border-[#2a2a2a]">
                      <p className="text-gray-300 text-sm">{post.caption}</p>
                    </div>
                  )}
                </div>
              )}

              {post.post_type === 'video' && post.media_urls && post.media_urls.length > 0 && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="p-2 relative">
                    <video
                      ref={videoRef}
                      src={post.media_urls.length > 1 ? post.media_urls[1] : post.media_urls[0]}
                      poster={post.media_urls.length > 1 ? post.media_urls[0] : undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full rounded-lg"
                    />
                    {/* Pause/Resume Toggle - Bottom Left */}
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          if (isPaused) {
                            videoRef.current.play();
                          } else {
                            videoRef.current.pause();
                          }
                          setIsPaused(!isPaused);
                        }
                      }}
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
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.muted = !isMuted;
                          setIsMuted(!isMuted);
                        }
                      }}
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
                  {post.caption && (
                    <div className="p-4 border-t border-[#2a2a2a]">
                      <p className="text-gray-300 text-sm">{post.caption}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Article/Blog Cover Image */}
              {((post.post_type === 'text' && post.cover_image_url) || ((post as any).cover_image)) && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="relative aspect-video">
                    <Image
                      src={post.cover_image_url || (post as any).cover_image}
                      alt="Cover image"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Post Content (text) */}
              {post.post_type === 'text' && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 overflow-hidden">
                  {post.content_json ? (
                    <div className={`prose prose-invert ${viewMode === 'read' ? 'max-w-none' : 'max-w-full'} break-words`}>
                      <RichTextRenderer content={post.content_json} />
                    </div>
                  ) : post.content_text ? (
                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                      {post.content_text}
                    </p>
                  ) : (
                    <p className="text-gray-500 italic">No content available</p>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Trading Interface - Only show in trade mode or when closing */}
            {(viewMode === 'trade' || isClosing) && (
              <div className={`lg:top-6 lg:w-1/2 ${
                isClosing ? 'lg:absolute lg:right-0 animate-[slideOutRightFade_1000ms_cubic-bezier(0.16,1,0.3,1)]' : 'lg:sticky lg:self-start animate-[slideInRight_1000ms_cubic-bezier(0.16,1,0.3,1)]'
              }`}>
                <Suspense fallback={<LoadingCard height="h-96" />}>
                  <TradingPanel
                    postId={post.id}
                    poolAddress={post.poolAddress}
                    poolData={poolData}
                    tradeStats={tradeHistory?.stats}
                    selectedSide={selectedSide}
                    onSideChange={setSelectedSide}
                    loadingPoolData={poolLoading}
                    initialPoolData={initialPoolData}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding Modal - Show if user needs onboarding */}
      {authenticated && needsOnboarding && !authLoading && (
        <OnboardingModal isOpen={true} />
      )}
    </main>
  );
}

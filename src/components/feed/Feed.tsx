'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useEagerWalletConnect } from '@/hooks/useEagerWalletConnect';
import { PostCard } from './PostCard';
import { usePosts } from '@/hooks/api/usePosts';
import { NavigationHeader } from '@/components/layout/NavigationHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { PostDetailContent } from '@/components/post/PostDetailPanel/PostDetailContent';
import { TradingChartCard } from '@/components/post/PostDetailPanel/TradingChartCard';
import { PoolMetricsCard } from '@/components/post/PostDetailPanel/PoolMetricsCard';
import { BeliefScoreCard } from '@/components/post/PostDetailPanel/BeliefScoreCard';
import { UnifiedSwapComponent } from '@/components/post/PostDetailPanel/UnifiedSwapComponent';
import { DeployPoolCard } from '@/components/post/PostDetailPanel/DeployPoolCard';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { usePoolData } from '@/hooks/usePoolData';
import { useTradeHistory } from '@/hooks/api/useTradeHistory';
import { PostsService } from '@/services/posts.service';
import type { Post } from '@/types/post.types';
import { poolDataService } from '@/services/PoolDataService';

const POLL_INTERVAL = 20000; // 20 seconds

export function Feed() {
  const { authenticated, ready, login, user: privyUser } = usePrivy();
  const { needsOnboarding, isLoading: authLoading } = useAuth();

  // Automatically attempt to reconnect previously linked wallets
  useEagerWalletConnect();

  // Initialize wallet hook early to trigger Privy wallet loading
  const { wallet: solanaWallet, isLoading: walletLoading } = useSolanaWallet();
  const { posts, loading, error, refetch, loadMore, hasMore, loadingMore, updatePost } = usePosts();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [isClosing, setIsClosing] = useState(false);
  const [viewMode, setViewMode] = useState<'read' | 'trade'>('trade');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectedPostIdRef = useRef<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const preloadedPostsRef = useRef<Set<string>>(new Set());
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityObserverRef = useRef<IntersectionObserver | null>(null);
  const poolSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Handle view mode changes
  const handleViewModeChange = (mode: 'read' | 'trade') => {
    setViewMode(mode);

    // Close detail panel when switching to read mode
    if (mode === 'read' && selectedPostId) {
      // Save the current selection before closing
      lastSelectedPostIdRef.current = selectedPostId;

      setIsClosing(true);
      setSelectedPostId(null);
      setTimeout(() => {
        setIsClosing(false);
      }, 1000);
    }

    // When switching to trade mode
    if (mode === 'trade') {
      // Restore the last selected post if available
      if (lastSelectedPostIdRef.current) {
        setSelectedPostId(lastSelectedPostIdRef.current);
        setIsClosing(false);
      }
      // Otherwise, auto-select the first post if no post is selected
      else if (!selectedPostId && posts.length > 0) {
        setSelectedPostId(posts[0].id);
        setIsClosing(false);
      }
    }
  };

  // Auto-select first post when in trade mode on initial load
  useEffect(() => {
    if (viewMode === 'trade' && !selectedPostId && posts.length > 0 && !loading) {
      setSelectedPostId(posts[0].id);
    }
  }, [posts, loading, viewMode, selectedPostId]);

  // Show auth popup if not authenticated OR no Solana wallet connected
  useEffect(() => {
    if (!ready) return;

    // Check both authentication AND Solana wallet connection
    const hasSolanaWallet = privyUser?.linkedAccounts?.some(
      (account: any) => account.type === 'wallet' && account.chainType === 'solana'
    );

    console.log('[Feed] Auth check:', {
      ready,
      authenticated,
      privyUser: !!privyUser,
      linkedAccounts: privyUser?.linkedAccounts?.length,
      hasSolanaWallet,
      solanaWallet: !!solanaWallet,
      walletLoading,
    });

    const needsAuth = !authenticated || !hasSolanaWallet;
    setShowAuthPopup(needsAuth);
  }, [ready, authenticated, privyUser, solanaWallet, walletLoading]);

  // Helper to subscribe/unsubscribe pool data based on visibility
  const subscribeToPool = useCallback((postId: string) => {
    // Skip if already subscribed
    if (poolSubscriptionsRef.current.has(postId)) return;

    const unsubscribe = poolDataService.subscribe(postId, () => {
      // No-op: just keeping cache warm with adaptive polling
    });
    poolSubscriptionsRef.current.set(postId, unsubscribe);
  }, []);

  const unsubscribeFromPool = useCallback((postId: string) => {
    const unsubscribe = poolSubscriptionsRef.current.get(postId);
    if (unsubscribe) {
      unsubscribe();
      poolSubscriptionsRef.current.delete(postId);
    }
  }, []);

  // Visibility observer: only poll for posts in viewport (or near it)
  useEffect(() => {
    if (loading || posts.length === 0) return;

    // Create visibility observer for efficient polling management
    visibilityObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute('data-post-id');
          const poolAddress = entry.target.getAttribute('data-pool-address');

          if (!postId || !poolAddress) return;

          if (entry.isIntersecting) {
            // Post is visible - subscribe to pool updates
            subscribeToPool(postId);
          } else {
            // Post left viewport - unsubscribe to save resources
            unsubscribeFromPool(postId);
          }
        });
      },
      {
        root: null,
        rootMargin: '400px', // Subscribe when within 400px of viewport (buffer for smooth scrolling)
        threshold: 0,
      }
    );

    return () => {
      if (visibilityObserverRef.current) {
        visibilityObserverRef.current.disconnect();
      }
      // Cleanup all subscriptions on unmount
      poolSubscriptionsRef.current.forEach(unsub => unsub());
      poolSubscriptionsRef.current.clear();
    };
  }, [posts, loading, subscribeToPool, unsubscribeFromPool]);

  // Prefetch relevance history for posts with pools (one-time, browser-cached)
  useEffect(() => {
    if (loading || posts.length === 0) return;

    // Clear any existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Wait 500ms after posts load before preloading (avoid blocking main thread)
    preloadTimeoutRef.current = setTimeout(() => {
      posts.forEach((post) => {
        // Skip if already preloaded or no pool
        if (preloadedPostsRef.current.has(post.id) || !post.poolAddress) return;

        // Mark as preloaded
        preloadedPostsRef.current.add(post.id);

        // Prefetch relevance history data (one-time fetch, cached by browser/SWR)
        fetch(`/api/posts/${post.id}/history?include=relevance`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null); // Silent fail, it's just a prefetch
      });
    }, 500);

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [posts, loading]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    // Don't set up observer if we're already loading or no more posts
    if (loading || loadingMore || !hasMore || !loadMoreTriggerRef.current) {
      return;
    }

    // Create intersection observer for infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // Only trigger if visible, not already loading, and has more posts
        if (entry.isIntersecting && !loadingMore && hasMore && !loading) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before reaching the trigger
        threshold: 0.1,
      }
    );

    // Observe the trigger element
    observer.observe(loadMoreTriggerRef.current);
    observerRef.current = observer;

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingMore, loading, loadMore, posts.length]); // Re-run when posts length changes

  // Polling for selected post metrics
  useEffect(() => {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Only poll if we have a selected post
    if (selectedPostId) {
      const pollSelectedPost = async () => {
        try {
          const metrics = await PostsService.fetchSinglePostMetrics(selectedPostId);
          if (metrics) {
            // Update in the feed list
            updatePost(selectedPostId, metrics);
          }
        } catch (err) {
          console.warn('[Feed] Polling error for selected post:', err);
        }
      };

      // Start polling
      pollIntervalRef.current = setInterval(pollSelectedPost, POLL_INTERVAL);
    }

    // Cleanup on unmount or when selection changes
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [selectedPostId, updatePost]);

  const handlePostClick = (postId: string) => {
    // In read mode, navigate to the post page in trade mode
    if (viewMode === 'read') {
      window.location.href = `/post/${postId}?mode=trade`;
      return;
    }

    // In trade mode, show the detail panel (no toggle - always show details)
    if (selectedPostId === postId) {
      // Clicking the same post in trade mode does nothing
      return;
    }

    // Select the new post
    setIsClosing(false);
    setSelectedPostId(postId);

    // Optionally refresh post data in background (stale-while-revalidate)
    fetch(`/api/posts/${postId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          // Update the feed list with fresh data
          updatePost(postId, data);
        }
      })
      .catch(err => console.warn('Background post refresh failed:', err));
  };

  // Always use the post from the feed list that matches selectedPostId
  // This ensures we're always showing the correct post data
  const currentPost = selectedPostId ? posts.find(p => p.id === selectedPostId) : null;

  // Fetch pool data from chain
  const { poolData } = usePoolData(currentPost?.poolAddress, selectedPostId ?? undefined);

  // Trade history for price change - only fetch if pool exists
  const shouldFetchTradeHistory = currentPost?.poolAddress ? (selectedPostId ?? undefined) : undefined;
  const { data: tradeHistory, refresh: refreshTradeHistory } = useTradeHistory(shouldFetchTradeHistory, '24H');

  // Refresh handler for after successful trades
  const handleTradeSuccess = async () => {
    // Refresh trade history (chart)
    if (refreshTradeHistory) {
      refreshTradeHistory();
    }

    // Refresh the selected post data
    if (selectedPostId) {
      try {
        const response = await fetch(`/api/posts/${selectedPostId}`);
        if (response.ok) {
          const updatedPost = await response.json();
          // Update the post in the feed list
          updatePost(selectedPostId, updatedPost);
        }
      } catch (error) {
        console.error('[Feed] Error refreshing post after trade:', error);
        // Fallback: refetch all posts
        await refetch();
      }
    }
  };

  // Wait for Privy to be ready before showing anything
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Modern circular loader */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#2a2a2a] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-[#B9D9EB] rounded-full animate-spin"></div>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm">Loading</span>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show auth popup first if needed (blocks everything)
  // IMPORTANT: Check auth BEFORE onboarding to prevent showing onboarding before wallet connection
  // Return early - don't render feed content until authenticated with wallet
  if (showAuthPopup) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 max-w-md mx-4 shadow-2xl">
          <div className="flex flex-col items-center gap-6 mb-6">
            <div className="flex items-center gap-3">
              <img
                src="/icons/logo.png"
                alt="Veritas Logo"
                className="w-10 h-10"
              />
              <h2 className="text-[#F0EAD6] text-2xl font-bold font-mono">VERITAS</h2>
            </div>
            <p className="text-gray-400 text-center text-sm">
              Connect your wallet to access the feed and start trading
            </p>

            <button
              onClick={() => login()}
              disabled={!ready}
              className="w-full bg-[#B9D9EB] hover:bg-[#0C1D51] text-[#0C1D51] hover:text-[#B9D9EB] border border-[#0C1D51] font-medium py-3 px-6 rounded-lg font-mono disabled:opacity-50 transition-all duration-300 ease-in-out"
            >
              CONNECT WALLET & SIGN IN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding modal ONLY if authenticated AND needs onboarding AND auth status loaded
  // This ensures user has connected wallet before seeing onboarding, and we've checked their profile
  if (authenticated && needsOnboarding && !authLoading) {
    return <OnboardingModal isOpen={true} />;
  }

  // Still loading auth status - show loading screen
  if (authenticated && authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Modern circular loader */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#2a2a2a] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-[#B9D9EB] rounded-full animate-spin"></div>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm">Loading</span>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Modern circular loader */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#2a2a2a] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-[#B9D9EB] rounded-full animate-spin"></div>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm">Loading</span>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Failed to Load Posts
            </h2>
            <p className="text-white opacity-70">
              We couldn&apos;t connect to load the latest posts. Please try refreshing the page.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#B9D9EB] text-[#0C1D51] rounded-xl font-medium hover:bg-[#B9D9EB]/90 transition-all duration-200 hover:scale-105"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] min-h-screen">
      {/* Mobile Header (shown on <1024px) */}
      <div className="lg:hidden">
        <NavigationHeader />
      </div>

      {/* Desktop Sidebar (shown on >=1024px) */}
      <Sidebar
        onCreatePost={() => setIsCreateModalOpen(true)}
        isCompact={viewMode === 'trade' && !!selectedPostId}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Main Content Area */}
      <div className={`min-h-screen bg-[#0f0f0f] pb-20 lg:pb-0 transition-[margin-left] duration-1000 ease-in-out ${viewMode === 'trade' && selectedPostId ? 'lg:ml-28' : 'lg:ml-64'}`}>
        <div className={`mx-auto py-8 bg-[#0f0f0f] transition-[max-width,padding] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${viewMode === 'trade' && selectedPostId ? 'lg:max-w-[1400px] lg:px-4' : 'max-w-[680px] px-6'}`}>
          <div className={`flex flex-col lg:flex-row bg-[#0f0f0f] ${viewMode === 'trade' && selectedPostId ? 'lg:gap-12' : ''} ${viewMode === 'trade' && selectedPostId ? 'lg:items-start lg:h-[calc(100vh-4rem)]' : ''}`}>
            {/* Posts Column */}
            <div className={`flex flex-col gap-8 w-full lg:w-[680px] lg:flex-shrink-0 bg-[#0f0f0f] ${viewMode === 'trade' && selectedPostId ? 'lg:h-full lg:overflow-y-auto scrollbar-hide lg:pb-8' : ''}`}>
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  data-post-id={post.id}
                  data-pool-address={post.poolAddress || ''}
                  ref={(el) => {
                    // Attach to visibility observer for posts with pools
                    if (el && post.poolAddress && visibilityObserverRef.current) {
                      visibilityObserverRef.current.observe(el);
                    }
                  }}
                >
                  <PostCard
                    post={post}
                    onPostClick={handlePostClick}
                    isSelected={selectedPostId === post.id}
                  />
                  {/* Trigger loading when scrolling past 3rd-to-last post */}
                  {hasMore && !loading && index === posts.length - 3 && (
                    <div ref={loadMoreTriggerRef} className="h-1" />
                  )}
                </div>
              ))}

              {/* Loading indicator at the end */}
              {loadingMore && (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-400">Loading more posts...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Detail Cards Column - appears on right side on desktop, modal on mobile */}
            {viewMode === 'trade' && (selectedPostId || isClosing) && (
              <div className={`hidden lg:block lg:min-w-[600px] lg:max-w-[600px] lg:h-full lg:overflow-y-auto scrollbar-hide bg-[#0f0f0f] ${isClosing ? 'animate-[slideOutRightFade_1000ms_cubic-bezier(0.16,1,0.3,1)]' : 'animate-[slideInRight_1000ms_cubic-bezier(0.16,1,0.3,1)]'}`}>
                <div className="space-y-4">
                  {/* Deploy Pool Card - Show if no pool exists */}
                  {!currentPost?.poolAddress && (
                    <DeployPoolCard
                      postId={selectedPostId}
                      onDeploySuccess={handleTradeSuccess}
                    />
                  )}

                  {/* Trading Chart Card - Show if pool exists */}
                  {currentPost?.poolAddress && (
                    <TradingChartCard postId={selectedPostId} />
                  )}

                  {/* Pool Metrics Card - Show if pool exists */}
                  {currentPost?.poolAddress && (
                    poolData ? (
                      <PoolMetricsCard
                        poolData={poolData}
                        stats={tradeHistory?.stats}
                        side={selectedSide}
                      />
                    ) : (
                      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
                        <div className="flex items-center justify-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-gray-400">Loading pool data...</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {/* Swap Card - Show if pool exists */}
                  {currentPost?.poolAddress && (
                    poolData ? (
                      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                        <UnifiedSwapComponent
                          poolAddress={currentPost.poolAddress}
                          postId={currentPost.id}
                          priceLong={poolData.priceLong}
                          priceShort={poolData.priceShort}
                          supplyLong={poolData.supplyLong}
                          supplyShort={poolData.supplyShort}
                          f={poolData.f}
                          betaNum={poolData.betaNum}
                          betaDen={poolData.betaDen}
                          selectedSide={selectedSide}
                          onSideChange={setSelectedSide}
                          onTradeSuccess={handleTradeSuccess}
                        />
                      </div>
                    ) : (
                      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
                        <div className="flex items-center justify-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-gray-400">Loading trading interface...</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Detail Modal (shown on <1024px when post selected) */}
      {selectedPostId && (
        <div className={`lg:hidden fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-y-auto ${isClosing ? 'animate-[slideOutRightFade_1000ms_cubic-bezier(0.16,1,0.3,1)]' : 'animate-[slideInRight_1000ms_cubic-bezier(0.16,1,0.3,1)]'}`}>
          <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-[#2a2a2a] px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">Trading Details</h2>
                <button
                  onClick={() => {
                    setSelectedPostId(null);
                  }}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 py-6 space-y-4">
              {/* Deploy Pool Card - Show if no pool exists */}
              {!currentPost?.poolAddress && (
                <DeployPoolCard
                  postId={selectedPostId}
                  onDeploySuccess={handleTradeSuccess}
                />
              )}

              {/* Trading Chart Card - Show if pool exists */}
              {currentPost?.poolAddress && (
                <TradingChartCard postId={selectedPostId} />
              )}

              {/* Pool Metrics Card - Show if pool exists */}
              {currentPost?.poolAddress && (
                poolData ? (
                  <PoolMetricsCard
                    poolData={poolData}
                    stats={tradeHistory?.stats}
                    side={selectedSide}
                  />
                ) : (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-400">Loading pool data...</span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Swap Card - Show if pool exists */}
              {currentPost?.poolAddress && (
                poolData ? (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                    <UnifiedSwapComponent
                      poolAddress={currentPost.poolAddress}
                      postId={currentPost.id}
                    priceLong={poolData.priceLong}
                    priceShort={poolData.priceShort}
                    supplyLong={poolData.supplyLong}
                    supplyShort={poolData.supplyShort}
                    f={poolData.f}
                    betaNum={poolData.betaNum}
                    betaDen={poolData.betaDen}
                    selectedSide={selectedSide}
                    onSideChange={setSelectedSide}
                    onTradeSuccess={handleTradeSuccess}
                  />
                </div>
                ) : (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-400">Loading trading interface...</span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation (shown on <1024px) */}
      <MobileNav onCreatePost={() => setIsCreateModalOpen(true)} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={refetch}
      />
    </div>
  );
}
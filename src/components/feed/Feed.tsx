'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PostCard } from './PostCard';
import { usePosts } from '@/hooks/api/usePosts';
import { NavigationHeader } from '@/components/layout/NavigationHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { TradingPanel } from '@/components/post/TradingPanel';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { HowItWorksModal } from '@/components/auth/HowItWorksModal';
import { PWAInstallPrompt, usePWAInstallPrompt } from '@/components/common/PWAInstallPrompt';
import { usePoolData } from '@/hooks/usePoolData';
import { useTradeHistory } from '@/hooks/api/useTradeHistory';
import { PostsService } from '@/services/posts.service';
import type { Post } from '@/types/post.types';
import { shouldNavigateToArticlePage } from '@/types/post.types';
import { poolDataService } from '@/services/PoolDataService';

export function Feed() {
  const router = useRouter();
  const { authenticated, ready, login, user: privyUser } = usePrivy();
  const { needsOnboarding, isLoading: authLoading } = useAuth();
  const { requireAuth } = useRequireAuth();
  const isMobile = useIsMobile();

  // Initialize wallet hook early to trigger Privy wallet loading
  const { wallet: solanaWallet, isLoading: walletLoading } = useSolanaWallet();
  const { posts, loading, error, refetch, loadMore, hasMore, loadingMore, updatePost } = usePosts();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHowItWorksModalOpen, setIsHowItWorksModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [isClosing, setIsClosing] = useState(false);

  // PWA install prompt (only on mobile, not in PWA)
  const { showPrompt: showPWAPrompt, closePrompt: closePWAPrompt, isPWA } = usePWAInstallPrompt();

  // Read view mode from URL params, default to 'read' on mobile, 'trade' on desktop
  const [viewMode, setViewMode] = useState<'read' | 'trade'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'trade' || mode === 'read') return mode;
    }
    // Default to 'read' initially - will be updated based on isMobile in useEffect
    return 'read';
  });

  // Set correct view mode based on device type after mount
  useEffect(() => {
    // Only set view mode if not explicitly set in URL params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (!mode) {
        // Default: 'read' on mobile, 'trade' on desktop
        setViewMode(isMobile ? 'read' : 'trade');
      }
    }
  }, [isMobile]);

  const lastSelectedPostIdRef = useRef<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const preloadedPostsRef = useRef<Set<string>>(new Set());
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityObserverRef = useRef<IntersectionObserver | null>(null);
  const poolSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Pull-to-refresh on mobile (disabled when modal or panel is open)
  const { isRefreshing, isPulling, indicatorRef } = usePullToRefresh({
    onRefresh: refetch,
    enabled: isMobile && !isCreateModalOpen && !selectedPostId,
  });

  // Prevent clicks during pull-to-refresh gesture
  const isInteractionBlocked = isPulling || isRefreshing;

  // Prevent body scroll when mobile panel is open
  useEffect(() => {
    if (isMobile && selectedPostId) {
      // Save current scroll position
      const scrollY = window.scrollY;

      // Disable body scroll completely
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.height = '100%';

      // Also disable on html element for extra safety
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.documentElement.style.touchAction = 'none';

      // Disable touch events on body to prevent any scroll
      const preventTouch = (e: TouchEvent) => {
        // Only prevent if not scrolling within the panel
        const target = e.target as HTMLElement;
        if (!target.closest('.overflow-y-auto')) {
          e.preventDefault();
        }
      };

      document.addEventListener('touchmove', preventTouch, { passive: false });

      return () => {
        // Get saved scroll position
        const scrollY = document.body.style.top;

        // Re-enable body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.height = '';

        document.documentElement.style.overflow = '';
        document.documentElement.style.overscrollBehavior = '';
        document.documentElement.style.touchAction = '';

        document.removeEventListener('touchmove', preventTouch);

        // Restore scroll position
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      };
    }
  }, [isMobile, selectedPostId]);

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
  }, [posts, loading, viewMode]); // Removed selectedPostId from deps to prevent infinite loop

  // Debug logging for posts
  useEffect(() => {
    console.log('[Feed] Posts updated:', {
      count: posts.length,
      loading,
      posts: posts.map(p => ({
        id: p.id.substring(0, 8),
        type: p.post_type,
        hasPool: !!p.poolAddress,
        author: p.author?.username
      }))
    });
  }, [posts, loading]);

  // Handle create post click - check auth first
  const handleCreatePost = async () => {
    const isAuthed = await requireAuth();
    if (isAuthed) {
      setIsCreateModalOpen(true);
    }
  };

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

  const handlePostClick = (postId: string) => {
    console.log('[Feed] handlePostClick called with:', postId, 'viewMode:', viewMode, 'isMobile:', isMobile);

    // Block clicks during pull-to-refresh
    if (isInteractionBlocked) {
      console.log('[Feed] Click blocked during pull-to-refresh');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) {
      console.warn('[Feed] Post not found:', postId);
      return;
    }

    // On mobile: Open slide-in panel
    if (isMobile) {
      console.log('[Feed] Mobile - opening slide-in panel for:', postId, 'current:', selectedPostId);
      // Always set, even if same post (in case panel was closed)
      setSelectedPostId(postId);
      return;
    }

    // Desktop behavior below this point

    // In read mode, navigate to the post page in trade mode
    if (viewMode === 'read') {
      console.log('[Feed] Read mode - navigating to:', `/post/${postId}?mode=trade`);
      router.push(`/post/${postId}?mode=trade`);
      return;
    }

    // In trade mode, show the detail panel (no toggle - always show details)
    if (selectedPostId === postId) {
      // Clicking the same post in trade mode does nothing
      console.log('[Feed] Same post already selected, ignoring');
      return;
    }

    // Select the new post
    console.log('[Feed] Selecting new post:', postId);
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
  // Memoize to prevent unnecessary re-renders
  const currentPost = useMemo(
    () => (selectedPostId ? posts.find(p => p.id === selectedPostId) : null),
    [selectedPostId, posts]
  );

  // Fetch pool data from chain
  const { poolData } = usePoolData(currentPost?.poolAddress, selectedPostId ?? undefined);

  // Trade history for price change - only fetch if pool exists
  // Memoize to prevent unnecessary hook re-renders
  const shouldFetchTradeHistory = useMemo(
    () => (currentPost?.poolAddress ? (selectedPostId ?? undefined) : undefined),
    [currentPost?.poolAddress, selectedPostId]
  );
  const { data: tradeHistory, refresh: refreshTradeHistory } = useTradeHistory(shouldFetchTradeHistory, '24H');

  // Refresh handler for after successful trades
  // Note: SWR mutate in useBuyTokens handles most refreshing
  // This just updates the post in the feed list to keep it in sync
  const handleTradeSuccess = async () => {
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

  // Show onboarding modal immediately if user needs onboarding (before loading posts)
  if (authenticated && needsOnboarding && !authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <OnboardingModal isOpen={true} />
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
              <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      {/* Pull-to-refresh indicator (mobile only) */}
      {isMobile && isPulling && (
        <div
          ref={indicatorRef}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
          style={{
            transform: 'translateY(0px)',
            opacity: 0,
          }}
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-full p-3 shadow-xl">
            <div
              className={`ptr-spinner w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar (shown on >=1024px) */}
      <Sidebar
        onCreatePost={handleCreatePost}
        isCompact={viewMode === 'trade' && !!selectedPostId}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onHowItWorks={() => setIsHowItWorksModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className={`min-h-screen bg-[#0f0f0f] pb-20 lg:pb-0 transition-[margin-left] duration-1000 ease-in-out ${viewMode === 'trade' && selectedPostId ? 'lg:ml-28' : 'lg:ml-64'}`}>
        <div className={`mx-auto pt-0 pb-8 lg:py-8 bg-[#0f0f0f] transition-[max-width,padding] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${viewMode === 'trade' && selectedPostId ? 'lg:max-w-[1400px] lg:px-4' : 'max-w-[750px] px-0 lg:px-6'}`}>
          <div className={`flex flex-col lg:flex-row bg-[#0f0f0f] ${viewMode === 'trade' && selectedPostId ? 'lg:gap-12' : ''} ${viewMode === 'trade' && selectedPostId ? 'lg:items-start lg:h-[calc(100vh-4rem)]' : ''}`}>
            {/* Posts Column */}
            <div className={`flex flex-col w-full lg:w-[680px] lg:flex-shrink-0 bg-[#0f0f0f] lg:gap-8 ${viewMode === 'trade' && selectedPostId ? 'lg:h-full lg:overflow-y-auto scrollbar-hide lg:pb-8' : ''}`}>
              {posts.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-400 mb-4">No posts yet</p>
                  <button
                    onClick={handleCreatePost}
                    className="px-6 py-3 bg-[#B9D9EB] text-[#0C1D51] rounded-xl font-medium hover:bg-[#B9D9EB]/90"
                  >
                    Create the first post
                  </button>
                </div>
              )}
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
                  className={`border-b border-[#2a2a2a] lg:border-0 py-4 lg:py-0 lg:mb-0 ${
                    // Full width for media posts and article posts with cover images on mobile
                    post.post_type === 'image' || post.post_type === 'video' || (post.post_type === 'text' && post.cover_image_url)
                      ? 'px-0 lg:px-0'
                      : 'px-4 lg:px-0'
                  }`}
                >
                  <PostCard
                    post={post}
                    onPostClick={handlePostClick}
                    isSelected={selectedPostId === post.id}
                    disabled={isInteractionBlocked}
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

            {/* Detail Cards Column - only render on desktop */}
            {!isMobile && viewMode === 'trade' && (selectedPostId || isClosing) && currentPost && (
              <div className={`lg:min-w-[600px] lg:max-w-[600px] lg:h-full lg:overflow-y-auto scrollbar-hide bg-[#0f0f0f] ${isClosing ? 'animate-[slideOutRightFade_1000ms_cubic-bezier(0.16,1,0.3,1)]' : 'animate-[slideInRight_1000ms_cubic-bezier(0.16,1,0.3,1)]'}`}>
                <TradingPanel
                  postId={currentPost.id}
                  poolAddress={currentPost.poolAddress}
                  poolData={poolData}
                  tradeStats={tradeHistory?.stats}
                  selectedSide={selectedSide}
                  onSideChange={setSelectedSide}
                  onTradeSuccess={handleTradeSuccess}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Slide-in Panel - only render on mobile */}
      {isMobile && selectedPostId && currentPost && (
        <>
          {/* Backdrop */}
          <div
            className="fixed bg-black/60 animate-[fadeIn_150ms_ease-out]"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1150,
            }}
            onClick={() => setSelectedPostId(null)}
          />

          {/* Panel - Slides from right, fullscreen - much faster animation */}
          <div
            className="fixed bg-[#0f0f0f] shadow-2xl animate-[slideInFromRight_150ms_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto overscroll-contain"
            style={{
              position: 'fixed',
              top: '0px',
              left: '0px',
              right: '0px',
              bottom: '0px',
              width: '100vw',
              height: '100vh',
              maxHeight: '100dvh',
              zIndex: 1200,
            }}
          >
            {/* Back button - sticky at top */}
            <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-[#2a2a2a]">
              <button
                onClick={() => setSelectedPostId(null)}
                className="flex items-center gap-2 px-4 py-4 text-[#B9D9EB] font-medium active:opacity-70 transition-opacity"
              >
                <span className="text-xl">←</span>
                <span>Back</span>
              </button>
            </div>

            {/* Trading Panel Content */}
            <div className="px-3 pb-8">
              <TradingPanel
                postId={currentPost.id}
                poolAddress={currentPost.poolAddress}
                poolData={poolData}
                tradeStats={tradeHistory?.stats}
                selectedSide={selectedSide}
                onSideChange={setSelectedSide}
                onTradeSuccess={handleTradeSuccess}
              />
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation (shown on <1024px) - Hidden when create modal or panel is open */}
      <MobileNav onCreatePost={handleCreatePost} isHidden={isCreateModalOpen || (isMobile && !!selectedPostId)} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={refetch}
      />

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksModalOpen}
        onClose={() => setIsHowItWorksModalOpen(false)}
      />

      {/* PWA Install Prompt (mobile only, not in PWA) */}
      {isMobile && showPWAPrompt && !isPWA && (
        <PWAInstallPrompt onClose={closePWAPrompt} />
      )}
    </div>
  );
}
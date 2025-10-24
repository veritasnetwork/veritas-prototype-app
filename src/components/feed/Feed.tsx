'use client';

import { useState, useEffect } from 'react';
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
import type { Post } from '@/types/post.types';

export function Feed() {
  const { authenticated, ready, login, user: privyUser } = usePrivy();
  const { needsOnboarding, isLoading: authLoading } = useAuth();

  // Automatically attempt to reconnect previously linked wallets
  useEagerWalletConnect();

  // Initialize wallet hook early to trigger Privy wallet loading
  const { wallet: solanaWallet, isLoading: walletLoading } = useSolanaWallet();
  const { posts, loading, error, refetch, loadMore, hasMore, loadingMore } = usePosts();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [isClosing, setIsClosing] = useState(false);

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

  const handlePostClick = (postId: string) => {
    if (selectedPostId === postId) {
      // Toggle: if clicking the same post, close it with animation
      setIsClosing(true);
      setTimeout(() => {
        setSelectedPostId(null);
        setSelectedPost(null);
        setIsClosing(false);
      }, 250); // Match animation duration
    } else {
      // Open new post: use cached data from feed immediately
      setIsClosing(false);
      const cachedPost = posts.find(p => p.id === postId);
      setSelectedPostId(postId);
      setSelectedPost(cachedPost || null);

      // Optionally refresh post data in background (stale-while-revalidate)
      if (cachedPost) {
        fetch(`/api/posts/${postId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && selectedPostId === postId) {
              setSelectedPost(data);
            }
          })
          .catch(err => console.warn('Background post refresh failed:', err));
      }
    }
  };

  // Fetch pool data from chain
  const { poolData } = usePoolData(selectedPost?.poolAddress, selectedPostId ?? undefined);

  // Trade history for price change - only fetch if pool exists
  const shouldFetchTradeHistory = selectedPost?.poolAddress ? (selectedPostId ?? undefined) : undefined;
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
          setSelectedPost(updatedPost);

          // Also update the post in the feed list
          const updatedPosts = posts.map(p => p.id === selectedPostId ? updatedPost : p);
          if (JSON.stringify(posts) !== JSON.stringify(updatedPosts)) {
            // Only trigger a full refetch if we need to update the list
            // This ensures the feed list also has the latest data
            await refetch();
          }
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
    <>
      {/* Mobile Header (shown on <1024px) */}
      <div className="lg:hidden">
        <NavigationHeader />
      </div>

      {/* Desktop Sidebar (shown on >=1024px) */}
      <Sidebar onCreatePost={() => setIsCreateModalOpen(true)} isCompact={!!selectedPostId || isClosing} />

      {/* Main Content Area */}
      <div className={`min-h-screen bg-[#0f0f0f] pb-20 lg:pb-0 transition-[margin-left] duration-300 ease-in-out ${selectedPostId || isClosing ? 'lg:ml-28' : 'lg:ml-64'}`}>
        <div className={`mx-auto py-8 ${selectedPostId ? 'lg:max-w-[1400px] lg:px-4' : 'max-w-[680px] px-6'}`}>
          <div className={`flex flex-col lg:flex-row ${selectedPostId ? 'lg:gap-12' : ''} ${selectedPostId ? 'lg:items-start lg:h-[calc(100vh-4rem)]' : ''}`}>
            {/* Posts Column */}
            <div className={`flex flex-col gap-8 ${selectedPostId ? (isClosing ? 'w-full lg:w-[680px] lg:flex-shrink-0 lg:h-full lg:overflow-y-auto scrollbar-hide animate-[slideOutRight_250ms_cubic-bezier(0.16,1,0.3,1)]' : 'w-full lg:w-[680px] lg:flex-shrink-0 lg:h-full lg:overflow-y-auto scrollbar-hide animate-[slideInLeft_250ms_cubic-bezier(0.16,1,0.3,1)]') : 'w-full'}`}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostClick={handlePostClick}
                  isSelected={selectedPostId === post.id}
                />
              ))}

              {/* Load More Button */}
              {hasMore && !loading && (
                <div className="flex justify-center mt-8">
                  <button onClick={loadMore} disabled={loadingMore}
                    className="px-8 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-[#B9D9EB] text-[#B9D9EB] rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </span>
                    ) : 'Load More Posts'}
                  </button>
                </div>
              )}
            </div>

            {/* Detail Cards Column - appears on right side on desktop, modal on mobile */}
            {selectedPostId && (
              <div className={`hidden lg:block flex-1 lg:h-full lg:overflow-y-auto scrollbar-hide ${isClosing ? 'animate-[slideOutRightFade_250ms_cubic-bezier(0.16,1,0.3,1)]' : 'animate-[slideInRight_250ms_cubic-bezier(0.16,1,0.3,1)]'}`}>
                <div className="space-y-4">
                  {/* Deploy Pool Card - Show if no pool exists */}
                  {!selectedPost?.poolAddress && (
                    <DeployPoolCard
                      postId={selectedPostId}
                      onDeploySuccess={handleTradeSuccess}
                    />
                  )}

                  {/* Trading Chart Card - Show if pool exists */}
                  {selectedPost?.poolAddress && (
                    <TradingChartCard postId={selectedPostId} />
                  )}

                  {/* Pool Metrics Card - Show if pool exists */}
                  {poolData && (
                    <PoolMetricsCard
                      poolData={poolData}
                      stats={tradeHistory?.stats}
                      side={selectedSide}
                    />
                  )}

                  {/* Swap Card - Show if pool exists */}
                  {selectedPost?.poolAddress && poolData && (
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                      <UnifiedSwapComponent
                        poolAddress={selectedPost.poolAddress}
                        postId={selectedPost.id}
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
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Detail Modal (shown on <1024px when post selected) */}
      {selectedPostId && (
        <div className={`lg:hidden fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-y-auto ${isClosing ? 'animate-[slideOutRightFade_250ms_cubic-bezier(0.16,1,0.3,1)]' : 'animate-[slideInRight_250ms_cubic-bezier(0.16,1,0.3,1)]'}`}>
          <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-[#2a2a2a] px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">Trading Details</h2>
                <button
                  onClick={() => {
                    setSelectedPostId(null);
                    setSelectedPost(null);
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
              {!selectedPost?.poolAddress && (
                <DeployPoolCard
                  postId={selectedPostId}
                  onDeploySuccess={handleTradeSuccess}
                />
              )}

              {/* Trading Chart Card - Show if pool exists */}
              {selectedPost?.poolAddress && (
                <TradingChartCard postId={selectedPostId} />
              )}

              {/* Pool Metrics Card - Show if pool exists */}
              {poolData && (
                <PoolMetricsCard
                  poolData={poolData}
                  stats={tradeHistory?.stats}
                  side={selectedSide}
                />
              )}

              {/* Swap Card - Show if pool exists */}
              {selectedPost?.poolAddress && poolData && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                  <UnifiedSwapComponent
                    poolAddress={selectedPost.poolAddress}
                    postId={selectedPost.id}
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
    </>
  );
}
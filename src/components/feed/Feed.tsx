'use client';

import { useState, useEffect } from 'react';
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
import { formatPoolData } from '@/lib/solana/bonding-curve';
import { useTradeHistory } from '@/hooks/api/useTradeHistory';
import type { Post } from '@/types/post.types';

export function Feed() {
  const { posts, loading, error, refetch } = usePosts();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const handlePostClick = (postId: string) => {
    console.log('🟢 Feed handlePostClick called', {
      postId,
      currentSelectedPostId: selectedPostId,
      willClose: selectedPostId === postId,
    });

    if (selectedPostId === postId) {
      // Toggle: if clicking the same post, close it
      setSelectedPostId(null);
      setSelectedPost(null);
    } else {
      // Open new post: use cached data from feed immediately
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

  // Calculate pool data
  const poolData = selectedPost?.poolTokenSupply !== undefined &&
                   selectedPost?.poolReserveBalance !== undefined &&
                   selectedPost?.poolKQuadratic !== undefined
    ? formatPoolData(selectedPost.poolTokenSupply, selectedPost.poolReserveBalance, selectedPost.poolKQuadratic)
    : null;

  // Trade history for price change
  const { data: tradeHistory, refresh: refreshTradeHistory } = useTradeHistory(selectedPostId || undefined, '24H');

  // Refresh handler for after successful trades
  const handleTradeSuccess = async () => {
    console.log('[Feed] Trade success - refreshing data');

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
      <Sidebar onCreatePost={() => setIsCreateModalOpen(true)} isCompact={!!selectedPostId} />

      {/* Main Content Area */}
      <div className={`min-h-screen bg-[#0f0f0f] pb-20 lg:pb-0 transition-all duration-300 ease-in-out ${selectedPostId ? 'lg:ml-28' : 'lg:ml-64'}`}>
        <div className={`mx-auto px-4 md:px-6 py-8 transition-all duration-300 ${selectedPostId ? 'max-w-[1400px]' : 'max-w-[680px]'}`}>
          <div className={`flex gap-6 ${selectedPostId ? 'items-start lg:h-[calc(100vh-4rem)]' : ''}`}>
            {/* Posts Column */}
            <div className={`flex flex-col gap-8 transition-all duration-300 ${selectedPostId ? 'w-[680px] flex-shrink-0 lg:h-full lg:overflow-y-auto lg:pr-4 lg:pl-1' : 'w-full'}`}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostClick={handlePostClick}
                  isSelected={selectedPostId === post.id}
                />
              ))}
            </div>

            {/* Detail Cards Column - appears on right side */}
            {selectedPostId && (
              <div className="flex-1 space-y-4 animate-fade-in lg:h-full lg:overflow-y-auto lg:pr-4">
                {/* Post Content Card (Optional - can show full post content here) */}
                {/* Uncomment if you want to show post content in the right column */}
                {/* <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg sticky top-8">
                  <PostDetailContent postId={selectedPostId} />
                </div> */}

                {/* Trading Chart Card */}
                {selectedPost?.poolAddress && (
                  <TradingChartCard postId={selectedPostId} />
                )}

                {/* Pool Metrics Card */}
                {poolData && (
                  <PoolMetricsCard
                    currentPrice={poolData.currentPrice}
                    marketCap={poolData.marketCap}
                    totalSupply={poolData.totalSupply}
                    reserveBalance={poolData.reserveBalance}
                    priceChangePercent24h={tradeHistory?.stats?.priceChangePercent24h}
                    totalVolume={tradeHistory?.stats?.totalVolume}
                  />
                )}

                {/* Swap Card */}
                {selectedPost?.poolAddress && poolData && (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                    <UnifiedSwapComponent
                      poolAddress={selectedPost.poolAddress}
                      postId={selectedPost.id}
                      currentPrice={poolData.currentPrice}
                      totalSupply={poolData.totalSupply}
                      reserveBalance={poolData.reserveBalance}
                      reserveBalanceRaw={selectedPost.poolReserveBalance}
                      kQuadratic={selectedPost.poolKQuadratic || 1}
                      onTradeSuccess={handleTradeSuccess}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
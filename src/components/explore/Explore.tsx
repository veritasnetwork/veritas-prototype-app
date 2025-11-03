'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Masonry from 'react-masonry-css';
import { PostCard } from '../feed/PostCard/PostCard';
import { usePosts } from '@/hooks/api/usePosts';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { HowItWorksModal } from '@/components/auth/HowItWorksModal';
import { PanelProvider, usePanel, PostDetailPanel } from '@/components/post/PostDetailPanel';
import { FEATURES } from '@/config/features';
import { cn } from '@/lib/utils';
import { FilterDropdown, type SortOption } from './FilterDropdown';

// Inner component that can use the panel context
function ExploreContent() {
  const router = useRouter();
  const { posts: rawPosts, loading, error, refetch, loadMore, hasMore, loadingMore } = usePosts();
  const { requireAuth } = useRequireAuth();
  const { authenticated } = usePrivy();
  const { needsOnboarding, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHowItWorksModalOpen, setIsHowItWorksModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const { openPost, isOpen } = FEATURES.POST_DETAIL_PANEL ? usePanel() : { openPost: () => {}, isOpen: false };
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  // Pull-to-refresh on mobile (disabled when modal or panel is open)
  const { isRefreshing, isPulling, indicatorRef } = usePullToRefresh({
    onRefresh: refetch,
    enabled: isMobile && !isCreateModalOpen && !isOpen,
  });

  // Sort posts based on selected option
  const posts = useMemo(() => {
    const sorted = [...rawPosts];
    switch (sortBy) {
      case 'volume':
        return sorted.sort((a, b) => (b.totalVolumeUsdc || 0) - (a.totalVolumeUsdc || 0));
      case 'relevant':
        return sorted.sort((a, b) => {
          const aRelevance = (a as any).marketImpliedRelevance ?? 0;
          const bRelevance = (b as any).marketImpliedRelevance ?? 0;
          return bRelevance - aRelevance;
        });
      case 'recent':
      default:
        return sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }, [rawPosts, sortBy]);

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
        rootMargin: '400px', // Start loading 400px before reaching the trigger
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

  // Handle post click - navigate to post detail page
  const handlePostClick = (postId: string) => {
    router.push(`/post/${postId}?mode=trade`);
  };

  // Handle create post click - check auth first
  const handleCreatePost = async () => {
    const isAuthed = await requireAuth();
    if (isAuthed) {
      setIsCreateModalOpen(true);
    }
  };

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
      <div className="min-h-screen bg-[#0f0f0f] lg:ml-64">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <div className="h-40 bg-gray-800"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
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
    <>
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
        customControl={<FilterDropdown currentSort={sortBy} onSortChange={setSortBy} />}
        onHowItWorks={() => setIsHowItWorksModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "min-h-screen bg-[#0f0f0f] lg:ml-64 pb-20 lg:pb-0",
        FEATURES.POST_DETAIL_PANEL && "panel-capable",
        FEATURES.POST_DETAIL_PANEL && isOpen && "panel-open"
      )}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-2">No posts yet</h2>
              <p className="text-gray-400 mb-6">Be the first to create a post!</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-400 transition-colors"
              >
                Create Post
              </button>
            </div>
          ) : (
            <>
              {/* Masonry/Pinterest-style layout using JavaScript for optimal packing */}
              <Masonry
                breakpointCols={{
                  default: 4,
                  1536: 4,  // 2xl
                  1280: 4,  // xl
                  1024: 4,  // lg
                  768: 2,   // md
                  640: 1    // sm
                }}
                className="flex -ml-6 w-auto"
                columnClassName="pl-6 bg-clip-padding"
              >
                {posts.map((post) => (
                  <div key={post.id} className="mb-6">
                    <PostCard
                      post={post}
                      onPostClick={handlePostClick}
                      compact={true}
                    />
                  </div>
                ))}
              </Masonry>

              {/* Infinite scroll trigger - hidden element that triggers loading when scrolled into view */}
              {hasMore && !loading && (
                <div ref={loadMoreTriggerRef} className="h-1 w-full" />
              )}
            </>
          )}

          {/* Loading indicator for infinite scroll */}
          {loadingMore && (
            <div className="flex justify-center mt-12 mb-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-400">Loading more posts...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation (shown on <1024px) */}
      <MobileNav
        onCreatePost={handleCreatePost}
        showFilters={true}
        currentSort={sortBy}
        onSortChange={setSortBy}
      />

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

      {/* Post Detail Panel (only renders if feature flag is on) */}
      {FEATURES.POST_DETAIL_PANEL && <PostDetailPanel />}
    </>
  );
}

// Main Explore component that wraps content with provider if needed
export function Explore() {
  if (FEATURES.POST_DETAIL_PANEL) {
    return (
      <PanelProvider>
        <ExploreContent />
      </PanelProvider>
    );
  }

  return <ExploreContent />;
}

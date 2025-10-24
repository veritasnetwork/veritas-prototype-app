'use client';

import { useState } from 'react';
import { PostCard } from '../feed/PostCard/PostCard';
import { usePosts } from '@/hooks/api/usePosts';
import { NavigationHeader } from '@/components/layout/NavigationHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { PanelProvider, usePanel, PostDetailPanel } from '@/components/post/PostDetailPanel';
import { FEATURES } from '@/config/features';
import { cn } from '@/lib/utils';

// Inner component that can use the panel context
function ExploreContent() {
  const { posts, loading, error, refetch, loadMore, hasMore, loadingMore } = usePosts();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { openPost, isOpen } = FEATURES.POST_DETAIL_PANEL ? usePanel() : { openPost: () => {}, isOpen: false };

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
      <Sidebar onCreatePost={() => setIsCreateModalOpen(true)} />

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PostCard
                    post={post}
                    onPostClick={FEATURES.POST_DETAIL_PANEL ? openPost : undefined}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && !loading && (
            <div className="flex justify-center mt-12">
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
      </div>

      {/* Mobile Bottom Navigation (shown on <1024px) */}
      <MobileNav onCreatePost={() => setIsCreateModalOpen(true)} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={refetch}
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

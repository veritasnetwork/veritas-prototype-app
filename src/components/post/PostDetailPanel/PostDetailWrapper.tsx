/**
 * PostDetailWrapper Component
 * Phase 4: Context-aware wrapper for PostDetailContent
 * Allows PostDetailContent to be used in both panel and full-page contexts
 */

'use client';

import { PostDetailContent } from './PostDetailContent';

interface PostDetailWrapperProps {
  postId: string;
}

/**
 * Wrapper component for full-page view
 * Provides a mock panel context to PostDetailContent
 */
export function PostDetailWrapper({ postId }: PostDetailWrapperProps) {
  // Create a mock panel context for full-page view
  const mockPanelProvider = {
    children: <PostDetailContent postId={postId} />
  };

  // Wrap with a div that mimics panel structure but for full page
  return (
    <div className="post-detail-fullpage">
      <MockPanelProvider>
        <PostDetailContent postId={postId} />
      </MockPanelProvider>
    </div>
  );
}

/**
 * Mock PanelProvider for full-page context
 */
function MockPanelProvider({ children }: { children: React.ReactNode }) {
  // Provide a mock context that satisfies usePanel but does nothing
  const mockContext = {
    isOpen: true,
    selectedPostId: null,
    openPost: () => {},
    closePanel: () => {
      // In full-page mode, "close" means go back
      window.history.back();
    },
    position: 'fullscreen' as const,
  };

  return (
    <div className="mock-panel-context">
      {children}
    </div>
  );
}
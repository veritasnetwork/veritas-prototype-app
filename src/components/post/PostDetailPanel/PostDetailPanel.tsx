/**
 * PostDetailPanel Component
 * Slide-out panel for post details (desktop) / fullscreen modal (mobile)
 * Phase 2: Full post content with pool metrics and trading
 */

'use client';

import { usePanel } from './PanelProvider';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/config/features';
import { PostDetailContent } from './PostDetailContent';

export function PostDetailPanel() {
  const { isOpen, selectedPostId, closePanel } = usePanel();

  if (!isOpen || !selectedPostId) return null;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden",
          FEATURES.PANEL_ANIMATIONS ? "transition-opacity duration-300" : "",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-gray-950 shadow-xl",
          "w-full lg:w-[700px] xl:w-[800px]",
          "overflow-hidden",
          FEATURES.PANEL_ANIMATIONS ? "panel-slide" : "",
          isOpen ? "panel-open" : ""
        )}
      >
        <PostDetailContent postId={selectedPostId} />
      </div>
    </>
  );
}
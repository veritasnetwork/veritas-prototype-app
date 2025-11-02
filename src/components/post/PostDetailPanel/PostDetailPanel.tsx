/**
 * PostDetailPanel Component
 * Slide-out panel for post details (desktop) / bottom sheet (mobile)
 * Phase 2: Full post content with pool metrics and trading
 */

'use client';

import { usePanel } from './PanelProvider';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/config/features';
import { PostDetailContent } from './PostDetailContent';
import { useState, useEffect, useRef } from 'react';

export function PostDetailPanel() {
  const { isOpen, selectedPostId, closePanel } = usePanel();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle touch gestures for swipe-to-close on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return; // Desktop only uses click to close
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || window.innerWidth >= 1024) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    // Only allow dragging down
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || window.innerWidth >= 1024) return;
    setIsDragging(false);

    // Close if dragged down more than 150px
    if (dragOffset > 150) {
      closePanel();
    }

    setDragOffset(0);
  };

  if (!isOpen || !selectedPostId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-40",
          "transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closePanel}
      />

      {/* Panel - Bottom sheet on mobile, side panel on desktop */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed z-50 bg-gray-950 shadow-2xl overflow-hidden",
          // Mobile: Bottom sheet that slides up
          "bottom-0 left-0 right-0 max-h-[90vh] rounded-t-3xl",
          "lg:inset-y-0 lg:bottom-auto lg:left-auto lg:right-0 lg:max-h-none lg:rounded-none",
          // Width
          "w-full lg:w-[700px] xl:w-[800px]",
          // Animations
          "transition-transform duration-300 ease-out",
          // Mobile: Slide up from bottom
          isOpen && !isDragging ? "translate-y-0" : "",
          !isOpen ? "translate-y-full lg:translate-y-0 lg:translate-x-full" : ""
        )}
        style={{
          transform: isDragging && dragOffset > 0
            ? `translateY(${dragOffset}px)`
            : undefined,
        }}
      >
        {/* Drag handle for mobile */}
        <div className="lg:hidden flex justify-center py-3 border-b border-gray-800 bg-gray-900">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        <PostDetailContent postId={selectedPostId} />
      </div>
    </>
  );
}
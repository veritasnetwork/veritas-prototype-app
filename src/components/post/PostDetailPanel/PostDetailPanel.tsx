/**
 * PostDetailPanel Component
 * Slide-in panel from right with native mobile feel
 * Phase 2: Full post content with pool metrics and trading
 */

'use client';

import { usePanel } from './PanelProvider';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/config/features';
import { PostDetailContent } from './PostDetailContent';
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';

export function PostDetailPanel() {
  const { isOpen, selectedPostId, closePanel } = usePanel();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle swipe-back gesture on mobile (swipe right to close)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return; // Desktop only uses click to close
    startX.current = e.touches[0].clientX;

    // Only enable drag if starting from the left edge (first 50px)
    if (startX.current < 50) {
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || window.innerWidth >= 1024) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;

    // Only allow dragging right (positive diff)
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || window.innerWidth >= 1024) return;
    setIsDragging(false);

    // Close if dragged right more than 100px
    if (dragOffset > 100) {
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
          "transition-opacity duration-300 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closePanel}
      />

      {/* Panel - Slides from right on all screen sizes, fullscreen on mobile */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-gray-950 shadow-2xl overflow-hidden",
          // Width: Fullscreen on mobile, fixed width on desktop
          "w-full lg:w-[700px] xl:w-[800px]",
          // Animations - slide from right
          "transition-transform duration-300 ease-out",
          isOpen && !isDragging ? "translate-x-0" : "",
          !isOpen ? "translate-x-full" : ""
        )}
        style={{
          transform: isDragging && dragOffset > 0
            ? `translateX(${dragOffset}px)`
            : undefined,
        }}
      >
        {/* Back button - Mobile only, top-left */}
        <div className="lg:hidden sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
          <button
            onClick={closePanel}
            className="flex items-center gap-2 px-4 py-4 text-[#B9D9EB] font-medium active:opacity-70 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
            <span>Back</span>
          </button>
        </div>

        <PostDetailContent postId={selectedPostId} />
      </div>
    </>
  );
}
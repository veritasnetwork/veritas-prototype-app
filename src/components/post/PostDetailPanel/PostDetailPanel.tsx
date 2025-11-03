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

  // Prevent body scroll and pull-to-refresh when panel is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;

      // Disable body scroll completely
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';

      // Disable pull-to-refresh
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
    } else {
      // Get the saved scroll position
      const scrollY = document.body.style.top;

      // Re-enable body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';

      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isOpen]);

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
          "fixed bg-black/60",
          "transition-opacity duration-300 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{
          position: 'fixed',
          top: '0px',
          left: '0px',
          right: '0px',
          bottom: '0px',
          zIndex: 9998,
        }}
        onClick={closePanel}
      />

      {/* Panel - Slides from right on all screen sizes, fullscreen on mobile */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed z-50 bg-gray-950 shadow-2xl",
          // Width: Fullscreen on mobile, fixed width + offset on desktop
          "lg:left-auto lg:w-[700px] xl:w-[800px]",
          // Enable internal scrolling and disable overscroll
          "overflow-y-auto overscroll-contain",
          // Animations - slide from right
          "transition-transform duration-300 ease-out",
          isOpen && !isDragging ? "translate-x-0" : "",
          !isOpen ? "translate-x-full" : ""
        )}
        style={{
          position: 'fixed',
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px',
          height: '100dvh',
          maxHeight: '100dvh',
          transform: isDragging && dragOffset > 0
            ? `translateX(${dragOffset}px)`
            : undefined,
          // Prevent scroll leaking to background
          touchAction: 'pan-y', // Allow vertical scroll only
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          zIndex: 9999, // Ensure it's above everything
        }}
      >
        {/* Back button - Mobile only, sticky at top */}
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
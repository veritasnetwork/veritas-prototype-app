'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { FEATURES } from '@/config/features';

interface PanelContextValue {
  isOpen: boolean;
  selectedPostId: string | null;
  openPost: (postId: string) => void;
  closePanel: () => void;
  position: 'right' | 'fullscreen';
}

const PanelContext = createContext<PanelContextValue | null>(null);

function PanelProviderInner({ children }: { children: ReactNode }) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Determine if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768; // md breakpoint
      setIsMobileView(hasTouch && isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const position = isMobileView ? 'fullscreen' : 'right';

  const openPost = useCallback((isMobile: boolean) => (postId: string) => {
    setSelectedPostId(postId);
    setIsOpen(true);

    // Prevent body scroll when panel is open on mobile
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const openPostCallback = useCallback((postId: string) => {
    openPost(isMobileView)(postId);
  }, [isMobileView, openPost]);

  const closePanel = useCallback(() => {
    setIsOpen(false);

    // Re-enable body scroll
    document.body.style.overflow = '';

    // Clear post ID after animation completes
    setTimeout(() => setSelectedPostId(null), 300);
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, closePanel]);

  return (
    <PanelContext.Provider value={{ isOpen, selectedPostId, openPost: openPostCallback, closePanel, position }}>
      {children}
    </PanelContext.Provider>
  );
}

export function PanelProvider({ children }: { children: ReactNode }) {
  // Only active if feature flag is on
  if (!FEATURES.POST_DETAIL_PANEL) {
    return <>{children}</>;
  }

  return <PanelProviderInner>{children}</PanelProviderInner>;
}

export const usePanel = () => {
  const context = useContext(PanelContext);

  // Return dummy functions if feature is off OR context is missing (full-page mode)
  if (!context) {
    return {
      isOpen: false,
      selectedPostId: null,
      openPost: () => {},
      closePanel: () => {
        // In full-page mode, "close" means go back
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      },
      position: 'right' as const,
    };
  }

  return context;
};
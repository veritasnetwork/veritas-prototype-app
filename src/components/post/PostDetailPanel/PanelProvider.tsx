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

export function PanelProvider({ children }: { children: ReactNode }) {
  // Only active if feature flag is on
  if (!FEATURES.POST_DETAIL_PANEL) {
    return <>{children}</>;
  }

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'right' | 'fullscreen'>('right');

  // Update position on resize
  useEffect(() => {
    const updatePosition = () => {
      setPosition(window.innerWidth < 1024 ? 'fullscreen' : 'right');
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const openPost = useCallback((postId: string) => {
    console.log('[PANEL] Opening post:', postId);
    setSelectedPostId(postId);
    setIsOpen(true);

    // Prevent body scroll when panel is open on mobile
    if (window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const closePanel = useCallback(() => {
    console.log('[PANEL] Closing panel');
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
    <PanelContext.Provider value={{ isOpen, selectedPostId, openPost, closePanel, position }}>
      {children}
    </PanelContext.Provider>
  );
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
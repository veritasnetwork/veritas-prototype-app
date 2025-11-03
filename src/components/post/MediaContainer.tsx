'use client';

import { ReactNode } from 'react';
import { getMediaDisplayMode } from '@/lib/utils/media';
import { useIsMobile } from '@/hooks/useIsMobile';

interface MediaContainerProps {
  aspectRatio?: number | null;
  children: ReactNode;
  className?: string;
}

export function MediaContainer({ aspectRatio, children, className = '' }: MediaContainerProps) {
  const isMobile = useIsMobile();

  // Default to 16:9 if no aspect ratio provided
  const ratio = aspectRatio || (16 / 9);
  const displayMode = getMediaDisplayMode(ratio);

  // Different max-height for mobile vs desktop
  const maxHeight = isMobile ? '85vh' : '90vh';

  // For native display mode, let media determine height naturally
  if (displayMode === 'native') {
    return (
      <div
        className={`w-full ${className}`}
        style={{ maxHeight }}
      >
        {children}
      </div>
    );
  }

  // For letterbox/pillarbox (extreme aspect ratios), add black background and containment
  return (
    <div
      className={`w-full flex items-center justify-center bg-black ${className}`}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}

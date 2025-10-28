/**
 * Video Priority Hook
 * Manages which videos should play based on proximity to viewport center
 * Limits to 2-3 videos playing simultaneously for performance
 */

import { useEffect, useRef, useState } from 'react';

const MAX_PLAYING_VIDEOS = 3;

interface VideoEntry {
  id: string;
  element: HTMLVideoElement;
  container: HTMLElement;
  distanceFromCenter: number;
  userPaused: boolean; // Track if user manually paused
  isHovered: boolean; // Track if user is hovering
}

class VideoPriorityManager {
  private videos: Map<string, VideoEntry> = new Map();
  private playingVideos: Set<string> = new Set();
  private rafId: number | null = null;

  register(id: string, videoElement: HTMLVideoElement, container: HTMLElement) {
    this.videos.set(id, {
      id,
      element: videoElement,
      container,
      distanceFromCenter: Infinity,
      userPaused: false,
      isHovered: false,
    });
    this.scheduleUpdate();
  }

  setUserPaused(id: string, paused: boolean) {
    const entry = this.videos.get(id);
    if (entry) {
      entry.userPaused = paused;
      if (paused) {
        entry.element.pause();
        this.playingVideos.delete(id);
      } else {
        this.scheduleUpdate();
      }
    }
  }

  setHovered(id: string, hovered: boolean) {
    const entry = this.videos.get(id);
    if (entry) {
      entry.isHovered = hovered;
      this.scheduleUpdate();
    }
  }

  unregister(id: string) {
    this.videos.delete(id);
    this.playingVideos.delete(id);
    this.scheduleUpdate();
  }

  private scheduleUpdate() {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.updatePriorities();
      this.rafId = null;
    });
  }

  private updatePriorities() {
    const viewportCenterY = window.innerHeight / 2;
    const entries: VideoEntry[] = [];

    // Calculate distance from center for each video
    this.videos.forEach((entry) => {
      const rect = entry.container.getBoundingClientRect();
      const elementCenterY = rect.top + rect.height / 2;
      const distanceFromCenter = Math.abs(viewportCenterY - elementCenterY);

      // Check if in viewport
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        entry.distanceFromCenter = distanceFromCenter;
        entries.push(entry);
      }
    });

    // Separate hovered videos (they get priority)
    const hoveredEntries = entries.filter(e => e.isHovered);
    const nonHoveredEntries = entries.filter(e => !e.isHovered);

    // Sort by distance from center (closest first)
    nonHoveredEntries.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);

    // Hovered videos always play, plus top N non-hovered videos
    const shouldPlay = new Set([
      ...hoveredEntries.map(e => e.id),
      ...nonHoveredEntries.slice(0, MAX_PLAYING_VIDEOS).map((e) => e.id)
    ]);

    // Update playing state
    this.videos.forEach((entry) => {
      // Skip if user manually paused this video
      if (entry.userPaused) return;

      const shouldBePlaying = shouldPlay.has(entry.id);
      const isPlaying = this.playingVideos.has(entry.id);

      if (shouldBePlaying && !isPlaying) {
        // Start playing
        entry.element.play().catch(() => {
          // Autoplay failed - browser policy
        });
        this.playingVideos.add(entry.id);
      } else if (!shouldBePlaying && isPlaying) {
        // Stop playing
        entry.element.pause();
        this.playingVideos.delete(entry.id);
      }
    });
  }

  handleScroll = () => {
    this.scheduleUpdate();
  };

  cleanup() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.videos.clear();
    this.playingVideos.clear();
  }
}

// Singleton instance
const videoPriorityManager = new VideoPriorityManager();

// Setup global scroll listener
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', videoPriorityManager.handleScroll, { passive: true });
}

/**
 * Hook to register a video with the priority manager
 */
export function useVideoPriority(
  videoRef: React.RefObject<HTMLVideoElement>,
  containerRef: React.RefObject<HTMLElement>,
  postId: string,
  enabled: boolean = true
) {
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (!enabled || !videoRef.current || !containerRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    const containerElement = containerRef.current;

    // Register with priority manager
    videoPriorityManager.register(postId, videoElement, containerElement);
    setIsRegistered(true);

    return () => {
      videoPriorityManager.unregister(postId);
      setIsRegistered(false);
    };
  }, [videoRef, containerRef, postId, enabled]);

  const setUserPaused = (paused: boolean) => {
    videoPriorityManager.setUserPaused(postId, paused);
  };

  const setHovered = (hovered: boolean) => {
    videoPriorityManager.setHovered(postId, hovered);
  };

  return { isRegistered, setUserPaused, setHovered };
}

export { videoPriorityManager };

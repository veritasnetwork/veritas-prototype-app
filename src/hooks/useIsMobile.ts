import { useEffect, useState } from 'react';

/**
 * Hook to detect if the user is on a mobile device
 * Uses both touch capability and screen width for accurate detection
 *
 * @returns {boolean} true if mobile device detected
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // Check for touch capability
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Check screen width (Tailwind 'md' breakpoint is 768px)
      const isSmallScreen = window.innerWidth < 768;

      // Consider it mobile if it has touch AND small screen
      // This avoids treating desktop touch screens as mobile
      setIsMobile(hasTouch && isSmallScreen);
    };

    checkIsMobile();

    // Re-check on resize (for orientation changes, etc)
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}

/**
 * Hook to detect if the device has touch capability
 * Useful for showing touch-optimized UI elements
 *
 * @returns {boolean} true if touch-capable device
 */
export function useHasTouch(): boolean {
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    setHasTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return hasTouch;
}

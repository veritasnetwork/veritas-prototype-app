import { useState, useEffect } from 'react';

interface ScrollDirectionReturn {
  scrollDirection: 'up' | 'down' | 'idle';
  isVisible: boolean;
  scrollY: number;
}

export const useScrollDirection = (threshold: number = 5): ScrollDirectionReturn => {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'idle'>('idle');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const direction = currentScrollY > lastScrollY ? 'down' : 'up';
      
      // Only update if scroll is significant (more than threshold)
      if (Math.abs(currentScrollY - lastScrollY) > threshold) {
        setScrollDirection(direction);
        
        // Hide nav when scrolling down past 100px, show when scrolling up or at top
        if (direction === 'down' && currentScrollY > 100) {
          setIsVisible(false);
        } else if (direction === 'up' || currentScrollY < 50) {
          setIsVisible(true);
        }
      }
      
      setLastScrollY(currentScrollY);
    };

    // Add passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, threshold]);

  return { 
    scrollDirection, 
    isVisible, 
    scrollY: lastScrollY 
  };
};
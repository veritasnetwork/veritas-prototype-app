'use client';

import { useState, useEffect } from 'react';

export function useSafeTheme() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toggleTheme, setToggleTheme] = useState<(() => void) | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    
    // Dynamically import and use the theme hook only on client side
    const setupTheme = async () => {
      try {
        await import('@/providers/ThemeProvider');
        // We can't use the hook here, so we'll manage theme state manually
        // Check localStorage for saved theme
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
        if (savedTheme) {
          setTheme(savedTheme);
        }
        
        // Create toggle function
        const toggle = () => {
          const newTheme = theme === 'dark' ? 'light' : 'dark';
          setTheme(newTheme);
          localStorage.setItem('theme', newTheme);
          
          // Update document class
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(newTheme);
        };
        
        setToggleTheme(() => toggle);
        
        // Apply initial theme
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        
      } catch {
        console.warn('Could not setup theme');
      }
    };
    
    setupTheme();
  }, [theme]);

  return { mounted, theme, toggleTheme };
}
'use client';

import { useState, useEffect } from 'react';

export function useSafeTheme() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setMounted(true);

    // Check localStorage for saved theme
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      // Apply saved theme
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(savedTheme);
    } else {
      // Apply default theme
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Update document class
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
  };

  return { mounted, theme, toggleTheme };
}
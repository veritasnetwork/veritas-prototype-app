'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search,
  Sliders,
  ChevronRight,
  Menu,
  X,
  Edit,
  Sun,
  Moon
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSafeTheme } from '@/hooks/useSafeTheme';

export function Sidebar() {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showAlgorithmPanel, setShowAlgorithmPanel] = useState(false);
  const pathname = usePathname();
  const { mounted, theme, toggleTheme } = useSafeTheme();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAlgorithmPanel && !(e.target as Element).closest('.algorithm-panel')) {
        setShowAlgorithmPanel(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAlgorithmPanel]);

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop Sidebar - Floating */}
      <aside className="hidden lg:flex flex-col fixed left-6 top-6 bottom-6 w-16 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-lg dark:shadow-none">
        <div className="flex flex-col items-center p-3 h-full">
          {/* Logo */}
          <Link href="/" className="mb-6 hover:scale-110 transition-transform">
            <img 
              src="/icons/logo.png" 
              alt="Veritas" 
              className="h-10 w-10"
            />
          </Link>

          {/* Action buttons */}
          <div className="flex-1 flex flex-col items-center space-y-3">
            {/* Search */}
            <button className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all">
              <Search className="w-5 h-5" />
            </button>

            {/* Algorithm Selector */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowAlgorithmPanel(!showAlgorithmPanel);
              }}
              className={`relative p-2.5 rounded-xl transition-all ${
                showAlgorithmPanel 
                  ? 'bg-veritas-light-blue/20 text-veritas-light-blue' 
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <Sliders className="w-5 h-5" />
              {/* Small indicator dot */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-veritas-light-blue rounded-full"></span>
            </button>

            {/* Write button */}
            <button className="p-2.5 bg-veritas-light-blue rounded-full hover:bg-veritas-light-blue/90 transition-all">
              <Edit className="w-5 h-5 text-veritas-dark-blue" />
            </button>
          </div>

          {/* Theme Toggle at bottom */}
          <button 
            onClick={toggleTheme}
            className="mt-auto p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Algorithm Panel - Floating */}
      {showAlgorithmPanel && (
        <div className="algorithm-panel hidden lg:block fixed left-28 top-20 w-72 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl dark:shadow-none p-5 z-50">
          <h3 className="font-semibold text-lg text-black dark:text-white mb-4">Algorithm Settings</h3>
          
          <div className="space-y-4">
            <div className="p-3 bg-veritas-light-blue/10 border border-veritas-light-blue/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black dark:text-white">
                  Balanced Discovery
                </span>
                <ChevronRight className="w-4 h-4 text-veritas-light-blue" />
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                4 active signals • Optimized for diverse content
              </span>
            </div>

            <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-veritas-light-blue/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black dark:text-white">
                  Truth Seeking
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Prioritize factual accuracy
              </span>
            </div>

            <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-veritas-light-blue/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black dark:text-white">
                  Trending Now
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Focus on viral content
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed inset-0 z-40 transition-opacity ${showMobileSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileSidebar(false)} />
        <aside className={`absolute left-4 top-4 bottom-4 w-20 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl transition-transform ${showMobileSidebar ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'}`}>
          <div className="flex flex-col items-center p-3 h-full">
            {/* Close button */}
            <button onClick={() => setShowMobileSidebar(false)} className="mb-4 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all">
              <X className="w-5 h-5" />
            </button>
            
            {/* Logo */}
            <Link href="/" className="mb-6" onClick={() => setShowMobileSidebar(false)}>
              <img 
                src="/icons/logo.png" 
                alt="Veritas" 
                className="h-10 w-10"
              />
            </Link>

            {/* Action buttons */}
            <div className="flex-1 flex flex-col items-center space-y-3">
              {/* Search */}
              <button className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all" onClick={() => setShowMobileSidebar(false)}>
                <Search className="w-5 h-5" />
              </button>

              {/* Algorithm Selector */}
              <button className="relative p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all" onClick={() => setShowMobileSidebar(false)}>
                <Sliders className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-veritas-light-blue rounded-full"></span>
              </button>

              {/* Write button */}
              <button className="p-2.5 bg-veritas-light-blue rounded-full hover:bg-veritas-light-blue/90 transition-all" onClick={() => setShowMobileSidebar(false)}>
                <Edit className="w-5 h-5 text-veritas-dark-blue" />
              </button>
            </div>

            {/* Theme Toggle at bottom */}
            <button 
              onClick={toggleTheme}
              className="mt-auto p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
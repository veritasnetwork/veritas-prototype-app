'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  Sparkles, 
  Home,
  Search,
  Sliders,
  ChevronRight,
  Menu,
  X,
  Edit,
  Sun,
  Moon
} from 'lucide-react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useTheme } from '@/providers/ThemeProvider';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const pathname = usePathname();
  const { isVisible } = useScrollDirection();
  let theme: 'dark' | 'light' = 'dark';
  let toggleTheme: (() => void) | undefined = undefined;
  
  // Only use theme hook if mounted (client side)
  if (mounted) {
    const themeContext = useTheme();
    theme = themeContext.theme;
    toggleTheme = themeContext.toggleTheme;
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 100;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems: { href: string; label: string; icon: any }[] = [];

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Desktop Navbar with Veritas glassmorphism */}
      {!isMobile && (
        <nav 
          className={`fixed z-50 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible
              ? 'top-6 left-6 right-6'
              : 'top-6 left-6 right-6 -translate-y-[120%]'
          }`}
          style={{
            transformOrigin: 'center top',
            transform: isVisible 
              ? 'scale(1)' 
              : 'scale(0.95) translateY(-120%)'
          }}
        >
          <div className="relative max-w-[1200px] mx-auto">
            
            <div className="relative bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-3xl shadow-lg dark:shadow-none">
              {/* Inner highlights */}
              <div className="absolute inset-0 rounded-3xl border border-neutral-100 dark:border-neutral-800 pointer-events-none"></div>
              
              <div className="relative">
                {/* Main nav bar */}
                <div className="flex items-center justify-between px-8 py-4">
                  {/* Logo */}
                  <Link href="/" className="flex items-center space-x-3 group">
                    <img 
                      src="/icons/logo.png" 
                      alt="Veritas" 
                      className="h-10 w-10"
                    />
                    <span className="text-xl font-semibold text-black dark:text-white font-sans tracking-tight">
                      Veritas
                    </span>
                  </Link>

                  {/* Center nav items */}
                  <div className="flex items-center space-x-1">
                    {navItems.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={clsx(
                          'group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 font-sans',
                          pathname === href
                            ? 'text-black dark:text-white bg-veritas-light-blue/20'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        )}
                      >
                        <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center space-x-3">
                    {/* Search */}
                    <button className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all">
                      <Search className="w-5 h-5" />
                    </button>
                    
                    {/* Theme Toggle */}
                    <button 
                      onClick={toggleTheme}
                      className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
                    >
                      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    
                    {/* Write button */}
                    <button className="p-2 bg-veritas-light-blue rounded-full hover:bg-veritas-light-blue/90 transition-all duration-300 group">
                      <Edit className="w-5 h-5 text-veritas-dark-blue group-hover:rotate-12 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Algorithm Bar */}
                <div className="border-t border-neutral-200 dark:border-neutral-800">
                  <div className="px-8 py-4">
                    <div 
                      className="group flex items-center justify-between p-3 bg-white dark:bg-neutral-800 backdrop-blur-lg rounded-2xl border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-veritas-light-blue/30 transition-all duration-300"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-lg">
                          <Sliders className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-black dark:text-white font-sans">
                            Balanced Discovery
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                            4 active signals
                          </span>
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-veritas-light-blue group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Navbar */}
      {isMobile && (
        <nav 
          className={`md:hidden fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
            isVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border-b border-neutral-200 dark:border-neutral-700 shadow-lg dark:shadow-none">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                  <img 
                    src="/icons/logo.png" 
                    alt="Veritas" 
                    className="h-8 w-8"
                  />
                  <span className="text-lg font-semibold text-black dark:text-white font-sans">Veritas</span>
                </Link>
                
                <div className="flex items-center space-x-3">
                  <button className="p-2 text-neutral-600 dark:text-neutral-400">
                    <Search className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={themeToggle || undefined}
                    className="p-2 text-neutral-600 dark:text-neutral-400"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="p-2 text-neutral-600 dark:text-neutral-400"
                  >
                    {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile menu dropdown */}
            {showMobileMenu && (
              <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra pb-3">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setShowMobileMenu(false)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 text-sm font-sans transition-colors',
                      pathname === href
                        ? 'text-veritas-light-blue bg-veritas-light-blue/10'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                ))}
                
                {/* Algorithm selector in mobile menu */}
                <div className="mx-4 mt-2 p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                      <span className="text-sm font-medium text-black dark:text-white font-sans">
                        Balanced Discovery
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-veritas-light-blue" />
                  </div>
                </div>
                
                <div className="flex justify-center mt-3">
                  <button className="p-2 bg-veritas-light-blue rounded-full">
                    <Edit className="w-5 h-5 text-veritas-dark-blue" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
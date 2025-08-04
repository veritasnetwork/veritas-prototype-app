'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useLoginModal } from '@/hooks/useLoginModal';
import { LoginPendingModal } from '@/components/common/LoginPendingModal';
import { 
  Home, 
  Search, 
  User, 
  Sun, 
  Moon, 
  X,
  LogIn
} from 'lucide-react';

const VeritasNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { isVisible } = useScrollDirection();
  const { isLoginModalOpen, openLoginModal, closeLoginModal } = useLoginModal();

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 100;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle mobile detection and hydration
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    { icon: Home, label: 'Feed', href: '/', id: 'feed' },
    { icon: Search, label: 'Explore', href: '/?view=grid', id: 'explore' },
    { icon: User, label: 'Profile', href: '/profile', id: 'profile' },
  ];

  const desktopNavItems = [
    { label: 'Feed', href: '/' },
    { label: 'Explore', href: '/?view=grid' },
    { label: 'About', href: '/about' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/?view=grid') return pathname === '/' || pathname.startsWith('/explore');
    return pathname.startsWith(href);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileMenuOpen(false);
  };

  const handleLogin = () => {
    openLoginModal();
    setIsMobileMenuOpen(false);
  };

  const handleProfileClick = () => {
    openLoginModal();
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 w-full">
        <div className="bg-gradient-to-r from-slate-50/95 to-blue-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl">
          <div className="relative flex items-center justify-between px-12 py-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#1B365D] to-[#FFB800] rounded-2xl flex items-center justify-center">
                <span className="font-black text-white text-xl">V</span>
              </div>
              <span className="ml-3 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#1B365D] to-[#FFB800]">
                Veritas
              </span>
            </div>
            <div className="w-10 h-10"></div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      {/* Desktop Navbar - Premium center transition with scroll visibility */}
      <nav
        className={`hidden md:block fixed z-50 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible
            ? isScrolled
              ? 'top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-5xl'
              : 'top-0 left-1/2 -translate-x-1/2 w-full'
            : 'top-0 left-1/2 -translate-x-1/2 w-full -translate-y-full'
        }`}
        style={{
          transformOrigin: 'center top',
          transform: isVisible 
            ? isScrolled 
              ? 'translateX(-50%) scale(0.97)' 
              : 'translateX(-50%) scale(1)'
            : 'translateX(-50%) scale(0.95) translateY(-100%)'
        }}
      >
        <div
          className={`relative transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isScrolled
              ? 'bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 rounded-3xl shadow-2xl shadow-yellow-500/10'
              : 'bg-gradient-to-r from-slate-50/95 to-blue-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl'
          }`}
        >
          {/* Glassmorphism overlay for premium effect */}
          <div
            className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled
                ? 'bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded-3xl'
                : 'bg-gradient-to-r from-white/20 to-yellow-100/20 dark:from-slate-800/20 dark:to-slate-700/20'
            }`}
          />
          
          <div
            className={`relative flex items-center justify-between transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled ? 'px-8 py-4' : 'px-12 py-6'
            }`}
          >
            {/* Logo */}
            <div 
              className="flex items-center cursor-pointer group"
              onClick={() => handleNavigation('/')}
            >
              <div
                className={`relative transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isScrolled ? 'w-10 h-10' : 'w-12 h-12'
                }`}
              >
                <div className="w-full h-full bg-[#1B365D] rounded-2xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform duration-300">
                  <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                    <Image
                      src="/icons/logo.png"
                      alt="Veritas"
                      width={isScrolled ? 20 : 24}
                      height={isScrolled ? 20 : 24}
                      className="w-full h-full object-contain rounded-full"
                      priority
                      unoptimized
                    />
                  </div>
                </div>
              </div>
              <span
                className={`ml-3 font-bold text-[#1B365D] dark:text-[#D4A574] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isScrolled ? 'text-xl' : 'text-2xl'
                }`}
              >
                Veritas
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center space-x-8">
              {desktopNavItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  className={`relative px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                    isActiveRoute(item.href)
                      ? 'text-[#1B365D] dark:text-[#D4A574]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#1B365D] dark:hover:text-[#D4A574]'
                  }`}
                >
                  {isActiveRoute(item.href) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#FFB800]/20 to-[#1B365D]/10 rounded-xl transition-all duration-300" />
                  )}
                  <span className="relative">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10 hover:from-[#FFB800]/30 hover:to-[#1B365D]/20 transition-all duration-300 group"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-[#D4A574] group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Moon className="w-5 h-5 text-[#1B365D] group-hover:-rotate-12 transition-transform duration-300" />
                )}
              </button>

              {/* Login Button */}
              <button
                onClick={handleLogin}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#1B365D] hover:bg-[#2D4A6B] text-white font-semibold shadow-sm hover:shadow-md transform hover:scale-105 transition-all duration-300"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* NEW: Mobile Top Bar - Minimal (Logo + Theme Toggle only) */}
      {isMobile && (
        <nav 
          className={`md:hidden fixed top-0 left-0 right-0 z-50 pointer-events-none transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible
              ? 'translate-y-0'
              : '-translate-y-full'
          }`}
          style={{
            transformOrigin: 'center top',
            transform: isVisible 
              ? 'scale(1) translateY(0)' 
              : 'scale(0.95) translateY(-100%)'
          }}
        >
          <div className="p-4">
            <div
              className={`pointer-events-auto flex items-center justify-between max-w-md mx-auto rounded-3xl px-6 py-3 transition-all duration-500 ${
                isScrolled
                  ? 'bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl shadow-yellow-500/10'
                  : 'bg-white/5 dark:bg-slate-900/5 backdrop-blur-xl'
              }`}
            >
              {/* Mobile Logo */}
              <div 
                className="flex items-center cursor-pointer group"
                onClick={() => handleNavigation('/')}
              >
                <div className="relative w-8 h-8">
                  <div className="w-full h-full bg-[#1B365D] rounded-xl flex items-center justify-center p-1.5 group-hover:scale-110 transition-transform duration-300">
                    <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                      <Image
                        src="/icons/logo.png"
                        alt="Veritas"
                        width={16}
                        height={16}
                        className="w-full h-full object-contain rounded-full"
                        priority
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
                <span className="ml-2 text-lg font-bold text-[#1B365D] dark:text-[#D4A574]">
                  Veritas
                </span>
              </div>

              {/* Mobile Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10 hover:from-[#FFB800]/30 hover:to-[#1B365D]/20 transition-all duration-300 group"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-[#D4A574] group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Moon className="w-4 h-4 text-[#1B365D] group-hover:-rotate-12 transition-transform duration-300" />
                )}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Bottom Dock - With scroll visibility */}
      {isMobile && (
        <div 
          className={`md:hidden fixed bottom-0 left-0 right-0 z-50 p-4 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible
              ? 'translate-y-0'
              : 'translate-y-full'
          }`}
          style={{
            transformOrigin: 'center bottom',
            transform: isVisible 
              ? 'scale(1) translateY(0)' 
              : 'scale(0.95) translateY(100%)'
          }}
        >
          <div className="relative max-w-md mx-auto">
            {/* Glassmorphism container */}
            <div className="relative bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 rounded-3xl shadow-2xl shadow-yellow-500/10">
              {/* Premium gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded-3xl" />
              
              <div className="relative flex items-center justify-around px-6 py-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveRoute(item.href);
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => item.id === 'profile' ? handleProfileClick() : handleNavigation(item.href)}
                      className={`relative flex flex-col items-center p-3 rounded-2xl transition-all duration-300 ${
                        isActive 
                          ? 'transform scale-110' 
                          : 'hover:scale-105'
                      }`}
                    >
                      {/* Active indicator background */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/30 to-[#1B365D]/20 rounded-2xl" />
                      )}
                      
                      {/* Icon */}
                      <Icon 
                        className={`w-6 h-6 transition-colors duration-300 ${
                          isActive 
                            ? 'text-[#1B365D] dark:text-[#D4A574]' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`} 
                      />
                      
                      {/* Label */}
                      <span
                        className={`text-xs font-medium mt-1 transition-colors duration-300 ${
                          isActive 
                            ? 'text-[#1B365D] dark:text-[#D4A574]' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu overlay - Only show on mobile when menu is open */}
      {isMobile && isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm">
          <div className="absolute top-24 left-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/30">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#1B365D] dark:text-[#D4A574]">
                  Navigation
                </h3>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10"
                >
                  <X className="w-5 h-5 text-[#1B365D] dark:text-[#D4A574]" />
                </button>
              </div>
              
              {desktopNavItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  className={`w-full text-left p-4 rounded-2xl transition-all duration-300 ${
                    isActiveRoute(item.href)
                      ? 'bg-gradient-to-r from-[#FFB800]/20 to-[#1B365D]/10 text-[#1B365D] dark:text-[#D4A574]'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              
              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center space-x-2 p-4 rounded-2xl bg-[#1B365D] hover:bg-[#2D4A6B] text-white font-semibold transition-all duration-300"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Pending Modal */}
      <LoginPendingModal 
        isOpen={isLoginModalOpen} 
        onClose={closeLoginModal} 
      />
    </>
  );
};

export default VeritasNavbar;
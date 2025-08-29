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
  X
  // LogIn - Disabled
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
    { label: 'Feed', href: '/', isExternal: false },
    { label: 'Explore', href: '/?view=grid', isExternal: false },
    { label: 'About', href: 'https://veritas.computer/', isExternal: true },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/?view=grid') return pathname === '/' || pathname.startsWith('/explore');
    return pathname.startsWith(href);
  };

  const handleNavigation = (href: string, isExternal: boolean = false) => {
    if (isExternal) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else if (href.includes('?view=grid')) {
      // Navigate to feed page with grid view query param
      router.push('/');
      // Use setTimeout to ensure navigation completes before adding query param
      setTimeout(() => {
        router.push('/?view=grid');
      }, 100);
    } else {
      router.push(href);
    }
    setIsMobileMenuOpen(false);
  };

  // Login handler - Disabled
  // const handleLogin = () => {
  //   openLoginModal();
  //   setIsMobileMenuOpen(false);
  // };

  const handleProfileClick = () => {
    openLoginModal();
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 w-full">
        <div className="bg-gradient-to-r from-slate-50/95 to-blue-50/95 dark:from-transparent dark:to-transparent dark:bg-veritas-darker-blue/95 backdrop-blur-xl dark:border-b dark:border-veritas-eggshell/10">
          <div className="relative flex items-center justify-between px-12 py-6">
            <div className="flex items-center">
              <div className="w-12 h-12 relative">
                <Image
                  src="/icons/logo.png"
                  alt="Veritas"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  priority
                  unoptimized
                />
              </div>
              <span className="ml-3 text-2xl font-semibold text-veritas-dark-blue dark:text-veritas-eggshell font-mono uppercase">
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
              ? 'bg-white/10 dark:bg-veritas-darker-blue/95 backdrop-blur-2xl border border-white/20 dark:border-veritas-eggshell/10 rounded-3xl shadow-2xl shadow-yellow-500/10'
              : 'bg-gradient-to-r from-slate-50/95 to-blue-50/95 dark:from-transparent dark:to-transparent dark:bg-veritas-darker-blue/95 backdrop-blur-xl dark:border-b dark:border-veritas-eggshell/10'
          }`}
        >
          {/* Glassmorphism overlay for premium effect */}
          <div
            className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled
                ? 'bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded-3xl'
                : 'bg-gradient-to-r from-white/20 to-yellow-100/20 dark:from-transparent dark:to-transparent'
            }`}
          />
          
          <div
            className={`relative flex items-center justify-between transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled ? 'px-8 py-4' : 'px-12 py-6'
            }`}
          >
            {/* Logo */}
            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => handleNavigation('/')}
            >
              <div
                className={`relative transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isScrolled ? 'w-10 h-10' : 'w-12 h-12'
                }`}
              >
                <Image
                  src="/icons/logo.png"
                  alt="Veritas"
                  width={isScrolled ? 40 : 48}
                  height={isScrolled ? 40 : 48}
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                  priority
                  unoptimized
                />
              </div>
              <span
                className={`font-semibold text-veritas-dark-blue dark:text-veritas-eggshell font-mono uppercase transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
                  onClick={() => handleNavigation(item.href, item.isExternal)}
                  className={`relative px-4 py-2 rounded-xl font-medium font-mono uppercase text-sm transition-all duration-300 hover:bg-gray-100 dark:hover:bg-veritas-eggshell/10 ${
                    !item.isExternal && isActiveRoute(item.href)
                      ? 'text-[#1B365D] dark:text-veritas-eggshell'
                      : 'text-slate-600 dark:text-veritas-eggshell/70 hover:text-[#1B365D] dark:hover:text-veritas-eggshell'
                  }`}
                >
                  {!item.isExternal && isActiveRoute(item.href) && (
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
                className="p-3 rounded-2xl bg-white/10 dark:bg-veritas-eggshell/10 hover:bg-veritas-dark-blue dark:hover:bg-veritas-eggshell/20 transition-all duration-200 ease-in-out group border border-gray-200/50 dark:border-veritas-eggshell/10 hover:border-transparent dark:hover:border-veritas-eggshell/10"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-veritas-secondary dark:text-veritas-eggshell group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Moon className="w-5 h-5 text-veritas-primary group-hover:text-white dark:group-hover:text-veritas-eggshell group-hover:-rotate-12 transition-transform duration-300" />
                )}
              </button>

              {/* Login Button - Disabled */}
              {/* <button
                onClick={handleLogin}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-veritas-primary dark:bg-veritas-light-blue hover:bg-white dark:hover:bg-veritas-light-blue/90 hover:text-veritas-dark-blue text-white dark:text-veritas-darker-blue font-semibold font-mono uppercase text-sm shadow-sm hover:shadow-md transform hover:scale-105 transition-all duration-200 ease-in-out border-2 border-veritas-primary dark:border-veritas-light-blue/20 hover:border-veritas-dark-blue dark:hover:border-veritas-light-blue/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button> */}
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
                  ? 'bg-white/10 dark:bg-veritas-darker-blue/95 backdrop-blur-2xl border border-white/20 dark:border-veritas-eggshell/10 shadow-2xl shadow-yellow-500/10'
                  : 'bg-white/5 dark:bg-veritas-darker-blue/90 backdrop-blur-xl border border-white/10 dark:border-veritas-eggshell/5'
              }`}
            >
              {/* Mobile Logo */}
              <div 
                className="flex items-center space-x-2 cursor-pointer group"
                onClick={() => handleNavigation('/')}
              >
                <div className="relative w-8 h-8">
                  <Image
                    src="/icons/logo.png"
                    alt="Veritas"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                    priority
                    unoptimized
                  />
                </div>
                <span className="text-lg font-semibold text-veritas-dark-blue dark:text-veritas-eggshell font-mono uppercase">
                  Veritas
                </span>
              </div>

              {/* Mobile Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-white/10 dark:bg-veritas-eggshell/10 hover:bg-white/20 dark:hover:bg-veritas-eggshell/20 transition-all duration-300 group border border-gray-200/50 dark:border-veritas-eggshell/10"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-veritas-secondary dark:text-veritas-eggshell group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Moon className="w-4 h-4 text-veritas-primary group-hover:-rotate-12 transition-transform duration-300" />
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
          <div className="relative max-w-xs mx-auto">
            {/* Subtle Mobile Glassmorphism */}
            <div className="absolute -inset-1 bg-gradient-to-r from-white/10 via-white/5 to-white/10 dark:from-slate-800/10 dark:via-slate-800/5 dark:to-slate-800/10 rounded-[2rem] blur-xl pointer-events-none"></div>
            <div className="absolute -inset-0.5 bg-gradient-to-br from-veritas-orange/10 via-transparent to-veritas-light-blue/10 dark:from-veritas-orange/5 dark:via-transparent dark:to-veritas-light-blue/5 rounded-3xl blur-md pointer-events-none"></div>
            
            <div className="relative bg-white/20 dark:bg-veritas-darker-blue/95 backdrop-blur-[40px] border border-white/30 dark:border-veritas-eggshell/10 rounded-3xl">
              {/* Inner border highlight */}
              <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-veritas-eggshell/5 pointer-events-none"></div>
              
              {/* Premium gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/4 via-transparent to-blue-500/4 dark:from-yellow-500/3 dark:via-transparent dark:to-blue-400/3 rounded-3xl mix-blend-overlay pointer-events-none"></div>
              
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
                        <div className="absolute inset-0 bg-veritas-orange/20 dark:bg-veritas-light-blue/20 rounded-2xl" />
                      )}
                      
                      {/* Icon */}
                      <Icon 
                        className={`w-6 h-6 transition-colors duration-300 relative z-10 ${
                          isActive 
                            ? 'text-[#1B365D] dark:text-[#D4A574]' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`} 
                      />
                      
                      {/* Label */}
                      <span
                        className={`text-xs font-medium transition-colors duration-300 relative z-10 ${
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
          <div className="absolute top-24 left-4 right-4 bg-white/95 dark:bg-veritas-darker-blue/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-veritas-eggshell/10">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold font-mono uppercase text-veritas-primary dark:text-veritas-eggshell">
                  Navigation
                </h3>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-white/10 dark:bg-veritas-eggshell/10 hover:bg-white/20 dark:hover:bg-veritas-eggshell/20 transition-all duration-300"
                >
                  <X className="w-5 h-5 text-veritas-primary dark:text-veritas-eggshell" />
                </button>
              </div>
              
              {desktopNavItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href, item.isExternal)}
                  className={`w-full text-left p-4 rounded-2xl font-mono uppercase text-sm transition-all duration-300 ${
                    !item.isExternal && isActiveRoute(item.href)
                      ? 'bg-gradient-to-r from-veritas-secondary/20 to-veritas-primary/10 text-veritas-primary dark:text-veritas-eggshell'
                      : 'text-slate-600 dark:text-veritas-eggshell/70 hover:bg-gray-100 dark:hover:bg-veritas-eggshell/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              
              {/* Login Button - Disabled */}
              {/* <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center space-x-2 p-4 rounded-2xl bg-veritas-primary dark:bg-veritas-light-blue hover:bg-veritas-primary/90 dark:hover:bg-veritas-light-blue/90 text-white dark:text-veritas-darker-blue font-semibold font-mono uppercase text-sm transition-all duration-300 border border-veritas-primary/20 dark:border-veritas-light-blue/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button> */}
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
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Home, 
  Search, 
  Plus, 
  User, 
  Sun, 
  Moon, 
  Menu, 
  X,
  TrendingUp,
  Info
} from 'lucide-react';

const VeritasNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 100;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { icon: Home, label: 'Feed', href: '/', id: 'feed' },
    { icon: Search, label: 'Explore', href: '/explore', id: 'explore' },
    { icon: Plus, label: 'Submit', href: '/submit', id: 'submit' },
    { icon: TrendingUp, label: 'Analytics', href: '/analytics', id: 'analytics' },
    { icon: User, label: 'Profile', href: '/profile', id: 'profile' },
  ];

  const desktopNavItems = [
    { label: 'Feed', href: '/' },
    { label: 'Explore', href: '/explore' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'About', href: '/about' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navbar - Premium center transition */}
      <nav
        className={`hidden md:block fixed z-50 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolled
            ? 'top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-5xl'
            : 'top-0 left-1/2 -translate-x-1/2 w-full'
        }`}
        style={{
          transformOrigin: 'center top',
          transform: isScrolled 
            ? 'translateX(-50%) scale(0.97)' 
            : 'translateX(-50%) scale(1)'
        }}
      >
        <div
          className={`relative transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isScrolled
              ? 'bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 rounded-3xl shadow-2xl shadow-blue-500/10'
              : 'bg-gradient-to-r from-slate-50/95 to-blue-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl'
          }`}
        >
          {/* Glassmorphism overlay for premium effect */}
          <div
            className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled
                ? 'bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-3xl'
                : 'bg-gradient-to-r from-white/20 to-blue-100/20 dark:from-slate-800/20 dark:to-slate-700/20'
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
                <div className="absolute inset-0 bg-gradient-to-br from-[#0C1D51] to-[#B9D9EB] rounded-2xl transform group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute inset-[2px] bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <span className={`font-black text-transparent bg-clip-text bg-gradient-to-br from-[#0C1D51] to-[#B9D9EB] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isScrolled ? 'text-lg' : 'text-xl'
                  }`}>
                    V
                  </span>
                </div>
              </div>
              <span
                className={`ml-3 font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#0C1D51] to-[#B9D9EB] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
                      ? 'text-[#0C1D51] dark:text-[#B9D9EB]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#0C1D51] dark:hover:text-[#B9D9EB]'
                  }`}
                >
                  {isActiveRoute(item.href) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#B9D9EB]/20 to-[#0C1D51]/10 rounded-xl transition-all duration-300" />
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
                className="p-3 rounded-2xl bg-gradient-to-br from-[#B9D9EB]/20 to-[#0C1D51]/10 hover:from-[#B9D9EB]/30 hover:to-[#0C1D51]/20 transition-all duration-300 group"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-[#B9D9EB] group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Moon className="w-5 h-5 text-[#0C1D51] group-hover:-rotate-12 transition-transform duration-300" />
                )}
              </button>

              {/* Submit Button */}
              <button
                onClick={() => handleNavigation('/submit')}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0C1D51] to-[#B9D9EB] text-white font-semibold hover:shadow-2xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-300"
              >
                Submit Belief
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-3 rounded-2xl bg-gradient-to-br from-[#B9D9EB]/20 to-[#0C1D51]/10 hover:from-[#B9D9EB]/30 hover:to-[#0C1D51]/20 transition-all duration-300"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-[#0C1D51] dark:text-[#B9D9EB]" />
                ) : (
                  <Menu className="w-5 h-5 text-[#0C1D51] dark:text-[#B9D9EB]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Dock */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="relative max-w-md mx-auto">
          {/* Glassmorphism container */}
          <div className="relative bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 rounded-3xl shadow-2xl shadow-blue-500/10">
            {/* Premium gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-3xl" />
            
            <div className="relative flex items-center justify-around px-6 py-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className={`relative flex flex-col items-center p-3 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'transform scale-110' 
                        : 'hover:scale-105'
                    }`}
                  >
                    {/* Active indicator background */}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#B9D9EB]/30 to-[#0C1D51]/20 rounded-2xl" />
                    )}
                    
                    {/* Icon */}
                    <Icon 
                      className={`w-6 h-6 transition-colors duration-300 ${
                        isActive 
                          ? 'text-[#0C1D51] dark:text-[#B9D9EB]' 
                          : 'text-slate-500 dark:text-slate-400'
                      }`} 
                    />
                    
                    {/* Label */}
                    <span
                      className={`text-xs font-medium mt-1 transition-colors duration-300 ${
                        isActive 
                          ? 'text-[#0C1D51] dark:text-[#B9D9EB]' 
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

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm">
          <div className="absolute top-24 left-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/30">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#0C1D51] dark:text-[#B9D9EB]">
                  Navigation
                </h3>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl bg-gradient-to-br from-[#B9D9EB]/20 to-[#0C1D51]/10"
                >
                  {isDark ? (
                    <Sun className="w-5 h-5 text-[#B9D9EB]" />
                  ) : (
                    <Moon className="w-5 h-5 text-[#0C1D51]" />
                  )}
                </button>
              </div>
              
              {desktopNavItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  className={`w-full text-left p-4 rounded-2xl transition-all duration-300 ${
                    isActiveRoute(item.href)
                      ? 'bg-gradient-to-r from-[#B9D9EB]/20 to-[#0C1D51]/10 text-[#0C1D51] dark:text-[#B9D9EB]'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              
              <button
                onClick={() => handleNavigation('/submit')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#0C1D51] to-[#B9D9EB] text-white font-semibold"
              >
                Submit Belief
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VeritasNavbar;
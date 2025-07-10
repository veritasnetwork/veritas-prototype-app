'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
  Home, 
  Search, 
  Plus, 
  User, 
  Sun, 
  Moon,
  TrendingUp,
  ChevronDown,
  Grid3X3,
  LogIn,
  Filter,
  CircleDot,
  Users,
  DollarSign
} from 'lucide-react';
import { SortOption, ViewMode } from '@/types/belief.types';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useLoginModal } from '@/hooks/useLoginModal';
import { LoginPendingModal } from '@/components/common/LoginPendingModal';
import beliefData from '@/data/beliefs.json';

interface FeedNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const FeedNav: React.FC<FeedNavProps> = ({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileSortDropdown, setShowMobileSortDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Network metrics state
  const [isNetworkLoading, setIsNetworkLoading] = useState(true);
  const [networkMetrics, setNetworkMetrics] = useState({
    totalStake: 0,
    totalAgents: 0,
    isConnected: false
  });
  
  const { toggleTheme, isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { isVisible } = useScrollDirection();
  const { isLoginModalOpen, openLoginModal, closeLoginModal } = useLoginModal();

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

  // Handle scroll detection for mobile
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Network metrics loading simulation
  useEffect(() => {
    if (!mounted) return;

    // Simulate network connection and data loading
    const loadingTimer = setTimeout(() => {
      setIsNetworkLoading(false);
      setNetworkMetrics({
        totalStake: 2847532, // Simulated total stake
        totalAgents: 1247, // Simulated total agents
        isConnected: true
      });
    }, 10000); // 10 seconds loading

    // Simulate gradual loading of metrics during the loading period
    const metricsInterval = setInterval(() => {
      if (isNetworkLoading) {
        setNetworkMetrics({
          totalStake: Math.floor(Math.random() * 100000) + 2000000,
          totalAgents: Math.floor(Math.random() * 200) + 1000,
          isConnected: true // Keep connected during syncing
        });
      }
    }, 2000);

    return () => {
      clearTimeout(loadingTimer);
      clearInterval(metricsInterval);
    };
  }, [mounted, isNetworkLoading]);

  const navItems = [
    { icon: Home, label: 'Feed', href: '/', id: 'feed' },
    { icon: User, label: 'Profile', href: '/profile', id: 'profile' },
  ];

  // Get unique categories from actual belief data
  const getUniqueCategories = () => {
    const categorySet = new Set<string>();
    beliefData.forEach((belief: { category?: string }) => {
      if (belief.category) {
        categorySet.add(belief.category);
      }
    });
    return Array.from(categorySet);
  };

  const categories = getUniqueCategories();
  const categoryItems = [
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'new', label: 'New', icon: Plus },
    ...categories.map(cat => ({ 
      id: cat, 
      label: cat.charAt(0).toUpperCase() + cat.slice(1), 
      icon: undefined 
    }))
  ];

  // Simplified sort options (Sprint 2 requirement)
  const sortOptions = [
    { value: 'relevance' as SortOption, label: 'Relevance' },
    { value: 'truth' as SortOption, label: 'Truth' },
    { value: 'informativeness' as SortOption, label: 'Informativeness' }
  ];



  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const handleLogin = () => {
    openLoginModal();
  };

  const handleProfileClick = () => {
    openLoginModal();
  };

  if (!mounted) return null;

  return (
    <>
      {/* Desktop Navigation - Full Width Premium Dock */}
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
          <div className="relative">
            {/* Multi-layer Glassmorphism Container with Enhanced Aura Effect */}
            {/* Outer glow - largest blur for ambient light */}
            <div className="absolute -inset-2 bg-gradient-to-r from-white/30 via-white/20 to-white/30 dark:from-slate-800/30 dark:via-slate-800/20 dark:to-slate-800/30 rounded-[2rem] blur-2xl pointer-events-none"></div>
            
            {/* Middle aura - medium blur for color depth */}
            <div className="absolute -inset-1 bg-gradient-to-br from-[#FFB800]/25 via-[#FFB800]/15 to-[#1B365D]/25 dark:from-[#FFB800]/20 dark:via-[#D4A574]/15 dark:to-[#1B365D]/20 rounded-3xl blur-xl pointer-events-none"></div>
            
            {/* Inner halo - subtle blur for refined edge */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-white/40 dark:from-slate-900/40 dark:via-transparent dark:to-slate-900/40 rounded-3xl blur-lg pointer-events-none"></div>
            
            <div className="relative bg-white/20 dark:bg-slate-900/25 backdrop-blur-[40px] border border-white/30 dark:border-slate-700/40 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(255,184,0,0.15)] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]">
              {/* Inner border highlight */}
              <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-slate-600/50 pointer-events-none"></div>
              
              {/* Premium gradient overlay with better blending */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/4 via-transparent to-blue-500/4 dark:from-yellow-500/3 dark:via-transparent dark:to-blue-400/3 rounded-3xl mix-blend-overlay pointer-events-none"></div>
              
              {/* Subtle frost texture overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/2 to-transparent dark:via-slate-400/2 rounded-3xl pointer-events-none"></div>
              
              <div className="relative">
                {/* Main dock bar */}
                <div className="flex items-center justify-between px-8 py-4">
                  {/* Logo */}
                  <div 
                    className="flex items-center cursor-pointer group"
                    onClick={() => handleNavigation('/')}
                  >
                    <div className="relative w-10 h-10">
                      <div className="w-full h-full bg-[#1B365D] rounded-2xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#1B365D]/25">
                        <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                          <Image
                            src="/icons/veritas-logo.png"
                            alt="Veritas"
                            width={20}
                            height={20}
                            className="w-full h-full object-contain rounded-full"
                            priority
                            unoptimized
                          />
                        </div>
                      </div>
                    </div>
                    <span className="ml-3 text-xl font-bold text-[#1B365D] dark:text-[#D4A574] transition-all duration-300">
                      Veritas
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="flex-1 max-w-2xl mx-8">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search beliefs, topics, or users..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/30 dark:bg-slate-800/35 border border-white/40 dark:border-slate-600/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FFB800]/50 focus:border-[#FFB800]/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 backdrop-blur-lg transition-all duration-300 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center space-x-3">
                    {/* View Toggle */}
                    <button
                      onClick={() => onViewModeChange(viewMode === 'feed' ? 'grid' : 'feed')}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-gradient-to-br hover:from-[#FFB800]/30 hover:to-[#FFB800]/20 dark:hover:from-[#D4A574] dark:hover:to-[#D4A574]/80 transition-all duration-300 group shadow-lg hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-slate-700"
                      title={viewMode === 'feed' ? 'Switch to Grid View' : 'Switch to Feed View'}
                    >
                      <Grid3X3 className="w-5 h-5 text-[#1B365D] dark:text-[#D4A574] group-hover:text-[#1B365D]/80 dark:group-hover:text-slate-900 group-hover:scale-110 transition-all duration-300" />
                    </button>

                    {/* Sort Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className="flex items-center space-x-2 px-4 py-3 bg-white dark:bg-slate-800 hover:bg-gradient-to-br hover:from-[#FFB800]/30 hover:to-[#FFB800]/20 dark:hover:from-[#D4A574] dark:hover:to-[#D4A574]/80 transition-all duration-300 rounded-2xl group shadow-lg hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="text-sm font-medium text-[#1B365D] dark:text-[#D4A574] group-hover:text-[#1B365D]/80 dark:group-hover:text-slate-900 transition-colors duration-300">
                          {sortOptions.find(opt => opt.value === sortBy)?.label || 'Sort'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-[#1B365D] dark:text-[#D4A574] group-hover:text-[#1B365D]/80 dark:group-hover:text-slate-900 group-hover:rotate-180 transition-all duration-300" />
                      </button>

                      {/* Fixed Dropdown Menu */}
                      {showSortDropdown && (
                        <div className="absolute right-0 mt-3 w-48 z-50">
                          {/* Enhanced Dropdown aura effect */}
                          <div className="absolute -inset-1 bg-gradient-to-r from-white/30 via-white/20 to-white/30 dark:from-slate-800/30 dark:via-slate-800/20 dark:to-slate-800/30 rounded-3xl blur-xl pointer-events-none"></div>
                          <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/20 via-[#FFB800]/10 to-[#1B365D]/20 dark:from-[#FFB800]/15 dark:via-[#D4A574]/10 dark:to-[#1B365D]/15 rounded-2xl blur-lg pointer-events-none"></div>
                          
                          <div className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(255,184,0,0.2)] border border-white/60 dark:border-slate-600/60 py-2 px-6 transition-all duration-300">
                            {/* Inner border highlight */}
                            <div className="absolute inset-0 rounded-2xl border border-white/80 dark:border-slate-500/80 pointer-events-none"></div>
                            {sortOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  onSortChange(option.value);
                                  setShowSortDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-medium transition-all duration-300 hover:scale-[1.02] mx-2 my-1 rounded-xl ${
                                  sortBy === option.value
                                    ? 'text-white bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] shadow-lg shadow-[#1B365D]/25'
                                    : 'text-slate-700 dark:text-slate-300 hover:text-[#1B365D] dark:hover:text-[#D4A574] hover:bg-gradient-to-r hover:from-[#FFB800]/20 hover:to-[#1B365D]/10'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Theme Toggle */}
                    <button
                      onClick={toggleTheme}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-gradient-to-br hover:from-[#FFB800]/30 hover:to-[#FFB800]/20 dark:hover:from-[#D4A574] dark:hover:to-[#D4A574]/80 transition-all duration-300 group shadow-lg hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-slate-700"
                    >
                      {isDark ? (
                        <Sun className="w-5 h-5 text-[#D4A574] group-hover:text-slate-900 group-hover:rotate-12 transition-all duration-300" />
                      ) : (
                        <Moon className="w-5 h-5 text-[#1B365D] group-hover:text-[#1B365D]/80 group-hover:-rotate-12 transition-all duration-300" />
                      )}
                    </button>

                    {/* Login Button */}
                    <button
                      onClick={handleLogin}
                      className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] hover:from-[#2D4A6B] hover:to-[#1B365D] text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-[#1B365D]/20"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Login</span>
                    </button>
                  </div>
                </div>

                {/* Category Pills */}
                <div className="border-t border-white/20 dark:border-slate-700/30 overflow-hidden">
                  <div className="flex items-center justify-between px-8 pt-6 pb-8">
                    {/* Category buttons with proper spacing */}
                    <div className="flex-1 min-w-0 mr-6">
                      <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide pb-4 -mb-6 px-2">
                        {categoryItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => onCategoryChange(item.id)}
                              className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap transition-all duration-300 transform hover:scale-105 shadow-lg border flex-shrink-0 ${
                                activeCategory === item.id
                                  ? 'text-white bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] shadow-lg shadow-[#1B365D]/25 border-[#1B365D]/30'
                                  : 'text-slate-700 dark:text-slate-300 hover:text-[#1B365D]/80 dark:hover:text-slate-900 bg-white dark:bg-slate-800 hover:bg-gradient-to-r hover:from-[#FFB800]/30 hover:to-[#FFB800]/20 dark:hover:from-[#D4A574] dark:hover:to-[#D4A574]/80 hover:shadow-xl border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {Icon && <Icon className="w-4 h-4" />}
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Live Network Status Dashboard */}
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      {/* Connection Pulse Indicator */}
                                              <div className="relative">
                          <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                            isNetworkLoading 
                              ? 'bg-amber-500 animate-pulse' 
                              : 'bg-green-400'
                          }`}>
                            {!isNetworkLoading && networkMetrics.isConnected && (
                              <>
                                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-30"></div>
                                <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse"></div>
                              </>
                            )}
                          </div>
                        </div>

                      {/* Network Metrics Cards */}
                      <div className="flex items-center space-x-3">
                        {/* Total Stake */}
                        <div className="relative group w-20">
                          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                          <div className="relative px-3 py-2 bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:from-yellow-900/20 dark:to-orange-900/20 backdrop-blur-xl rounded-2xl border border-yellow-200/30 dark:border-yellow-700/30">
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <DollarSign className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                {!isNetworkLoading && (
                                  <div className="absolute inset-0 text-yellow-600 dark:text-yellow-400 animate-pulse opacity-50">
                                    <DollarSign className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              <div className="text-xs">
                                <div className="text-yellow-700/80 dark:text-yellow-300/80 font-medium">Stake</div>
                                <div className={`font-bold text-yellow-800 dark:text-yellow-200 mt-1 ${isNetworkLoading ? 'animate-pulse' : ''}`}>
                                  {isNetworkLoading ? (
                                    <div className="flex items-center space-x-0.5 h-4">
                                      <div className="w-1.5 h-1.5 bg-yellow-600 dark:bg-yellow-400 rounded-full animate-bounce"></div>
                                      <div className="w-1.5 h-1.5 bg-yellow-600 dark:bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                      <div className="w-1.5 h-1.5 bg-yellow-600 dark:bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                  ) : (
                                    `${(networkMetrics.totalStake / 1000000).toFixed(1)}M`
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Total Agents */}
                        <div className="relative group w-24">
                          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                          <div className="relative px-3 py-2 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-xl rounded-2xl border border-blue-200/30 dark:border-blue-700/30">
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                {!isNetworkLoading && (
                                  <div className="absolute inset-0 text-blue-600 dark:text-blue-400 animate-pulse opacity-50">
                                    <Users className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              <div className="text-xs">
                                <div className="text-blue-700/80 dark:text-blue-300/80 font-medium">Agents</div>
                                <div className={`font-bold text-blue-800 dark:text-blue-200 mt-1 ${isNetworkLoading ? 'animate-pulse' : ''}`}>
                                  {isNetworkLoading ? (
                                    <div className="flex items-center space-x-0.5 h-4">
                                      <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"></div>
                                      <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                      <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                  ) : (
                                    `${networkMetrics.totalAgents.toLocaleString()}`
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Network Status */}
                        <div className="relative group w-24">
                          <div className={`absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300 ${
                            isNetworkLoading || !networkMetrics.isConnected 
                              ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20' 
                              : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20'
                          }`}></div>
                          <div className={`relative px-2 py-2 backdrop-blur-xl rounded-2xl border transition-all duration-300 ${
                            isNetworkLoading 
                              ? 'bg-gradient-to-r from-amber-50/80 to-yellow-50/80 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200/30 dark:border-amber-700/30' 
                              : 'bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200/30 dark:border-green-700/30'
                          }`}>
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <CircleDot 
                                  className={`w-4 h-4 transition-all duration-500 ${
                                    isNetworkLoading 
                                      ? 'text-amber-600 dark:text-amber-400' 
                                      : 'text-green-600 dark:text-green-400'
                                  }`} 
                                />
                                {!isNetworkLoading && networkMetrics.isConnected && (
                                  <div className="absolute inset-0 text-green-600 dark:text-green-400 animate-ping opacity-50">
                                    <CircleDot className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              <div className="text-xs font-semibold">
                                <div className={`transition-all duration-300 ${
                                  isNetworkLoading 
                                    ? 'text-amber-700 dark:text-amber-300' 
                                    : 'text-green-700 dark:text-green-300'
                                }`}>
                                  {isNetworkLoading ? 'Syncing...' : 'Live'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Top Bar with Login/Signup */}
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
              className={`pointer-events-auto rounded-3xl transition-all duration-500 ${
                isScrolled
                  ? 'bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl shadow-yellow-500/10'
                  : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-slate-700'
              }`}
            >
              {/* Main mobile header */}
              <div className="flex items-center justify-between px-6 py-3">
                {/* Mobile Logo */}
                <div 
                  className="flex items-center cursor-pointer group"
                  onClick={() => handleNavigation('/')}
                >
                  <div className="relative w-8 h-8">
                    <div className="w-full h-full bg-[#1B365D] rounded-xl flex items-center justify-center p-1.5 group-hover:scale-110 transition-transform duration-300">
                      <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                        <Image
                          src="/icons/veritas-logo.png"
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

                {/* Mobile Actions */}
                <div className="flex items-center space-x-2">
                  {/* Filter Toggle */}
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="p-2 rounded-xl bg-[#FFB800]/10 hover:bg-[#FFB800]/20 transition-all duration-300"
                  >
                    <Filter className="w-4 h-4 text-[#1B365D] dark:text-[#D4A574]" />
                  </button>

                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-xl bg-[#FFB800]/10 hover:bg-[#FFB800]/20 transition-all duration-300 group"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-[#D4A574] group-hover:rotate-12 transition-transform duration-300" />
                    ) : (
                      <Moon className="w-4 h-4 text-[#1B365D] group-hover:-rotate-12 transition-transform duration-300" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile Search Bar */}
              <div className="px-6 pb-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search beliefs..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl leading-5 bg-white dark:bg-slate-700 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-[#FFB800] text-gray-900 dark:text-slate-100 shadow-sm text-sm"
                  />
                </div>
              </div>

              {/* Expandable Mobile Filters - Match Desktop */}
              {showMobileFilters && (
                <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-3 space-y-4">
                  {/* Categories - Match Desktop */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 block">Categories</label>
                    <div className="flex flex-wrap gap-2">
                      {categoryItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onCategoryChange(item.id);
                              setShowMobileFilters(false);
                            }}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                              activeCategory === item.id
                                ? 'text-white bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] shadow-lg shadow-[#1B365D]/25'
                                : 'text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {Icon && <Icon className="w-3 h-3" />}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sort Options - Custom Dropdown to Match Desktop */}
                  <div className="relative">
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 block">Sort By</label>
                    <button
                      onClick={() => setShowMobileSortDropdown(!showMobileSortDropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl border border-white/60 dark:border-slate-600/60 text-[#1B365D] dark:text-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#FFB800]/50 focus:border-[#FFB800]/50 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <span>{sortOptions.find(opt => opt.value === sortBy)?.label || 'Sort'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showMobileSortDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Mobile Sort Dropdown Menu */}
                    {showMobileSortDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-50">
                        {/* Enhanced Dropdown aura effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-white/30 via-white/20 to-white/30 dark:from-slate-800/30 dark:via-slate-800/20 dark:to-slate-800/30 rounded-2xl blur-xl pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/20 via-[#FFB800]/10 to-[#1B365D]/20 dark:from-[#FFB800]/15 dark:via-[#D4A574]/10 dark:to-[#1B365D]/15 rounded-xl blur-lg pointer-events-none"></div>
                        
                        <div className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(255,184,0,0.2)] border border-white/60 dark:border-slate-600/60 py-2 px-4 transition-all duration-300">
                          {/* Inner border highlight */}
                          <div className="absolute inset-0 rounded-xl border border-white/80 dark:border-slate-500/80 pointer-events-none"></div>
                          {sortOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                onSortChange(option.value);
                                setShowMobileSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm font-medium transition-all duration-300 hover:scale-[1.02] mx-2 my-1 rounded-lg ${
                                sortBy === option.value
                                  ? 'text-white bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] shadow-lg shadow-[#1B365D]/25'
                                  : 'text-slate-700 dark:text-slate-300 hover:text-[#1B365D] dark:hover:text-[#D4A574] hover:bg-gradient-to-r hover:from-[#FFB800]/20 hover:to-[#1B365D]/10'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* Clean Mobile Bottom Dock - Navigation Only */}
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
            {/* Multi-layer Mobile Glassmorphism */}
            <div className="absolute -inset-2 bg-gradient-to-r from-white/30 via-white/20 to-white/30 dark:from-slate-800/30 dark:via-slate-800/20 dark:to-slate-800/30 rounded-[2rem] blur-2xl pointer-events-none"></div>
            <div className="absolute -inset-1 bg-gradient-to-br from-[#FFB800]/25 via-[#FFB800]/15 to-[#1B365D]/25 dark:from-[#FFB800]/20 dark:via-[#D4A574]/15 dark:to-[#1B365D]/20 rounded-3xl blur-xl pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-white/40 dark:from-slate-900/40 dark:via-transparent dark:to-slate-900/40 rounded-3xl blur-lg pointer-events-none"></div>
            
            <div className="relative bg-white/20 dark:bg-slate-900/25 backdrop-blur-[40px] border border-white/30 dark:border-slate-700/40 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(255,184,0,0.15)]">
              {/* Inner border highlight */}
              <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-slate-600/50 pointer-events-none"></div>
              
              {/* Premium gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/4 via-transparent to-blue-500/4 dark:from-yellow-500/3 dark:via-transparent dark:to-blue-400/3 rounded-3xl mix-blend-overlay pointer-events-none"></div>
              
              {/* Navigation Icons Only */}
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
                        <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/30 to-[#1B365D]/20 rounded-2xl shadow-lg" />
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

      {/* Click outside to close dropdowns */}
      {(showSortDropdown || showMobileSortDropdown) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowSortDropdown(false);
            setShowMobileSortDropdown(false);
          }}
        />
      )}

      {/* Login Pending Modal */}
      <LoginPendingModal 
        isOpen={isLoginModalOpen} 
        onClose={closeLoginModal} 
      />
    </>
  );
};

export default FeedNav;
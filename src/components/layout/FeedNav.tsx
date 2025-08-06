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
            
            <div className="relative bg-white/20 dark:bg-veritas-darker-blue/95 backdrop-blur-[40px] border border-white/30 dark:border-veritas-eggshell/10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]">
              {/* Inner border highlight */}
              <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-veritas-eggshell/5 pointer-events-none"></div>
              
              {/* Premium gradient overlay with better blending */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/4 via-transparent to-blue-500/4 dark:from-yellow-500/3 dark:via-transparent dark:to-blue-400/3 rounded-3xl mix-blend-overlay pointer-events-none"></div>
              
              {/* Subtle frost texture overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/2 to-transparent dark:via-slate-400/2 rounded-3xl pointer-events-none"></div>
              
              <div className="relative">
                {/* Main dock bar */}
                <div className="flex items-center justify-between px-8 py-4">
                  {/* Logo */}
                  <div 
                    className="flex items-center space-x-3 cursor-pointer group"
                    onClick={() => handleNavigation('/')}
                  >
                    <div className="relative w-10 h-10">
                      <Image
                        src="/icons/logo.png"
                        alt="Veritas"
                        width={40}
                        height={40}
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                        priority
                        unoptimized
                      />
                    </div>
                    <span className="text-xl font-semibold text-veritas-dark-blue dark:text-veritas-eggshell font-mono uppercase">
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
                        className="w-full pl-12 pr-4 py-3 bg-white/30 dark:bg-veritas-eggshell/5 border border-white/40 dark:border-veritas-eggshell/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-veritas-orange/50 focus:border-veritas-orange/50 text-slate-900 dark:text-veritas-eggshell placeholder-slate-500 dark:placeholder-veritas-eggshell/40 backdrop-blur-lg transition-all duration-300 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center space-x-3">
                    {/* View Toggle */}
                    <button
                      onClick={() => onViewModeChange(viewMode === 'feed' ? 'grid' : 'feed')}
                      className="p-3 rounded-2xl bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-veritas-eggshell/10"
                      title={viewMode === 'feed' ? 'Switch to Grid View' : 'Switch to Feed View'}
                    >
                      <Grid3X3 className="w-5 h-5 text-veritas-primary dark:text-veritas-eggshell group-hover:text-veritas-primary/80 dark:group-hover:text-veritas-eggshell/80 group-hover:scale-110 transition-all duration-300" />
                    </button>

                    {/* Sort Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className={`flex items-center justify-between w-44 px-4 py-3 transition-all duration-300 shadow-lg hover:shadow-xl border ${
                          showSortDropdown 
                            ? 'rounded-t-2xl bg-gray-50 dark:bg-veritas-eggshell/10' 
                            : 'rounded-2xl hover:scale-105'
                        } bg-white dark:bg-veritas-darker-blue/95 hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10 border-slate-200 dark:border-veritas-eggshell/10`}
                      >
                        <span className="text-sm font-medium font-mono uppercase text-veritas-primary dark:text-veritas-eggshell transition-colors duration-300">
                          {sortOptions.find(opt => opt.value === sortBy)?.label || 'Sort'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-veritas-primary dark:text-veritas-eggshell transition-transform duration-300 flex-shrink-0 ${
                          showSortDropdown ? 'rotate-180' : ''
                        }`} />
                      </button>

                      {/* Dropdown Menu */}
                      <div className={`absolute top-full left-0 right-0 z-50 rounded-b-2xl overflow-hidden transition-all duration-300 ease-out ${
                        showSortDropdown 
                          ? 'opacity-100 translate-y-0 max-h-[200px]' 
                          : 'opacity-0 -translate-y-1 max-h-0 pointer-events-none'
                      }`}>
                        <div className="bg-white dark:bg-veritas-darker-blue/95 backdrop-blur-xl border-x border-b border-slate-200 dark:border-veritas-eggshell/10 rounded-b-2xl shadow-lg">
                          {sortOptions.map((option, index) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                onSortChange(option.value);
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm font-medium font-mono uppercase transition-all duration-300 ${
                                sortBy === option.value
                                  ? 'bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue'
                                  : 'text-slate-700 dark:text-veritas-eggshell hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10'
                              } ${
                                index === 0 ? 'border-t border-slate-200/50 dark:border-veritas-eggshell/5' : ''
                              } ${
                                index === sortOptions.length - 1 ? 'rounded-b-2xl' : ''
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Theme Toggle */}
                    <button
                      onClick={toggleTheme}
                      className="p-3 rounded-2xl bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-veritas-eggshell/10"
                    >
                      {isDark ? (
                        <Sun className="w-5 h-5 text-veritas-eggshell group-hover:text-veritas-eggshell/80 group-hover:rotate-12 transition-all duration-300" />
                      ) : (
                        <Moon className="w-5 h-5 text-veritas-primary group-hover:text-veritas-primary/80 group-hover:-rotate-12 transition-all duration-300" />
                      )}
                    </button>

                    {/* Login Button */}
                    <button
                      onClick={handleLogin}
                      className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-veritas-primary dark:bg-veritas-light-blue hover:bg-veritas-primary/90 dark:hover:bg-veritas-light-blue/90 text-white dark:text-veritas-darker-blue font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-veritas-primary/20 dark:border-veritas-light-blue/20"
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
                                  ? item.id === 'trending' 
                                    ? 'text-white dark:text-veritas-darker-blue bg-veritas-primary dark:bg-veritas-light-blue shadow-lg shadow-veritas-primary/25 dark:shadow-veritas-light-blue/25 border-veritas-primary/30 dark:border-veritas-light-blue/30'
                                    : 'text-white bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] shadow-lg shadow-[#1B365D]/25 border-[#1B365D]/30'
                                  : 'text-slate-700 dark:text-veritas-eggshell/70 hover:text-[#1B365D]/80 dark:hover:text-veritas-eggshell bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10 hover:shadow-xl border-slate-200 dark:border-veritas-eggshell/10'
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
                  ? 'bg-white/10 dark:bg-veritas-darker-blue/95 backdrop-blur-2xl border border-white/20 dark:border-veritas-eggshell/10 shadow-2xl shadow-yellow-500/10'
                  : 'bg-white/95 dark:bg-veritas-darker-blue/95 backdrop-blur-xl border border-gray-200 dark:border-veritas-eggshell/10'
              }`}
            >
              {/* Main mobile header */}
              <div className="flex items-center justify-between px-6 py-3">
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

                {/* Mobile Actions */}
                <div className="flex items-center space-x-2">
                  {/* Filter Toggle */}
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="p-2 rounded-xl bg-veritas-secondary/10 dark:bg-veritas-eggshell/10 hover:bg-veritas-secondary/20 dark:hover:bg-veritas-eggshell/20 transition-all duration-300"
                  >
                    <Filter className="w-4 h-4 text-veritas-primary dark:text-veritas-eggshell" />
                  </button>

                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-xl bg-veritas-secondary/10 dark:bg-veritas-eggshell/10 hover:bg-veritas-secondary/20 dark:hover:bg-veritas-eggshell/20 transition-all duration-300 group"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-veritas-secondary dark:text-veritas-eggshell group-hover:rotate-12 transition-transform duration-300" />
                    ) : (
                      <Moon className="w-4 h-4 text-veritas-primary group-hover:-rotate-12 transition-transform duration-300" />
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
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-veritas-eggshell/10 rounded-xl leading-5 bg-white dark:bg-veritas-eggshell/5 placeholder-gray-500 dark:placeholder-veritas-eggshell/40 focus:outline-none focus:ring-2 focus:ring-veritas-orange focus:border-veritas-orange text-gray-900 dark:text-veritas-eggshell shadow-sm text-sm"
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
                                ? item.id === 'trending' 
                                  ? 'text-white dark:text-veritas-darker-blue bg-veritas-primary dark:bg-veritas-light-blue shadow-lg shadow-veritas-primary/25 dark:shadow-veritas-light-blue/25'
                                  : 'text-white bg-gradient-to-r from-[#1B365D] to-[#2D4A6B] shadow-lg shadow-[#1B365D]/25'
                                : 'text-gray-700 dark:text-veritas-eggshell/70 bg-gray-100 dark:bg-transparent hover:bg-gray-200 dark:hover:bg-veritas-eggshell/10'
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
                    <label className="text-xs font-medium text-gray-700 dark:text-veritas-eggshell mb-2 block">Sort By</label>
                    <button
                      onClick={() => setShowMobileSortDropdown(!showMobileSortDropdown)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium font-mono uppercase backdrop-blur-xl shadow-lg hover:shadow-xl border transition-all duration-300 ${
                        showMobileSortDropdown 
                          ? 'rounded-t-xl bg-gray-50 dark:bg-veritas-eggshell/10' 
                          : 'rounded-xl hover:scale-[1.02]'
                      } bg-white dark:bg-veritas-darker-blue/95 hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10 border-slate-200 dark:border-veritas-eggshell/10 text-veritas-primary dark:text-veritas-eggshell`}
                    >
                      <span className="truncate">{sortOptions.find(opt => opt.value === sortBy)?.label || 'Sort'}</span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform duration-300 ${showMobileSortDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Mobile Sort Dropdown Menu */}
                    <div className={`absolute top-full left-0 right-0 z-50 rounded-b-xl overflow-hidden transition-all duration-300 ease-out ${
                      showMobileSortDropdown 
                        ? 'opacity-100 translate-y-0 max-h-[200px]' 
                        : 'opacity-0 -translate-y-1 max-h-0 pointer-events-none'
                    }`}>
                      <div className="bg-white dark:bg-veritas-darker-blue/95 backdrop-blur-xl border-x border-b border-slate-200 dark:border-veritas-eggshell/10 rounded-b-xl shadow-lg">
                        {sortOptions.map((option, index) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              onSortChange(option.value);
                              setShowMobileSortDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm font-medium font-mono uppercase transition-all duration-300 ${
                              sortBy === option.value
                                ? 'bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue'
                                : 'text-slate-700 dark:text-veritas-eggshell hover:bg-gray-50 dark:hover:bg-veritas-eggshell/10'
                            } ${
                              index === 0 ? 'border-t border-slate-200/50 dark:border-veritas-eggshell/5' : ''
                            } ${
                              index === sortOptions.length - 1 ? 'rounded-b-xl' : ''
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
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
            
            <div className="relative bg-white/20 dark:bg-veritas-darker-blue/95 backdrop-blur-[40px] border border-white/30 dark:border-veritas-eggshell/10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
              {/* Inner border highlight */}
              <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-veritas-eggshell/5 pointer-events-none"></div>
              
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
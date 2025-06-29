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
  Filter,
  Bookmark
} from 'lucide-react';
import { getAllCategories } from '@/lib/data';
import { FilterStatus, SortOption } from '@/types/belief.types';

interface FeedNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeFilters: string[];
  sortBy: SortOption;
  filterStatus: FilterStatus;
  onFilterToggle: (filter: string) => void;
  onSortChange: (sort: SortOption) => void;
  onStatusChange: (status: FilterStatus) => void;
}

const FeedNav: React.FC<FeedNavProps> = ({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  activeFilters,
  sortBy,
  filterStatus,
  onFilterToggle,
  onSortChange,
  onStatusChange
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { toggleTheme, isDark } = useTheme();
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
    { icon: Search, label: 'Explore', href: '/explore', id: 'explore' },
    { icon: Plus, label: 'Submit', href: '/submit', id: 'submit' },
    { icon: TrendingUp, label: 'Analytics', href: '/analytics', id: 'analytics' },
    { icon: User, label: 'Profile', href: '/profile', id: 'profile' },
  ];



  const categories = getAllCategories();
  const categoryItems = [
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'new', label: 'New', icon: Plus },
    ...categories.map(cat => ({ id: cat.id, label: cat.name, icon: undefined }))
  ];

  const quickFilters = [
    'All',
    'Breaking News',
    'High Stakes',
    'Ending Soon',
    'Recently Active',
    'High Consensus',
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setShowMobileFilters(false);
  };

  const isFilterActive = (filter: string) => {
    if (filter === 'All') return activeFilters.includes('all') || activeFilters.length === 0;
    return activeFilters.includes(filter.toLowerCase().replace(' ', '-'));
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 w-full">
        <div className="bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl">
          <div className="relative flex items-center justify-between px-12 py-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-[#1B365D] rounded-2xl flex items-center justify-center p-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="font-black text-white text-xl">V</span>
                </div>
              </div>
              <span className="ml-3 text-2xl font-bold text-[#1B365D] dark:text-[#D4A574]">
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
      {/* Desktop Enhanced Feed Navbar */}
      <nav
        className={`hidden md:block fixed z-50 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolled
            ? 'top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-7xl'
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
              ? 'bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 rounded-3xl shadow-2xl shadow-yellow-500/10'
              : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-slate-700'
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
          
          {/* Main Header */}
          <div
            className={`relative flex items-center justify-between transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled ? 'px-8 py-4' : 'px-12 py-6'
            }`}
          >
            {/* Logo with circular transparent image */}
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
                      src="/icons/veritas-logo.png"
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

            {/* Enhanced Search Bar */}
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search beliefs..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl leading-5 bg-white dark:bg-slate-700 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-[#FFB800] text-gray-900 dark:text-slate-100 shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm font-mono">/</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-3 rounded-2xl bg-[#FFB800]/10 hover:bg-[#FFB800]/20 transition-all duration-300 group"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-[#D4A574] group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Moon className="w-5 h-5 text-[#1B365D] group-hover:-rotate-12 transition-transform duration-300" />
                )}
              </button>

              {/* Submit Button */}
              <button
                onClick={() => handleNavigation('/submit')}
                className="px-6 py-3 rounded-2xl bg-[#1B365D] hover:bg-[#2D4A6B] text-white font-semibold shadow-sm hover:shadow-md transform hover:scale-105 transition-all duration-300"
              >
                Submit Belief
              </button>
            </div>
          </div>

          {/* Categories Row */}
          <div className={`relative border-t border-gray-200 dark:border-slate-700 ${isScrolled ? 'px-8 py-3' : 'px-12 py-4'}`}>
            <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
              {categoryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onCategoryChange(item.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      activeCategory === item.id
                        ? 'text-white bg-[#1B365D] shadow-sm'
                        : 'text-gray-700 dark:text-slate-300 hover:text-[#1B365D] dark:hover:text-[#D4A574] hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters Row */}
          <div className={`relative border-t border-gray-200 dark:border-slate-700 ${isScrolled ? 'px-8 py-3' : 'px-12 py-4'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
              {/* Left side - Filter Icons + Quick Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-500 hover:text-[#1B365D] dark:hover:text-[#D4A574] transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <Filter className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-[#FFB800] transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <Bookmark className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Filter Tags */}
                <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
                  {quickFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => onFilterToggle(filter)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                        isFilterActive(filter)
                          ? 'bg-[#FFB800] text-[#1B365D] shadow-sm'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right side - Sort and Status dropdowns */}
              <div className="flex items-center space-x-3">
                <select
                  value={filterStatus}
                  onChange={(e) => onStatusChange(e.target.value as FilterStatus)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-[#FFB800] shadow-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value as SortOption)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-[#FFB800] shadow-sm"
                >
                  <option value="recent">Most Recent</option>
                  <option value="active">Most Active</option>
                  <option value="stakes">Highest Stakes</option>
                  <option value="consensus">High Consensus</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Enhanced Mobile Top Bar */}
      {isMobile && (
        <nav className="md:hidden fixed top-0 left-0 right-0 z-50 pointer-events-none">
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
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="p-2 rounded-xl bg-[#FFB800]/10 hover:bg-[#FFB800]/20 transition-all duration-300"
                  >
                    <Filter className="w-4 h-4 text-[#1B365D] dark:text-[#D4A574]" />
                  </button>
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

              {/* Expandable Mobile Filters */}
              {showMobileFilters && (
                <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-3 space-y-4">
                  {/* Categories */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 block">Categories</label>
                    <div className="flex flex-wrap gap-2">
                      {categoryItems.slice(0, 6).map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => onCategoryChange(item.id)}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                              activeCategory === item.id
                                ? 'text-white bg-[#1B365D] shadow-sm'
                                : 'text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700'
                            }`}
                          >
                            {Icon && <Icon className="w-3 h-3" />}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 block">Quick Filters</label>
                    <div className="flex flex-wrap gap-2">
                      {quickFilters.slice(0, 4).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => onFilterToggle(filter)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                            isFilterActive(filter)
                              ? 'bg-[#FFB800] text-[#1B365D] shadow-sm'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort and Status */}
                  <div className="flex space-x-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => onStatusChange(e.target.value as FilterStatus)}
                      className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-[#FFB800]"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => onSortChange(e.target.value as SortOption)}
                      className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-[#FFB800]"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="active">Most Active</option>
                      <option value="stakes">Highest Stakes</option>
                      <option value="consensus">High Consensus</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Bottom Dock - Unchanged */}
      {isMobile && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4">
          <div className="relative max-w-md mx-auto">
            {/* Glassmorphism container */}
            <div className="relative bg-white/90 dark:bg-slate-900/10 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 rounded-3xl shadow-2xl shadow-yellow-500/10">
              {/* Premium gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded-3xl" />
              
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
    </>
  );
};

export default FeedNav; 
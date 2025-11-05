'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, TrendingUp, BarChart3 } from 'lucide-react';

export type SortOption = 'recent' | 'volume' | 'relevant';

interface MobileNavProps {
  onCreatePost: () => void;
  isHidden?: boolean;
  // Filter props (only used on explore page)
  currentSort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  showFilters?: boolean;
  onHowItWorks?: () => void;
}

const sortOptions: { value: SortOption; label: string; icon: any }[] = [
  { value: 'recent', label: 'Most Recent', icon: Clock },
  { value: 'volume', label: 'Most Volume', icon: BarChart3 },
  { value: 'relevant', label: 'Most Relevant', icon: TrendingUp },
];

export function MobileNav({ onCreatePost, isHidden = false, currentSort = 'recent', onSortChange, showFilters = false, onHowItWorks }: MobileNavProps) {
  const { user } = useAuth();
  const { login } = usePrivy();
  const pathname = usePathname();
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const isActive = (path: string) => {
    if (path === '/feed') {
      return pathname === '/feed';
    }
    return pathname?.startsWith(path);
  };

  const handleFilterToggle = () => {
    if (showFilters && isActive('/feed')) {
      setIsFilterExpanded(!isFilterExpanded);
    }
  };

  const handleSortSelect = (sort: SortOption) => {
    onSortChange?.(sort);
    setIsFilterExpanded(false);
  };

  return (
    <nav className={`lg:hidden fixed bottom-4 left-4 right-4 z-sticky safe-area-bottom transition-transform duration-300 ease-out ${
      isHidden ? 'translate-y-[calc(100%+1rem)]' : 'translate-y-0'
    }`}>
      {/* Filter Menu - appears above nav when expanded */}
      {showFilters && isFilterExpanded && (
        <div className="mb-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {sortOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === currentSort;

            return (
              <button
                key={option.value}
                onClick={() => handleSortSelect(option.value)}
                className={`w-full px-6 py-4 flex items-center gap-3 transition-colors touch-feedback ${
                  isSelected
                    ? 'text-[#B9D9EB] bg-white/5'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{option.label}</span>
                {isSelected && (
                  <svg className="w-5 h-5 ml-auto text-[#B9D9EB]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}

          {/* Divider */}
          {onHowItWorks && (
            <div className="border-t border-white/10" />
          )}

          {/* How It Works */}
          {onHowItWorks && (
            <button
              onClick={() => {
                onHowItWorks();
                setIsFilterExpanded(false);
              }}
              className="w-full px-6 py-4 flex items-center gap-3 text-gray-300 hover:bg-white/5 transition-colors touch-feedback"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">How It Works</span>
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-around h-16 px-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
        {/* Feed */}
        <Link
          href="/feed"
          className={`flex items-center justify-center w-full h-full transition-colors touch-feedback ${
            isActive('/feed') ? 'text-[#B9D9EB]' : 'text-gray-400'
          }`}
        >
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </Link>

        {/* Explore - becomes filter menu button when on feed page */}
        {showFilters && isActive('/feed') ? (
          <button
            onClick={handleFilterToggle}
            className={`flex items-center justify-center w-full h-full transition-all touch-feedback ${
              isFilterExpanded ? 'text-[#B9D9EB]' : 'text-gray-400'
            }`}
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              {/* Top line - rotates and moves when expanded */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16"
                className="transition-all duration-300 ease-in-out"
                style={{
                  transform: isFilterExpanded ? 'rotate(45deg) translateY(6px) translateX(6px)' : 'rotate(0)',
                  transformOrigin: 'center',
                }}
              />
              {/* Middle line - fades out when expanded */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 12h16"
                className="transition-all duration-300 ease-in-out"
                style={{
                  opacity: isFilterExpanded ? 0 : 1,
                }}
              />
              {/* Bottom line - rotates and moves when expanded */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 18h16"
                className="transition-all duration-300 ease-in-out"
                style={{
                  transform: isFilterExpanded ? 'rotate(-45deg) translateY(-6px) translateX(6px)' : 'rotate(0)',
                  transformOrigin: 'center',
                }}
              />
            </svg>
          </button>
        ) : (
          <Link
            href="/explore"
            className={`flex items-center justify-center w-full h-full transition-colors touch-feedback ${
              isActive('/explore') ? 'text-[#B9D9EB]' : 'text-gray-400'
            }`}
          >
            <svg
              className="w-7 h-7"
              fill={isActive('/explore') ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={isActive('/explore') ? 0 : 2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
        )}

        {/* Create Post */}
        <button
          onClick={onCreatePost}
          className="flex items-center justify-center w-full h-full text-[#B9D9EB] relative touch-feedback"
          type="button"
        >
          {/* Light blue circle background */}
          <div className="absolute top-1/2 -translate-y-1/2 w-12 h-12 bg-[#B9D9EB] rounded-full flex items-center justify-center pointer-events-none">
            <svg className="w-6 h-6 text-black pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {/* Profile */}
        {user ? (
          <Link
            href={`/profile/${user.username}`}
            className="flex items-center justify-center w-full h-full relative touch-feedback"
          >
            {/* Profile Picture Circle - same size as create button */}
            <div className={`absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full overflow-hidden pointer-events-none ${
              isActive('/profile') ? 'ring-2 ring-[#B9D9EB]' : ''
            }`}>
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                // Default eggshell circle with initial
                <div className="w-full h-full bg-[#F0EAD6] flex items-center justify-center">
                  <span className="text-gray-700 text-lg font-bold">
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ) : (
          <button
            onClick={login}
            className="flex items-center justify-center w-full h-full relative touch-feedback"
            type="button"
          >
            {/* Sign in circle - same icon as desktop */}
            <div className="absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center pointer-events-none">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </button>
        )}
      </div>
    </nav>
  );
}

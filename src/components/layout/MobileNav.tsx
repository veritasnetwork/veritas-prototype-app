'use client';

import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileNavProps {
  onCreatePost: () => void;
}

export function MobileNav({ onCreatePost }: MobileNavProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/feed') {
      return pathname === '/feed';
    }
    return pathname?.startsWith(path);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#1a1a1a] border-t border-gray-800 z-[1100] backdrop-blur-md bg-opacity-95">
      <div className="flex items-center justify-around h-full px-2">
        {/* Feed */}
        <Link
          href="/feed"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive('/feed') ? 'text-[#B9D9EB]' : 'text-gray-400'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill={isActive('/feed') ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={isActive('/feed') ? 0 : 2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="text-xs mt-1">Feed</span>
        </Link>

        {/* Explore */}
        <Link
          href="/explore"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive('/explore') ? 'text-[#B9D9EB]' : 'text-gray-400'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill={isActive('/explore') ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={isActive('/explore') ? 0 : 2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs mt-1">Explore</span>
        </Link>

        {/* Create Post */}
        <button
          onClick={onCreatePost}
          className="flex flex-col items-center justify-center w-full h-full text-[#B9D9EB] relative"
        >
          {/* Light blue circle background */}
          <div className="absolute top-1/2 -translate-y-1/2 w-12 h-12 bg-[#B9D9EB] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {/* Profile */}
        {user ? (
          <Link
            href={`/profile/${user.username}`}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
              isActive('/profile') ? 'text-[#B9D9EB]' : 'text-gray-400'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill={isActive('/profile') ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={isActive('/profile') ? 0 : 2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        ) : (
          <Link
            href="/feed"
            className="flex flex-col items-center justify-center w-full h-full text-gray-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs mt-1">Login</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

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
    <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-[9999] safe-area-bottom">
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
            fill={isActive('/feed') ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={isActive('/feed') ? 0 : 2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </Link>

        {/* Explore */}
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
              {user.profilePhotoUrl ? (
                <img
                  src={user.profilePhotoUrl}
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
          <Link
            href="/feed"
            className="flex items-center justify-center w-full h-full relative touch-feedback"
          >
            {/* Login circle - same style as default profile */}
            <div className="absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center pointer-events-none">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}

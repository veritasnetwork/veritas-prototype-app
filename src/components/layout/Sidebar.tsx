'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  onCreatePost: () => void;
  isCompact?: boolean;
}

export function Sidebar({ onCreatePost, isCompact = false }: SidebarProps) {
  const { user } = useAuth();
  const { linkWallet } = usePrivy();
  const { address: solanaAddress } = useSolanaWallet();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className={`hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:flex lg:flex-col lg:p-4 bg-[#0f0f0f] transition-all duration-300 ease-in-out ${isCompact ? 'lg:w-28' : 'lg:w-64'}`}>
      {/* Bubble Container */}
      <div className={`flex flex-col h-full bg-[#1a1a1a] rounded-2xl shadow-lg transition-all duration-300 ease-in-out ${isCompact ? 'p-3' : 'p-5'}`}>
        {/* Logo */}
        <Link href="/feed" className={`flex items-center mb-8 hover:opacity-80 transition-all duration-300 ${isCompact ? 'justify-center' : 'gap-3'}`}>
        <img
          src="/icons/logo.png"
          alt="Veritas Logo"
          className={`transition-all duration-300 ease-in-out ${isCompact ? 'w-12 h-12' : 'w-10 h-10'}`}
        />
        <span className={`text-white font-bold text-2xl tracking-wider font-mono transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
          isCompact ? 'max-w-0 opacity-0' : 'max-w-xs opacity-100'
        }`}>
          VERITAS
        </span>
      </Link>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-2">
          {/* Feed */}
          <Link
            href="/feed"
            className={`flex items-center py-3 rounded-xl transition-all duration-300 ease-in-out ${
              isCompact ? 'justify-center' : 'gap-3 px-4'
            } ${
              isActive('/feed')
                ? 'bg-[#B9D9EB]/10 text-[#B9D9EB]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={isCompact ? 'Feed' : ''}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!isCompact && (
              <>
                <span className="font-medium overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out">Feed</span>
                {isActive('/feed') && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#B9D9EB]" />
                )}
              </>
            )}
          </Link>

          {/* Explore */}
          <Link
            href="/explore"
            onClick={(e) => {
              console.log('🔴 SIDEBAR EXPLORE LINK CLICKED', e);
            }}
            className={`flex items-center py-3 rounded-xl transition-all duration-300 ease-in-out ${
              isCompact ? 'justify-center' : 'gap-3 px-4'
            } ${
              isActive('/explore')
                ? 'bg-[#B9D9EB]/10 text-[#B9D9EB]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={isCompact ? 'Explore' : ''}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {!isCompact && (
              <>
                <span className="font-medium overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out">Explore</span>
                {isActive('/explore') && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#B9D9EB]" />
                )}
              </>
            )}
          </Link>

          {/* Profile */}
          {user && (
            <Link
              href={`/profile/${user.username}`}
              className={`flex items-center py-3 rounded-xl transition-all duration-300 ease-in-out ${
                isCompact ? 'justify-center' : 'gap-3 px-4'
              } ${
                pathname?.startsWith('/profile')
                  ? 'bg-[#B9D9EB]/10 text-[#B9D9EB]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title={isCompact ? 'Profile' : ''}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {!isCompact && (
                <>
                  <span className="font-medium overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out">Profile</span>
                  {pathname?.startsWith('/profile') && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#B9D9EB]" />
                  )}
                </>
              )}
            </Link>
          )}

          {/* Divider */}
          <div className="py-2">
            <div className="border-t border-gray-700/50" />
          </div>

          {/* Create Post Button */}
          <button
            onClick={onCreatePost}
            className={`flex items-center bg-[#B9D9EB] text-black font-semibold hover:bg-[#D0E7F4] transition-all duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98] shadow-md ${
              isCompact ? 'justify-center w-[52px] h-[52px] rounded-full mx-auto' : 'gap-3 py-3 px-4 rounded-xl w-full'
            }`}
            title={isCompact ? 'Create Post' : ''}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {!isCompact && <span className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out">Create Post</span>}
          </button>
        </nav>

        {/* Wallet Status - Bottom */}
        <div className="mt-auto pt-6 border-t border-gray-700/50">
          {user && !solanaAddress && !isCompact && (
            <button
              onClick={linkWallet}
              className="w-full px-4 py-3 text-sm font-medium text-[#B9D9EB] hover:text-[#D0E7F4] border border-[#B9D9EB]/50 hover:border-[#D0E7F4] rounded-xl transition-all hover:bg-[#B9D9EB]/5"
            >
              Connect Wallet
            </button>
          )}
          {user && !solanaAddress && isCompact && (
            <button
              onClick={linkWallet}
              className="w-full py-3 text-sm font-medium text-[#B9D9EB] hover:text-[#D0E7F4] border border-[#B9D9EB]/50 hover:border-[#D0E7F4] rounded-xl transition-all hover:bg-[#B9D9EB]/5 flex items-center justify-center"
              title="Connect Wallet"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </button>
          )}
          {user && solanaAddress && !isCompact && (
            <div className="px-4 py-3 bg-[#242424] rounded-xl border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">Wallet Connected</div>
              <div className="text-sm font-mono text-gray-300 truncate">
                {solanaAddress.slice(0, 6)}...{solanaAddress.slice(-6)}
              </div>
            </div>
          )}
          {user && solanaAddress && isCompact && (
            <div className="py-3 bg-[#242424] rounded-xl border border-gray-800 flex items-center justify-center" title={`Wallet: ${solanaAddress}`}>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

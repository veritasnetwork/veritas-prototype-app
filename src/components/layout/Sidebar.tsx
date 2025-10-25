'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  onCreatePost: () => void;
  isCompact?: boolean;
  viewMode?: 'read' | 'trade';
  onViewModeChange?: (mode: 'read' | 'trade') => void;
}

export function Sidebar({ onCreatePost, isCompact = false, viewMode = 'trade', onViewModeChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const { user: privyUser } = usePrivy();
  const { address: solanaAddress } = useSolanaWallet();
  const { balance: usdcBalance, loading: balanceLoading } = useUSDCBalance(solanaAddress);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  // Get wallet type from Privy
  const walletType = privyUser?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )?.walletClientType || 'embedded';

  // Detect network from RPC URL
  const isMainnet = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('mainnet');

  return (
    <aside
      className={`hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:flex lg:flex-col lg:p-4 transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCompact ? 'lg:w-28' : 'lg:w-64'}`}
      style={{ backgroundColor: '#0f0f0f', willChange: 'width' }}
    >
      {/* Bubble Container */}
      <div
        className={`flex flex-col h-full rounded-2xl shadow-lg overflow-hidden transition-[padding] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCompact ? 'p-3' : 'p-5'}`}
        style={{ backgroundColor: '#1a1a1a', willChange: 'padding' }}
      >
        {/* Logo */}
        <Link href="/feed" className={`flex items-center mb-8 hover:opacity-80 transition-all duration-1000 ${isCompact ? 'justify-center' : 'gap-3'}`}>
        <img
          src="/icons/logo.png"
          alt="Veritas Logo"
          className={`transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCompact ? 'w-12 h-12' : 'w-10 h-10'}`}
        />
        <span className={`text-white font-bold text-2xl tracking-wider font-mono transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden whitespace-nowrap ${
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

          {/* View Mode Toggle */}
          {!isCompact ? (
            <div className="space-y-2">
              <div className="bg-[#0f0f0f] rounded-xl p-1 flex gap-1">
                <button
                  onClick={() => onViewModeChange?.('read')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'read'
                      ? 'bg-[#B9D9EB] text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Read
                </button>
                <button
                  onClick={() => onViewModeChange?.('trade')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'trade'
                      ? 'bg-[#B9D9EB] text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Trade
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0f0f0f] rounded-xl p-1 flex flex-col gap-1">
              <button
                onClick={() => onViewModeChange?.('read')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'read'
                    ? 'bg-[#B9D9EB] text-black'
                    : 'text-gray-400 hover:bg-white/5'
                }`}
                title="Read Mode"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </button>
              <button
                onClick={() => onViewModeChange?.('trade')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'trade'
                    ? 'bg-[#B9D9EB] text-black'
                    : 'text-gray-400 hover:bg-white/5'
                }`}
                title="Trade Mode"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </button>
            </div>
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

        {/* Wallet & Logout - Bottom */}
        <div className="mt-auto pt-6 border-t border-gray-700/50 space-y-3">
          {user && !isCompact && (
            <>
              {/* Logout Button with Avatar */}
              <button
                onClick={logout}
                className="w-full px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-xl transition-colors flex items-center justify-center gap-3"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#B9D9EB]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#B9D9EB] font-bold text-xs">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span>Logout</span>
              </button>
            </>
          )}
          {user && isCompact && (
            <>
              {/* Logout Button with Avatar */}
              <button
                onClick={logout}
                className="w-full py-3 flex items-center justify-center gap-2 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-xl transition-colors"
                title="Logout"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#B9D9EB]/10 flex items-center justify-center">
                    <span className="text-[#B9D9EB] font-bold text-[10px]">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

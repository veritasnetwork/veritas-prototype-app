'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  onCreatePost: () => void;
  isCompact?: boolean;
  viewMode?: 'read' | 'trade';
  onViewModeChange?: (mode: 'read' | 'trade') => void;
  customControl?: React.ReactNode; // Optional custom control to replace view mode toggle
  onHowItWorks?: () => void;
}

export function Sidebar({ onCreatePost, isCompact = false, viewMode = 'trade', onViewModeChange, customControl, onHowItWorks }: SidebarProps) {
  const { user, logout } = useAuth();
  const { user: privyUser, login } = usePrivy();
  const { address: solanaAddress } = useSolanaWallet();
  const { balance: usdcBalance, loading: balanceLoading } = useUSDCBalance(solanaAddress);
  const { requireAuth } = useRequireAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  // Get wallet type from Privy
  const walletAccount = privyUser?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  ) as any;
  const walletType = walletAccount?.walletClientType || 'embedded';

  // Detect network from RPC URL
  const isMainnet = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('mainnet');

  return (
    <aside
      className={`hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:flex lg:flex-col lg:p-4 transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCompact ? 'lg:w-28' : 'lg:w-64'}`}
      style={{ backgroundColor: '#0f0f0f' }}
    >
      {/* Bubble Container */}
      <div
        className={`relative flex flex-col h-full rounded-2xl shadow-lg overflow-hidden ${isCompact ? 'p-3' : 'p-5'}`}
        style={{
          backgroundColor: '#1a1a1a',
          transition: 'padding 1000ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Logo */}
        <Link
          href={`/feed${viewMode === 'trade' ? '?mode=trade' : ''}`}
          className={`flex items-center mb-8 hover:opacity-80 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCompact ? 'justify-center gap-0 px-0' : 'gap-3'
          }`}
          style={{
            transform: isCompact ? 'scale(0.8)' : 'scale(1)',
            transformOrigin: isCompact ? 'center center' : 'left center'
          }}
        >
          <img
            src="/icons/logo.png"
            alt="Veritas Logo"
            className={`transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCompact ? 'w-10 h-10' : 'w-12 h-12'
            }`}
          />
          <span className={`text-white font-bold tracking-wider font-mono whitespace-nowrap text-2xl ${
            isCompact ? 'hidden' : 'block'
          }`}>
            VERITAS
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex-1 flex flex-col gap-2">
          {/* Feed */}
          <Link
            href={`/feed${viewMode === 'trade' ? '?mode=trade' : ''}`}
            className={`flex items-center rounded-xl transition-colors duration-300 ${
              isActive('/feed')
                ? 'bg-gray-700/50 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            } ${isCompact ? 'justify-center w-12 h-12 mx-auto' : 'px-4 gap-3 py-3'}`}
            title="Feed"
          >
            <svg className={`flex-shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCompact ? 'w-5 h-5' : 'w-5 h-5'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className={`font-medium whitespace-nowrap ${
              isCompact ? 'hidden' : 'block'
            }`}>Feed</span>
            {isActive('/feed') && !isCompact && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gray-400 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" />
            )}
          </Link>

          {/* Explore */}
          <Link
            href={`/explore${viewMode === 'trade' ? '?mode=trade' : ''}`}
            className={`flex items-center rounded-xl transition-colors duration-300 ${
              isActive('/explore')
                ? 'bg-gray-700/50 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            } ${isCompact ? 'justify-center w-12 h-12 mx-auto' : 'px-4 gap-3 py-3'}`}
            title="Explore"
          >
            <svg className={`flex-shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCompact ? 'w-5 h-5' : 'w-5 h-5'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className={`font-medium whitespace-nowrap ${
              isCompact ? 'hidden' : 'block'
            }`}>Explore</span>
            {isActive('/explore') && !isCompact && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gray-400 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" />
            )}
          </Link>

          {/* Profile or Sign In */}
          {user ? (
            <Link
              href={`/profile/${user.username}${viewMode === 'trade' ? '?mode=trade' : ''}`}
              className={`flex items-center rounded-xl transition-colors duration-300 ${
                pathname?.startsWith('/profile')
                  ? 'bg-gray-700/50 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              } ${isCompact ? 'justify-center w-12 h-12 mx-auto' : 'px-4 gap-3 py-3'}`}
              title="Profile"
            >
              <svg className={`flex-shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCompact ? 'w-5 h-5' : 'w-5 h-5'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className={`font-medium whitespace-nowrap ${
                isCompact ? 'hidden' : 'block'
              }`}>Profile</span>
              {pathname?.startsWith('/profile') && !isCompact && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gray-400 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" />
              )}
            </Link>
          ) : (
            <button
              onClick={login}
              className={`flex items-center rounded-xl transition-colors duration-300 text-gray-400 hover:text-white hover:bg-white/5 ${
                isCompact ? 'justify-center w-12 h-12 mx-auto' : 'px-4 gap-3 py-3'
              }`}
              title="Sign In"
            >
              <svg className={`flex-shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCompact ? 'w-5 h-5' : 'w-5 h-5'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span className={`font-medium whitespace-nowrap ${
                isCompact ? 'hidden' : 'block'
              }`}>Sign In</span>
            </button>
          )}

          {/* Divider */}
          <div className="py-2">
            <div className="border-t border-gray-700/50" />
          </div>

          {/* Custom Control or View Mode Toggle */}
          {customControl ? (
            customControl
          ) : (
            <div
              className={`relative bg-[#0f0f0f] ${
                isCompact ? 'flex flex-col items-center h-[72px] rounded-full p-0.5 mx-auto w-10' : 'flex flex-row h-[30px] rounded-full p-0.5'
              }`}
            >
              {/* Animated background slider - muted colors */}
              <div
                className={`absolute bg-gray-700/50 transition-transform duration-300 ease-out ${
                  isCompact
                    ? 'left-0.5 right-0.5 h-[35px] rounded-full'
                    : 'top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full'
                }`}
                style={{
                  transform: isCompact
                    ? viewMode === 'read' ? 'translateY(0)' : 'translateY(calc(100% + 2px))'
                    : viewMode === 'read' ? 'translateX(0)' : 'translateX(calc(100% + 2px))',
                  willChange: 'transform'
                }}
              />

              {/* Read Button - always first, fixed position */}
              <button
                onClick={() => onViewModeChange?.('read')}
                className={`relative z-10 text-xs font-medium flex items-center justify-center transition-none ${
                  viewMode === 'read'
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                } ${isCompact ? 'w-full h-[35px] rounded-full' : 'flex-1 px-3.5 py-1 gap-1.5 rounded-full'}`}
                style={{
                  flexShrink: 0
                }}
                title="Read Mode"
              >
                <svg className={`flex-shrink-0 ${
                  isCompact ? 'w-4 h-4' : 'w-3.5 h-3.5'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {!isCompact && <span className="font-semibold">Read</span>}
              </button>

              {/* Gap between buttons - fixed size */}
              <div className={isCompact ? 'h-0.5 flex-shrink-0' : 'w-0.5 flex-shrink-0'}></div>

              {/* Trade Button - always second, fixed position */}
              <button
                onClick={() => onViewModeChange?.('trade')}
                className={`relative z-10 text-xs font-medium flex items-center justify-center transition-none ${
                  viewMode === 'trade'
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                } ${isCompact ? 'w-full h-[35px] rounded-full' : 'flex-1 px-3.5 py-1 gap-1.5 rounded-full'}`}
                style={{
                  flexShrink: 0
                }}
                title="Trade Mode"
              >
                <svg className={`flex-shrink-0 ${
                  isCompact ? 'w-4 h-4' : 'w-3.5 h-3.5'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {!isCompact && <span className="font-semibold">Trade</span>}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="py-2">
            <div className="border-t border-gray-700/50" />
          </div>

          {/* Create Post Button */}
          <button
            onClick={async () => {
              const isAuthed = await requireAuth();
              if (isAuthed) {
                onCreatePost();
              }
            }}
            className={`flex items-center bg-[#B9D9EB] text-black font-semibold hover:bg-[#D0E7F4] transition-colors duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-md ${
              isCompact
                ? 'justify-center w-14 h-14 mx-auto rounded-full'
                : 'justify-center w-full px-4 gap-3 py-3 rounded-xl'
            }`}
            title="Create Post"
          >
            <svg className={`flex-shrink-0 ${
              isCompact ? 'w-6 h-6' : 'w-5 h-5'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className={`whitespace-nowrap font-bold ${
              isCompact ? 'hidden' : 'block text-base'
            }`}>Create Post</span>
          </button>

          {/* Divider */}
          <div className="py-2">
            <div className="border-t border-gray-700/50" />
          </div>

          {/* How It Works Button */}
          {onHowItWorks && (
            <button
              onClick={onHowItWorks}
              className={`flex items-center text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors duration-300 ${
                isCompact ? 'justify-center w-12 h-12 mx-auto' : 'px-4 gap-3 py-3'
              }`}
              title="How It Works"
            >
              <svg className={`flex-shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCompact ? 'w-5 h-5' : 'w-5 h-5'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`font-medium whitespace-nowrap ${
                isCompact ? 'hidden' : 'block'
              }`}>How It Works</span>
            </button>
          )}
        </nav>

        {/* Wallet & Logout - Bottom */}
        <div className={`mt-auto pt-6 border-t border-gray-700/50 flex ${isCompact ? 'justify-center' : 'justify-start'}`}>
          {user && (
            <button
              onClick={logout}
              className={`text-sm font-medium text-gray-400 hover:text-white border border-[#F5F5DC]/20 hover:border-[#F5F5DC]/30 rounded-xl transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center group ${
                isCompact ? 'justify-center w-14 h-14 p-0' : 'justify-center w-full px-4 py-2 gap-3'
              }`}
              style={{
                transform: isCompact ? 'scale(1)' : 'scale(1)',
                transformOrigin: 'center center'
              }}
              title="Logout"
            >
              <div className="w-6 h-6 rounded-full bg-[#F5F5DC] border border-gray-600/20 group-hover:border-gray-400/30 flex items-center justify-center flex-shrink-0 transition-colors">
                <svg className="w-3 h-3 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className={`whitespace-nowrap ${
                isCompact ? 'hidden' : 'block'
              }`}>Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

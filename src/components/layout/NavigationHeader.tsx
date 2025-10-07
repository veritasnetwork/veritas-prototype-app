'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import Link from 'next/link';

export function NavigationHeader() {
  const { user, logout } = useAuth();
  const { linkWallet } = usePrivy();
  const { address: solanaAddress } = useSolanaWallet();

  return (
    <header className="sticky top-0 z-sticky h-16 bg-bg-primary/80 backdrop-blur-md border-b border-border">
      <div className="max-w-feed mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src="/icons/logo.png"
            alt="Veritas Logo"
            className="w-8 h-8"
          />
          <span className="text-text-primary font-bold text-xl tracking-wider font-mono">
            VERITAS
          </span>
        </Link>

        {/* Wallet & Profile Buttons */}
        <div className="flex items-center gap-3">
          {user && !solanaAddress && (
            <button
              onClick={linkWallet}
              className="px-4 py-2 text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark rounded-lg transition-colors"
              aria-label="Link Phantom Wallet"
            >
              Link Phantom Wallet
            </button>
          )}
          {user && solanaAddress && (
            <div className="px-3 py-1.5 text-xs font-mono text-text-secondary bg-bg-hover rounded-lg">
              {solanaAddress.slice(0, 4)}...{solanaAddress.slice(-4)}
            </div>
          )}
          {user && (
            <Link
              href={`/profile/${user.username}`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
              aria-label="View Profile"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

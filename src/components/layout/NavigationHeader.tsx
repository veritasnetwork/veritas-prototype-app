'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { FundWalletButton } from '@/components/wallet/FundWalletButton';
import Link from 'next/link';

export function NavigationHeader() {
  const { user, logout } = useAuth();
  const { linkWallet } = usePrivy();
  const { address: solanaAddress } = useSolanaWallet();

  return (
    <header className="sticky top-0 z-sticky h-14 bg-[#1a1a1a]/95 backdrop-blur-md border-b border-gray-800">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img
            src="/icons/logo.png"
            alt="Veritas Logo"
            className="w-7 h-7"
          />
          <span className="text-white font-bold text-lg tracking-wider font-mono">
            VERITAS
          </span>
        </Link>

        {/* Wallet Status (Simplified) */}
        <div className="flex items-center gap-2">
          {user && !solanaAddress && (
            <button
              onClick={linkWallet}
              className="px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
              aria-label="Connect Wallet"
            >
              Connect
            </button>
          )}
          {user && solanaAddress && (
            <>
              <div className="px-2 py-1 text-xs font-mono text-gray-400 bg-gray-900 rounded">
                {solanaAddress.slice(0, 4)}...{solanaAddress.slice(-4)}
              </div>
              <FundWalletButton variant="compact" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * FundWalletButton Component
 * Allows users to fund their Solana wallet via Privy's funding flow
 * Supports MoonPay, Coinbase Onramp, and cross-chain bridging
 */

'use client';

import { useFundWallet } from '@privy-io/react-auth/solana';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { Wallet } from 'lucide-react';
import { useState } from 'react';

interface FundWalletButtonProps {
  /** Display style: 'full' for text button, 'icon' for icon only */
  variant?: 'full' | 'icon' | 'compact';
  /** Custom className for styling */
  className?: string;
}

export function FundWalletButton({ variant = 'full', className = '' }: FundWalletButtonProps) {
  const { fundWallet } = useFundWallet();
  const { address } = useSolanaWallet();
  const [isFunding, setIsFunding] = useState(false);

  const handleFundWallet = async () => {
    if (!address) return;

    setIsFunding(true);
    try {
      await fundWallet(address, {
        cluster: { name: 'mainnet-beta' }, // or 'devnet' for testing
      });
    } catch (error) {
      console.error('Funding flow error:', error);
    } finally {
      setIsFunding(false);
    }
  };

  // Don't render if no wallet connected
  if (!address) return null;

  if (variant === 'icon') {
    return (
      <button
        onClick={handleFundWallet}
        disabled={isFunding}
        className={`p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        aria-label="Fund wallet"
        title="Fund wallet"
      >
        <Wallet className="w-5 h-5" />
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleFundWallet}
        disabled={isFunding}
        className={`px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${className}`}
        aria-label="Fund wallet"
      >
        <Wallet className="w-3.5 h-3.5" />
        {isFunding ? 'Opening...' : 'Fund'}
      </button>
    );
  }

  return (
    <button
      onClick={handleFundWallet}
      disabled={isFunding}
      className={`w-full px-4 py-2.5 bg-[#B9D9EB] hover:bg-[#B9D9EB]/90 text-[#0C1D51] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      aria-label="Fund wallet"
    >
      <Wallet className="w-4 h-4" />
      {isFunding ? 'Opening...' : 'Fund Wallet'}
    </button>
  );
}

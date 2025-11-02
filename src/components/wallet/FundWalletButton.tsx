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
  /** Currency to fund (only used with 'compact' variant) */
  currency?: 'SOL' | 'USDC';
}

export function FundWalletButton({ variant = 'full', className = '', currency = 'USDC' }: FundWalletButtonProps) {
  const { fundWallet } = useFundWallet();
  const { address } = useSolanaWallet();
  const [isFunding, setIsFunding] = useState(false);

  const handleFundWallet = async (curr?: 'SOL' | 'USDC') => {
    if (!address) return;

    const fundingCurrency = curr || currency;
    setIsFunding(true);
    try {
      // MoonPay currency codes: 'sol' for SOL, 'usdc' for USDC on Solana
      // The suffix '_sol' indicates the network, but MoonPay uses just 'usdc' for Solana USDC
      await fundWallet(address, {
        cluster: { name: 'mainnet-beta' },
        token: fundingCurrency === 'USDC' ? 'usdc' : undefined, // Specify USDC token instead of SOL
      } as any);
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
        onClick={() => handleFundWallet()}
        disabled={isFunding}
        className={`p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default ${className}`}
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
        onClick={() => handleFundWallet()}
        disabled={isFunding}
        className={`text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1 rounded-md border border-[#2a2a2a] hover:border-gray-400 disabled:opacity-50 disabled:cursor-default whitespace-nowrap ${className}`}
        aria-label={`Add ${currency}`}
      >
        {isFunding ? 'Opening...' : 'Add'}
      </button>
    );
  }

  return (
    <div className={`w-full space-y-2 ${className}`}>
      <button
        onClick={() => handleFundWallet('USDC')}
        disabled={isFunding}
        className="w-full px-4 py-2.5 bg-[#B9D9EB] hover:bg-[#B9D9EB]/90 text-[#0C1D51] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-2"
        aria-label="Add USDC"
      >
        <Wallet className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-center">{isFunding ? 'Opening...' : 'Add USDC'}</span>
        <div className="w-4 h-4 flex-shrink-0"></div>
      </button>
      <button
        onClick={() => handleFundWallet('SOL')}
        disabled={isFunding}
        className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-2 border border-[#2a2a2a]"
        aria-label="Add SOL"
      >
        <Wallet className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-center">{isFunding ? 'Opening...' : 'Add SOL'}</span>
        <div className="w-4 h-4 flex-shrink-0"></div>
      </button>
    </div>
  );
}

/**
 * ManageWalletButton Component
 * Opens Privy's wallet management UI for exporting keys, viewing balances, etc.
 */

'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Settings } from 'lucide-react';
import { useState } from 'react';

interface ManageWalletButtonProps {
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
}

export function ManageWalletButton({ variant = 'full', className = '' }: ManageWalletButtonProps) {
  const { exportWallet, user } = usePrivy();
  const [isExporting, setIsExporting] = useState(false);

  // Check if user has a Privy embedded wallet (not an external wallet like Phantom)
  const embeddedWallet = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
  );

  // Don't render anything for external wallet users (they manage their wallet in Phantom/etc)
  if (!embeddedWallet) {
    return null;
  }

  const handleManageWallet = async () => {
    setIsExporting(true);
    try {
      await exportWallet();
    } catch (error) {
      console.error('Wallet management error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleManageWallet}
        disabled={isExporting}
        className={`p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default ${className}`}
        aria-label="Manage wallet"
        title="Manage wallet"
      >
        <Settings className="w-5 h-5" />
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleManageWallet}
        disabled={isExporting}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default whitespace-nowrap bg-white/5 hover:bg-white/10 text-gray-300 border border-[#2a2a2a] flex items-center gap-2 ${className}`}
        aria-label="Manage Wallet"
      >
        <Settings className="w-4 h-4" />
        {isExporting ? 'Opening...' : 'Manage Wallet'}
      </button>
    );
  }

  return (
    <button
      onClick={handleManageWallet}
      disabled={isExporting}
      className={`w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-2 border border-[#2a2a2a] ${className}`}
      aria-label="Manage Wallet"
    >
      <Settings className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-center">{isExporting ? 'Opening...' : 'Manage Wallet'}</span>
      <div className="w-4 h-4 flex-shrink-0"></div>
    </button>
  );
}

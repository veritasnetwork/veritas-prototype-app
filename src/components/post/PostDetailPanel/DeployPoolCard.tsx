/**
 * DeployPoolCard Component
 * Single-transaction pool deployment with initial liquidity
 * Combines create_pool + deploy_market into one atomic operation
 */

'use client';

import { useState } from 'react';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useDeployPool } from '@/hooks/useDeployPool';
import { useConnectWallet } from '@/hooks/usePrivyHooks';
import { Rocket, AlertCircle, Info } from 'lucide-react';

interface DeployPoolCardProps {
  postId: string;
  onDeploySuccess?: () => void;
}

export function DeployPoolCard({ postId, onDeploySuccess }: DeployPoolCardProps) {
  const { address, isConnected, isLoading: walletLoading, needsReconnection } = useSolanaWallet();
  const { deployPool, isDeploying, error: deployError } = useDeployPool();
  const { connectWallet } = useConnectWallet();

  const [error, setError] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  // Form state
  const initialDeposit = 50; // Hardcoded to $50
  const [longAllocationPercent, setLongAllocationPercent] = useState<number>(50);

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setError(null);
    try {
      console.log('[DeployPoolCard] Opening Privy wallet modal...');
      await connectWallet();
      console.log('[DeployPoolCard] Wallet connection flow completed');
      // useSolanaWallet hook will automatically detect the connected wallet
    } catch (err: any) {
      console.error('[DeployPoolCard] Wallet connection error:', err);
      if (err?.message?.includes('cancel') || err?.message?.includes('user_exited')) {
        setError('Wallet connection cancelled.');
      } else {
        setError(`Failed to connect wallet: ${err?.message || 'Unknown error'}.`);
      }
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDeployPool = async () => {
    if (needsReconnection || !address || !isConnected) {
      setError('Wallet not connected. Click "Connect Wallet" below.');
      return;
    }

    if (walletLoading) {
      setError('Wallet is still initializing. Please wait...');
      return;
    }

    if (initialDeposit < 50) {
      setError('Minimum deposit is 50 USDC');
      return;
    }

    setError(null);

    try {
      const result = await deployPool({
        postId,
        initialDeposit,
        longAllocationPercent,
      });

      if (result) {
        console.log('[DeployPoolCard] Pool deployed successfully:', result);
        if (onDeploySuccess) {
          onDeploySuccess();
        }
      } else if (deployError) {
        setError(deployError);
      }
    } catch (err) {
      console.error('[DeployPoolCard] Deployment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to deploy pool';

      // If wallet signing failed, suggest refresh
      if (errorMessage.includes('not ready for signing')) {
        setError('Wallet not ready. Please refresh the page and try again.');
      } else {
        setError(errorMessage);
      }
    }
  };

  // Calculate short allocation for display
  const shortAllocationPercent = 100 - longAllocationPercent;

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
      <div className="flex flex-col gap-4">
        {/* Compact Form */}
        <div className="space-y-3">
          {/* Initial Relevance - Compact */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Initial Relevance</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#B9D9EB]">{longAllocationPercent}%</span>
              </div>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="1"
              value={longAllocationPercent}
              onChange={(e) => setLongAllocationPercent(Number(e.target.value))}
              disabled={isDeploying}
              className="w-full accent-[#B9D9EB] h-1"
            />
          </div>
        </div>

        {/* Deploy Button OR Connect Wallet Button */}
        {needsReconnection || (!isConnected && !walletLoading) ? (
          <div className="space-y-2">
            <button
              onClick={handleConnectWallet}
              disabled={isConnectingWallet}
              className="w-full px-4 py-2.5 bg-[#B9D9EB] text-[#0C1D51] rounded-lg font-medium hover:bg-[#D0E7F4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isConnectingWallet ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-[#0C1D51] border-t-transparent rounded-full"></div>
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Connect Wallet</span>
              )}
            </button>
            <p className="text-[10px] text-gray-500 text-center">
              Click to connect your Phantom wallet or create a new embedded wallet
            </p>
          </div>
        ) : (
          <button
            onClick={handleDeployPool}
            disabled={isDeploying || !isConnected || walletLoading}
            className="w-full px-4 py-2.5 bg-[#B9D9EB] text-[#0C1D51] rounded-lg font-medium hover:bg-[#D0E7F4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {isDeploying ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-[#0C1D51] border-t-transparent rounded-full"></div>
                <span>Deploying...</span>
              </>
            ) : walletLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-[#0C1D51] border-t-transparent rounded-full"></div>
                <span>Initializing wallet...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Deploy Market ($50)</span>
              </>
            )}
          </button>
        )}

        {/* Redeemable Info */}
        <div className="flex items-center justify-center text-xs group relative min-h-[48px] px-4 rounded-lg transition-all">
          <div className="flex items-center gap-1.5 group-hover:opacity-0 transition-opacity">
            <Info className="w-3.5 h-3.5 text-[#B9D9EB] flex-shrink-0" />
            <span className="text-gray-400 whitespace-nowrap">Liquidity is redeemable</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-all absolute inset-0 flex items-center justify-center px-4 text-gray-300 pointer-events-none leading-relaxed text-center border border-[#B9D9EB]/30 rounded-lg shadow-[0_0_20px_rgba(185,217,235,0.15)] bg-[#1a1a1a]">
            You'll receive tradeable LONG/SHORT tokens worth $50 that can be sold back anytime.
          </div>
        </div>

        {/* Error Message */}
        {(error || deployError) && (
          <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p>{error || deployError}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

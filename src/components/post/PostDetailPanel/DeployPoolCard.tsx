/**
 * DeployPoolCard Component
 * Single-transaction pool deployment with initial liquidity
 * Combines create_pool + deploy_market into one atomic operation
 */

'use client';

import { useState } from 'react';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useDeployPool } from '@/hooks/useDeployPool';
import { usePoolAddresses } from '@/hooks/usePoolAddresses';
import { useConnectWallet } from '@/hooks/usePrivyHooks';
import { Rocket, AlertCircle, DollarSign, Info } from 'lucide-react';

interface DeployPoolCardProps {
  postId: string;
  onDeploySuccess?: () => void;
}

export function DeployPoolCard({ postId, onDeploySuccess }: DeployPoolCardProps) {
  const { address, isConnected, isLoading: walletLoading, needsReconnection } = useSolanaWallet();
  const { deployPool, isDeploying, error: deployError } = useDeployPool();
  const poolAddresses = usePoolAddresses(postId);
  const { connectWallet } = useConnectWallet();

  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  // Form state
  const [initialDeposit, setInitialDeposit] = useState<number>(110);
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

    if (initialDeposit < 110) {
      setError('Minimum deposit is 110 USDC');
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
        {/* Compact Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#B9D9EB]/10 flex items-center justify-center flex-shrink-0">
            <Rocket className="w-5 h-5 text-[#B9D9EB]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Deploy Market</h3>
            <p className="text-xs text-gray-500">Add liquidity to enable trading</p>
          </div>
        </div>

        {/* Compact Form */}
        <div className="space-y-3">
          {/* Amount Input - Inline */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400 whitespace-nowrap">Amount</label>
            <div className="flex-1">
              <input
                type="number"
                min="110"
                max="10000"
                step="10"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(Number(e.target.value))}
                disabled={isDeploying}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-[#B9D9EB] disabled:opacity-50"
                placeholder="110 USDC min"
              />
            </div>
          </div>

          {/* LONG/SHORT Split - Compact */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Initial Split</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-green-500">{longAllocationPercent}% LONG</span>
                <span className="text-gray-600">/</span>
                <span className="text-sm font-medium text-red-500">{shortAllocationPercent}% SHORT</span>
              </div>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={longAllocationPercent}
              onChange={(e) => setLongAllocationPercent(Number(e.target.value))}
              disabled={isDeploying}
              className="w-full accent-[#B9D9EB] h-1"
            />
          </div>

          {/* Advanced Info Toggle */}
          {showAdvanced && (
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">USDC allocation (LONG)</span>
                <span className="text-white">{(initialDeposit * longAllocationPercent / 100).toFixed(0)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">USDC allocation (SHORT)</span>
                <span className="text-white">{(initialDeposit * shortAllocationPercent / 100).toFixed(0)} USDC</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600 mt-2">
                <Info className="w-3 h-3" />
                <span className="text-[10px]">Token amounts calculated via ICBS bonding curve at 0.1 USDC/token initial price</span>
              </div>
              {poolAddresses && (
                <>
                  <div className="border-t border-[#2a2a2a] pt-2 mt-2">
                    <div className="text-gray-600 mb-1">Addresses</div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pool</span>
                    <span className="text-gray-400 font-mono">{poolAddresses.pool.slice(0, 6)}...{poolAddresses.pool.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">LONG</span>
                    <span className="text-gray-400 font-mono">{poolAddresses.longMint.slice(0, 6)}...{poolAddresses.longMint.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SHORT</span>
                    <span className="text-gray-400 font-mono">{poolAddresses.shortMint.slice(0, 6)}...{poolAddresses.shortMint.slice(-4)}</span>
                  </div>
                </>
              )}
            </div>
          )}
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
            disabled={isDeploying || !isConnected || walletLoading || initialDeposit < 110}
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
                <span>Deploy with {initialDeposit} USDC</span>
              </>
            )}
          </button>
        )}

        {/* Toggle Advanced */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-gray-500 hover:text-[#B9D9EB] transition-colors text-center -mt-2"
        >
          {showAdvanced ? '− Less' : '+ More details'}
        </button>

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

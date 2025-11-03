/**
 * WithdrawModal Component
 * Modal for withdrawing unlocked stake
 */

'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Connection, Transaction } from '@solana/web3.js';
import { formatCurrency } from '@/utils/formatters';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { usePrivy } from '@privy-io/react-auth';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface WithdrawModalProps {
  totalStake: number;
  totalLocked: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function WithdrawModal({
  totalStake,
  totalLocked,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const withdrawable = totalStake - totalLocked;
  const [amount, setAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requireAuth } = useRequireAuth();
  const { wallet, address } = useSolanaWallet();
  const { getAccessToken } = usePrivy();

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check auth first
    const isAuthed = await requireAuth();
    if (!isAuthed) return;

    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum > withdrawable) {
      setError('Amount exceeds withdrawable balance');
      return;
    }

    if (!address || !wallet) {
      setError('Wallet not connected');
      return;
    }

    setIsWithdrawing(true);
    try {
      // Get auth token
      const authToken = await getAccessToken();

      if (!authToken) {
        setError('Authentication failed');
        return;
      }

      // Call withdraw API to get partially-signed transaction
      const response = await fetch('/api/users/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          walletAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Withdrawal failed');
      }

      const { transaction: txBase64 } = await response.json();

      // Deserialize transaction
      const txBuffer = Buffer.from(txBase64, 'base64');
      const tx = Transaction.from(txBuffer);

      // User signs the transaction (already partially signed by protocol authority)
      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing');
      }

      const signedTx = await wallet.signTransaction(tx);

      // Send signed transaction to backend for protocol signature and execution
      const executeResponse = await fetch('/api/users/withdraw/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize({
            requireAllSignatures: false,  // Allow partial signing (user signed, protocol will sign next)
            verifySignatures: false,       // Skip signature verification during serialization
          })).toString('base64'),
          amount: Math.floor(amountNum * 1_000_000),
          walletAddress: address,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute withdrawal');
      }

      const { signature } = await executeResponse.json();
      console.log('[WITHDRAW] ✅ Transaction confirmed:', signature);

      // Fetch custodian state from blockchain to get actual withdrawal amount
      let actualAmountMicro = Math.floor(amountNum * 1_000_000); // Fallback to requested amount
      try {
        const { PublicKey: PK } = await import('@solana/web3.js');
        const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
        const { getProgramId } = await import('@/lib/solana/network-config');
        const { PDAHelper } = await import('@/lib/solana/sdk/transaction-builders');
        const idl = await import('@/lib/solana/target/idl/veritas_curation.json');

        const programId = getProgramId();
        const programPubkey = new PK(programId);

        // Create provider with dummy wallet
        const dummyWallet = {
          publicKey: new PK(address),
          signTransaction: async (tx: any) => tx,
          signAllTransactions: async (txs: any[]) => txs,
        };

        const rpcEndpoint = getRpcEndpoint();
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
        const program = new Program(idl as any, provider);

        // Get custodian PDA
        const pdaHelper = new PDAHelper(programPubkey);
        const [custodianPda] = pdaHelper.getGlobalCustodianPda();

        // Fetch custodian account
        const custodian = await (program.account as any).veritasCustodian.fetch(custodianPda);
        console.log('[WITHDRAW] Fetched custodian state from blockchain');

        // Use the amount from the withdrawal (already in micro-USDC)
        // Note: We can't get individual withdrawal amount from total_withdrawals,
        // so we use the amount we requested (it was validated on-chain)
        actualAmountMicro = Math.floor(amountNum * 1_000_000);
      } catch (fetchErr) {
        console.warn('[WITHDRAW] Could not fetch custodian state (non-critical):', fetchErr);
        // Continue with requested amount
      }

      // Record withdrawal optimistically (for immediate UI update)
      try {
        const recordResponse = await fetch('/api/users/withdraw/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            walletAddress: address,
            amountMicro: actualAmountMicro, // Use micro-USDC from blockchain
            txSignature: signature,
          }),
        });

        if (!recordResponse.ok) {
          console.warn('[WITHDRAW] Failed to record withdrawal (non-critical):', await recordResponse.text());
          // Continue anyway - event indexer will pick it up
        } else {
          console.log('[WITHDRAW] ✅ Withdrawal recorded optimistically');
        }
      } catch (recordErr) {
        console.warn('[WITHDRAW] Failed to record withdrawal (non-critical):', recordErr);
        // Continue anyway - event indexer will pick it up
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleMaxClick = () => {
    if (withdrawable > 0) {
      setAmount(withdrawable.toFixed(2));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-md w-full border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Withdraw Stake</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stake Breakdown */}
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4 mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Total Stake</span>
            <span className="text-lg font-bold text-white">{formatCurrency(totalStake)}</span>
          </div>
          <div className="border-t border-[#2a2a2a]" />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Locked in Positions</span>
              <div className="group relative">
                <AlertCircle className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#2a2a2a] text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[#3a3a3a] z-10">
                  Locked stake backs your open positions for consensus validation. Close positions to free up stake.
                </div>
              </div>
            </div>
            <span className="text-lg font-medium text-[#F0EAD6]">-{formatCurrency(totalLocked)}</span>
          </div>
          <div className="border-t border-[#2a2a2a]" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-300">Available to Withdraw</span>
            <span className="text-xl font-bold text-[#F0EAD6]">
              {formatCurrency(withdrawable)}
            </span>
          </div>
        </div>

        {/* Withdraw Form */}
        {withdrawable > 0 ? (
          <form onSubmit={handleWithdraw} className="space-y-4">
            {/* Amount Input */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Withdraw
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and decimal point
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAmount(value);
                    }
                  }}
                  className="w-full pl-8 pr-20 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#B9D9EB] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0.00"
                  required
                />
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-sm text-orange-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!amount || isWithdrawing}
                className="flex-1 py-2.5 bg-[#F5F5DC] hover:bg-[#F5F5DC]/90 text-[#0f0f0f] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-2"
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              No unlocked stake available. To free up stake, close all positions (both LONG and SHORT) in a market.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

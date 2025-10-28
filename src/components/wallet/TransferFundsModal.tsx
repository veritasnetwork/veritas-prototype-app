/**
 * TransferFundsModal Component
 * Allows users to send SOL or USDC from their Privy embedded wallet to an external address
 */

'use client';

import { useState } from 'react';
import { X, ArrowUpRight, AlertCircle } from 'lucide-react';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { getRpcEndpoint, getUsdcMint } from '@/lib/solana/network-config';

interface TransferFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  solBalance: number;
  usdcBalance: number;
  onSuccess?: () => void;
}

type Currency = 'SOL' | 'USDC';

export function TransferFundsModal({
  isOpen,
  onClose,
  solBalance,
  usdcBalance,
  onSuccess,
}: TransferFundsModalProps) {
  const [currency, setCurrency] = useState<Currency>('USDC');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const { wallet, address } = useSolanaWallet();

  const maxAmount = currency === 'SOL' ? solBalance : usdcBalance;

  const handleMaxClick = () => {
    if (currency === 'SOL') {
      // Reserve 0.01 SOL for transaction fees
      const maxSendable = Math.max(0, solBalance - 0.01);
      setAmount(maxSendable.toFixed(6));
    } else {
      setAmount(usdcBalance.toFixed(2));
    }
  };

  const handleSend = async () => {
    setError(null);
    setTxSignature(null);

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (transferAmount > maxAmount) {
      setError(`Insufficient ${currency} balance`);
      return;
    }

    if (currency === 'SOL' && transferAmount > solBalance - 0.01) {
      setError('Please reserve at least 0.01 SOL for transaction fees');
      return;
    }

    // Validate recipient address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (err) {
      setError('Invalid Solana address');
      return;
    }

    if (!address) {
      setError('Wallet not connected');
      return;
    }

    setIsSending(true);

    try {
      const rpcEndpoint = getRpcEndpoint();
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const senderPubkey = new PublicKey(address);

      // Get wallet from useSolanaWallet hook (works for both embedded and external wallets)
      if (!wallet || !wallet.signTransaction) {
        throw new Error('Wallet not available');
      }

      if (currency === 'SOL') {
        // Send SOL
        const lamports = Math.floor(transferAmount * 1e9);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: recipientPubkey,
            lamports,
          })
        );

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;

        // Sign with wallet (works for both embedded and external wallets like Phantom)
        const signedTx = await wallet.signTransaction(transaction);

        // Send transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        setTxSignature(signature);
      } else {
        // Send USDC (SPL Token)
        const usdcMint = getUsdcMint();
        const microUsdc = Math.floor(transferAmount * 1e6); // USDC has 6 decimals

        // Get token accounts
        const senderTokenAccount = await getAssociatedTokenAddress(usdcMint, senderPubkey);
        const recipientTokenAccount = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

        // Check if recipient token account exists
        const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);

        const transaction = new Transaction();

        // If recipient token account doesn't exist, we'll need to create it
        // For now, we'll assume it exists or let the transaction fail with a helpful error
        if (!recipientAccountInfo) {
          throw new Error(
            'Recipient does not have a USDC token account. They need to create one first by receiving USDC or creating it manually.'
          );
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            senderTokenAccount,
            recipientTokenAccount,
            senderPubkey,
            microUsdc
          )
        );

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;

        // Sign with wallet (works for both embedded and external wallets like Phantom)
        const signedTx = await wallet.signTransaction(transaction);

        // Send transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        setTxSignature(signature);
      }

      // Reset form
      setRecipientAddress('');
      setAmount('');

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Send error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Send failed';
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-white text-xl font-bold font-mono mb-1">
              Send Funds
            </h2>
            <p className="text-gray-400 text-sm">
              Send {currency} to an external wallet
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Message */}
        {txSignature && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 text-sm mb-2">Sent successfully!</p>
            <a
              href={`https://explorer.solana.com/tx/${txSignature}${getRpcEndpoint().includes('localhost') ? '?cluster=custom' : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-400 hover:text-green-300 underline break-all"
            >
              View transaction
            </a>
          </div>
        )}

        {/* Currency Toggle */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Currency
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrency('USDC')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                currency === 'USDC'
                  ? 'bg-[#B9D9EB] text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              USDC
            </button>
            <button
              onClick={() => setCurrency('SOL')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                currency === 'SOL'
                  ? 'bg-[#9945FF] text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              SOL
            </button>
          </div>
        </div>

        {/* Recipient Address */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="Enter Solana address"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#B9D9EB]/50 font-mono text-sm"
            disabled={isSending}
          />
        </div>

        {/* Amount */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-gray-300 text-sm font-medium">
              Amount
            </label>
            <span className="text-xs text-gray-400">
              Balance: {currency === 'SOL' ? solBalance.toFixed(6) : usdcBalance.toFixed(2)} {currency}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step={currency === 'SOL' ? '0.000001' : '0.01'}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#B9D9EB]/50"
              disabled={isSending}
            />
            <button
              onClick={handleMaxClick}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-medium text-white transition-colors"
              disabled={isSending}
            >
              MAX
            </button>
          </div>
          {/* Fixed height hint area to prevent modal from jumping */}
          <div className="h-5 mt-1">
            {currency === 'SOL' && (
              <p className="text-xs text-gray-500">
                Reserve 0.01 SOL for transaction fees
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-orange-400">{error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 px-4 py-2.5 text-gray-400 hover:text-white font-medium rounded-lg transition-colors border border-gray-700 hover:border-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !recipientAddress || !amount}
            className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-2 ${
              currency === 'USDC'
                ? 'bg-[#B9D9EB] hover:bg-[#a3cfe3] text-black'
                : 'bg-[#9945FF] hover:bg-[#8839ee] text-white'
            }`}
          >
            {isSending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

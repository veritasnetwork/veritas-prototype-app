'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/providers/AuthProvider';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { Connection } from '@solana/web3.js';
import { buildCreatePoolTransaction } from '@/lib/solana/pool-transaction';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const { getAccessToken } = usePrivy();
  const { user } = useAuth();
  const { wallet, address: solanaAddress } = useSolanaWallet();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [duration, setDuration] = useState(48);
  const [belief, setBelief] = useState(50);
  const [metaBelief, setMetaBelief] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolConfig, setPoolConfig] = useState<{
    k_quadratic: number;
    reserve_cap: number;
    linear_slope: number;
    virtual_liquidity: number;
    supply_offset: number;
  } | null>(null);

  // Fetch pool config on mount
  useEffect(() => {
    fetch('/api/config/pool')
      .then(res => res.json())
      .then(config => setPoolConfig(config))
      .catch(err => console.error('Failed to fetch pool config:', err));
  }, []);

  // Debug: Log wallet status on mount and when it changes
  useEffect(() => {
    console.log('Wallet debug:', {
      wallet,
      solanaAddress,
      isConnected: !!wallet,
    });
  }, [wallet, solanaAddress]);

  // Trap focus and handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handleCmdEnter = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleCmdEnter);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleCmdEnter);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, title, content]);

  const handleClose = () => {
    if ((title || content) && !isSubmitting) {
      if (!confirm('Discard post?')) return;
    }
    setTitle('');
    setContent('');
    setDuration(48);
    setBelief(50);
    setMetaBelief(50);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit called');
    console.log('Title:', title.trim());
    console.log('Content:', content.trim());
    console.log('User:', user);
    console.log('Wallet:', wallet);
    console.log('Solana Address:', solanaAddress);

    if (!title.trim() || !content.trim()) {
      console.log('❌ Validation failed: title or content empty');
      return;
    }
    if (isSubmitting) {
      console.log('❌ Already submitting');
      return;
    }
    if (!user) {
      console.log('❌ No user');
      setError('Please log in to create a post');
      return;
    }
    if (!solanaAddress || !wallet) {
      console.log('❌ No wallet or solana address');
      setError('Please connect your Solana wallet');
      return;
    }

    console.log('✅ All validations passed, starting submission...');
    setIsSubmitting(true);
    setError(null);

    let createdPostId: string | null = null;
    let createdBeliefId: string | null = null;

    try {
      // Step 1: Get Privy auth token
      console.log('📝 Step 1: Getting Privy auth token...');
      const jwt = await getAccessToken();
      if (!jwt) {
        throw new Error('Please log in to create a post');
      }
      console.log('✅ Got JWT token');

      // Step 2: Build Solana transaction FIRST (before creating post)
      console.log('🔨 Step 2: Building Solana transaction...');
      const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;
      const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

      console.log('Program ID:', programId);
      console.log('RPC Endpoint:', rpcEndpoint);

      if (!programId) {
        throw new Error('Solana program not configured');
      }

      // Generate a temporary post ID for PDA derivation
      // We'll use this to derive the pool address before creating the post
      const tempPostId = window.crypto.randomUUID();
      console.log('Generated temp post ID:', tempPostId);

      const connection = new Connection(rpcEndpoint, 'confirmed');
      console.log('Created connection to Solana');

      console.log('Building transaction with params:', {
        creator: solanaAddress,
        postId: tempPostId,
        programId,
      });

      const transaction = await buildCreatePoolTransaction({
        connection,
        creator: solanaAddress,
        postId: tempPostId,
        kQuadratic: poolConfig?.k_quadratic ?? 1,
        reserveCap: poolConfig?.reserve_cap ?? 5_000_000_000,
        linearSlope: poolConfig?.linear_slope ?? 1_000_000_000_000,
        virtualLiquidity: poolConfig?.virtual_liquidity ?? 1_000_000_000,
        supplyOffset: poolConfig?.supply_offset ?? 10_000,
        programId,
      });
      console.log('✅ Transaction built successfully');

      // Step 3: Sign and send transaction via Privy (user can cancel here)
      console.log('🖊️ Step 3: Signing transaction...');
      console.log('Wallet object:', wallet);
      console.log('Has signTransaction?', wallet && 'signTransaction' in wallet);

      if (!wallet || !('signTransaction' in wallet)) {
        throw new Error('Wallet does not support signing transactions');
      }

      console.log('Calling wallet.signTransaction...');
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);
      console.log('✅ Transaction signed');

      console.log('📤 Sending transaction to network...');
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      console.log('Transaction sent, signature:', signature);

      console.log('⏳ Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Transaction confirmed!');

      console.log('🎉 Pool deployed! Transaction signature:', signature);

      // Derive pool addresses for database storage
      const { PublicKey } = await import('@solana/web3.js');
      const programPubkey = new PublicKey(programId);

      // Convert UUID to 32-byte buffer (same as SDK)
      const postIdBytes16 = Buffer.from(tempPostId.replace(/-/g, ''), 'hex');
      const postIdBytes32 = Buffer.alloc(32);
      postIdBytes16.copy(postIdBytes32, 0);

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), postIdBytes32],
        programPubkey
      );
      const [tokenMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint'), postIdBytes32],
        programPubkey
      );
      const [poolVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), postIdBytes32],
        programPubkey
      );

      console.log('Derived pool addresses:', {
        pool: poolPda.toBase58(),
        tokenMint: tokenMintPda.toBase58(),
        vault: poolVaultPda.toBase58(),
      });

      // Step 4: NOW create post and belief (only after successful transaction)
      console.log('📝 Step 4: Creating post and belief in database...');
      const response = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          title: title.trim(),
          content: content.trim(),
          initial_belief: belief / 100, // Convert 0-100 to 0-1
          meta_belief: metaBelief / 100, // Convert 0-100 to 0-1
          belief_duration_hours: duration,
          post_id: tempPostId, // Use the same ID we used for the pool
          tx_signature: signature, // Include the transaction signature
          pool_deployment: {
            pool_address: poolPda.toBase58(),
            token_mint_address: tokenMintPda.toBase58(),
            usdc_vault_address: poolVaultPda.toBase58(),
            deployment_tx_signature: signature,
            k_quadratic: poolConfig?.k_quadratic ?? 1,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      createdPostId = data.post_id;
      createdBeliefId = data.belief_id;

      console.log('✅ Post and pool deployment recorded successfully!');

      // Success - reset and close
      setTitle('');
      setContent('');
      setDuration(48);
      setBelief(50);
      setMetaBelief(50);
      onClose();

      // Refresh the page to show new post
      window.location.reload();
    } catch (err) {
      console.error('Post creation error:', err);

      // If we created a post/belief but failed after, clean it up
      if (createdPostId || createdBeliefId) {
        try {
          const jwt = await getAccessToken();
          await fetch('/api/supabase/functions/v1/app-post-deletion', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              post_id: createdPostId,
              belief_id: createdBeliefId,
            }),
          });
        } catch (cleanupErr) {
          console.error('Failed to clean up after error:', cleanupErr);
        }
      }

      // User-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          setError('Transaction cancelled. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to create post');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-eggshell border border-eggshell-dark rounded-lg md:rounded-xl shadow-xl w-full max-w-2xl mx-4 md:mx-0 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-eggshell-dark">
          <h2 id="modal-title" className="text-2xl font-bold text-text-primary">
            Create Post
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-6">
          {/* Title Input */}
          <div>
            <label htmlFor="post-title" className="block text-sm font-medium text-text-secondary mb-2">
              Title
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter post title..."
              maxLength={200}
              disabled={isSubmitting}
              className="input w-full"
              autoFocus
            />
            <div className="text-xs text-text-tertiary text-right mt-1">
              {title.length}/200
            </div>
          </div>

          {/* Content Input */}
          <div>
            <label htmlFor="post-content" className="block text-sm font-medium text-text-secondary mb-2">
              Content
            </label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts..."
              maxLength={2000}
              rows={8}
              disabled={isSubmitting}
              className="input w-full resize-y min-h-[200px]"
            />
            <div className="text-xs text-text-tertiary text-right mt-1">
              {content.length}/2000
            </div>
          </div>

          {/* Belief Slider */}
          <div>
            <label htmlFor="belief-slider" className="block text-sm font-medium text-text-secondary mb-2">
              Relevance Belief: {belief}%
            </label>
            <p className="text-xs text-text-tertiary mb-3">
              How relevant do you think this content is? (0 = Not relevant, 100 = Highly relevant)
            </p>
            <input
              id="belief-slider"
              type="range"
              min="0"
              max="100"
              value={belief}
              onChange={(e) => setBelief(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent-primary"
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>Not Relevant</span>
              <span>Highly Relevant</span>
            </div>
          </div>

          {/* Meta-Belief Slider */}
          <div>
            <label htmlFor="meta-belief-slider" className="block text-sm font-medium text-text-secondary mb-2">
              Meta-Belief: {metaBelief}%
            </label>
            <p className="text-xs text-text-tertiary mb-3">
              What do you think others will believe about its relevance?
            </p>
            <input
              id="meta-belief-slider"
              type="range"
              min="0"
              max="100"
              value={metaBelief}
              onChange={(e) => setMetaBelief(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent-primary"
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Duration Dropdown */}
          <div>
            <label htmlFor="post-duration" className="block text-sm font-medium text-text-secondary mb-2">
              Belief Duration
            </label>
            <select
              id="post-duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={isSubmitting}
              className="input w-full"
            >
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>1 week</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-6 border-t border-eggshell-dark">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Creating...' : 'Create Post →'}
          </button>
        </div>
      </div>
    </div>
  );
}

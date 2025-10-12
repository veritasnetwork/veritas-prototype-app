'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/providers/AuthProvider';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { Connection } from '@solana/web3.js';
import { buildCreatePoolTransaction } from '@/lib/solana/pool-deployment-transaction';
import type { PostType, TiptapDocument } from '@/types/post.types';
import { FileText, Image as ImageIcon, Video } from 'lucide-react';
import { TiptapEditor } from './TiptapEditor';
import { ImageUpload } from './ImageUpload';
import { VideoUpload } from './VideoUpload';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const { getAccessToken } = usePrivy();
  const { user } = useAuth();
  const { wallet, address: solanaAddress } = useSolanaWallet();

  // NEW SCHEMA STATE
  const [postType, setPostType] = useState<PostType>('text');
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(null); // Rich text content
  const [caption, setCaption] = useState(''); // For image/video posts (280 chars max)
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null); // Single media URL

  // ARTICLE-SPECIFIC STATE
  const [articleTitle, setArticleTitle] = useState(''); // Optional title for articles
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null); // Optional cover for articles (requires title)
  const [showTitleCover, setShowTitleCover] = useState(false); // Toggle for title/cover section

  const [duration, setDuration] = useState(48);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolConfig, setPoolConfig] = useState<{
    k_quadratic: number;
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
    console.log('Wallet status:', {
      isConnected: !!wallet,
      solanaAddress
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
  }, [isOpen, contentJson, caption, uploadedMediaUrl]);

  const handleClose = async () => {
    // Don't close if already submitting
    if (isSubmitting) return;

    // Clean up any uploaded media from storage before closing
    const mediaToDelete: string[] = [];

    if (uploadedMediaUrl) {
      mediaToDelete.push(uploadedMediaUrl);
    }
    if (coverImageUrl) {
      mediaToDelete.push(coverImageUrl);
    }

    // Delete uploaded files from backend
    if (mediaToDelete.length > 0) {
      try {
        const token = await getAccessToken();
        if (token) {
          for (const url of mediaToDelete) {
            // Extract file path from URL
            const match = url.match(/\/storage\/v1\/object\/public\/veritas-media\/(.+)$/);
            if (match && match[1]) {
              await fetch('/api/media/delete', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ path: match[1] }),
              }).catch(err => console.warn('Failed to delete media:', err));
            }
          }
        }
      } catch (error) {
        console.warn('Error cleaning up media:', error);
      }
    }

    // Reset state and close
    setPostType('text');
    setContentJson(null);
    setCaption('');
    setUploadedMediaUrl(null);
    setArticleTitle('');
    setCoverImageUrl(null);
    setDuration(48);
    setError(null);
    onClose();
  };


  const handleSubmit = async () => {
    console.log('🚀 handleSubmit called');
    console.log('Post type:', postType);
    console.log('User:', user);
    console.log('Wallet:', wallet);
    console.log('Solana Address:', solanaAddress);

    // Validate based on post type
    if (postType === 'text' && !contentJson) {
      setError('Please enter some content');
      return;
    }
    if ((postType === 'image' || postType === 'video') && !uploadedMediaUrl) {
      setError(`Please upload ${postType === 'image' ? 'an image' : 'a video'}`);
      return;
    }
    if (caption && caption.length > 280) {
      setError('Caption must be 280 characters or less');
      return;
    }

    // Validate article-specific fields
    if (articleTitle && articleTitle.length > 200) {
      setError('Article title must be 200 characters or less');
      return;
    }
    if (coverImageUrl && !articleTitle.trim()) {
      setError('Cover image requires a title');
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
      // @ts-expect-error - Privy wallet has signTransaction method
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
          post_type: postType,
          content_json: postType === 'text' ? contentJson : undefined,
          media_urls: (postType === 'image' || postType === 'video') && uploadedMediaUrl ? [uploadedMediaUrl] : undefined,
          caption: (postType === 'image' || postType === 'video') ? caption || undefined : undefined,
          article_title: postType === 'text' && articleTitle ? articleTitle : undefined,
          cover_image_url: postType === 'text' && coverImageUrl ? coverImageUrl : undefined,
          // initial_belief and meta_belief are now optional - not sent
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

      // Success - reset and close IMMEDIATELY for better UX
      setPostType('text');
      setContentJson(null);
      setCaption('');
      setUploadedMediaUrl(null);
      setArticleTitle('');
      setCoverImageUrl(null);
      setDuration(48);
      setError(null);
      onClose();

      // Trigger refetch in background (non-blocking)
      if (onPostCreated) {
        setTimeout(() => onPostCreated(), 100);
      }
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

  // Validation based on post type
  const isValid =
    (postType === 'text' && contentJson !== null) ||
    ((postType === 'image' || postType === 'video') && uploadedMediaUrl !== null);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[#1a1a1a] border border-gray-800 rounded-lg md:rounded-xl shadow-2xl w-full max-w-2xl mx-4 md:mx-0 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-end px-6 md:px-8 py-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-6">
          {/* Post Type Selector */}
          <div>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPostType('text')}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  postType === 'text'
                    ? 'border-[#B9D9EB] bg-[#B9D9EB]/10 text-[#B9D9EB]'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <FileText className="w-6 h-6" />
                <span className="text-sm font-medium">Text</span>
              </button>
              <button
                type="button"
                onClick={() => setPostType('image')}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  postType === 'image'
                    ? 'border-[#B9D9EB] bg-[#B9D9EB]/10 text-[#B9D9EB]'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <ImageIcon className="w-6 h-6" />
                <span className="text-sm font-medium">Image</span>
              </button>
              <button
                type="button"
                onClick={() => setPostType('video')}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  postType === 'video'
                    ? 'border-[#B9D9EB] bg-[#B9D9EB]/10 text-[#B9D9EB]'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <Video className="w-6 h-6" />
                <span className="text-sm font-medium">Video</span>
              </button>
            </div>
          </div>

          {/* Content Input - Based on Post Type */}
          {postType === 'text' && (
            <div className="space-y-4">
              {/* Rich Text Editor - Primary input */}
              <div>
                <TiptapEditor
                  content={contentJson}
                  onChange={setContentJson}
                  placeholder="What's on your mind?"
                  disabled={isSubmitting}
                />
              </div>

              {/* Toggle button for title & cover */}
              <button
                type="button"
                onClick={() => setShowTitleCover(!showTitleCover)}
                disabled={isSubmitting}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                <span className="text-lg">{showTitleCover ? '−' : '⊕'}</span>
                <span>Add title & cover (optional)</span>
              </button>

              {/* Collapsible Title & Cover Section */}
              {showTitleCover && (
                <div className="space-y-4 pt-2 border-t border-gray-800">
                  {/* Title Input */}
                  <div>
                    <input
                      id="article-title"
                      type="text"
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                      placeholder="Title (optional)"
                      maxLength={200}
                      disabled={isSubmitting}
                      className="input w-full"
                    />
                    <div className="text-xs text-gray-500 text-right mt-1">
                      {articleTitle.length}/200
                    </div>
                  </div>

                  {/* Cover Image Upload (Only show if title has been entered) */}
                  {articleTitle.trim() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Cover Image (optional)
                      </label>
                      <ImageUpload
                        currentUrl={coverImageUrl}
                        onUpload={setCoverImageUrl}
                        onRemove={() => setCoverImageUrl(null)}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {postType === 'image' && (
            <div className="space-y-4">
              <div>
                <ImageUpload
                  currentUrl={uploadedMediaUrl}
                  onUpload={setUploadedMediaUrl}
                  onRemove={() => setUploadedMediaUrl(null)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  maxLength={280}
                  rows={3}
                  disabled={isSubmitting}
                  className="input w-full resize-none"
                />
                <div className="text-xs text-gray-500 text-right mt-1">
                  {caption.length}/280
                </div>
              </div>
            </div>
          )}

          {postType === 'video' && (
            <div className="space-y-4">
              <div>
                <VideoUpload
                  currentUrl={uploadedMediaUrl}
                  onUpload={setUploadedMediaUrl}
                  onRemove={() => setUploadedMediaUrl(null)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  maxLength={280}
                  rows={3}
                  disabled={isSubmitting}
                  className="input w-full resize-none"
                />
                <div className="text-xs text-gray-500 text-right mt-1">
                  {caption.length}/280
                </div>
              </div>
            </div>
          )}

          {/* Duration Dropdown */}
          <div>
            <label htmlFor="post-duration" className="block text-sm font-medium text-gray-300 mb-2">
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
        <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-6 border-t border-gray-800">
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

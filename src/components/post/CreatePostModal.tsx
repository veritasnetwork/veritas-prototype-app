'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
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
  const { requireAuth } = useRequireAuth();
  const isMobile = useIsMobile();

  // Animation state - separate from isOpen to allow mount/unmount animation
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // NEW SCHEMA STATE
  const [postType, setPostType] = useState<PostType>('text');
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(null); // Rich text content
  const [caption, setCaption] = useState(''); // For image/video posts (280 chars max)
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null); // Single media URL
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(null); // Video thumbnail
  const [imageDisplayMode, setImageDisplayMode] = useState<'cover' | 'contain'>('cover'); // Image layout mode

  // ARTICLE-SPECIFIC STATE
  const [articleTitle, setArticleTitle] = useState(''); // Optional title for articles
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null); // Optional cover for articles (requires title)
  const [showTitleCover, setShowTitleCover] = useState(false); // Toggle for title/cover section

  // Use refs to persist state across Fast Refresh (dev only)
  const persistedCoverImageRef = useRef<string | null>(null);
  const persistedArticleTitleRef = useRef<string>('');
  const persistedShowTitleCoverRef = useRef<boolean>(false);
  const hasRestoredRef = useRef<boolean>(false);

  // Restore all state from refs after Fast Refresh
  useEffect(() => {
    if (isOpen && !hasRestoredRef.current) {
      if (persistedCoverImageRef.current && !coverImageUrl) {
        setCoverImageUrl(persistedCoverImageRef.current);
      }
      if (persistedArticleTitleRef.current && !articleTitle) {
        setArticleTitle(persistedArticleTitleRef.current);
      }
      if (persistedShowTitleCoverRef.current && !showTitleCover) {
        setShowTitleCover(persistedShowTitleCoverRef.current);
      }
      hasRestoredRef.current = true;
    }

    // Reset restoration flag when modal closes
    if (!isOpen) {
      hasRestoredRef.current = false;
    }
  }, [isOpen, coverImageUrl, articleTitle, showTitleCover]);

  // Persist state to refs whenever they change
  useEffect(() => {
    if (coverImageUrl) {
      persistedCoverImageRef.current = coverImageUrl;
    }
  }, [coverImageUrl]);

  useEffect(() => {
    if (articleTitle) {
      persistedArticleTitleRef.current = articleTitle;
    }
  }, [articleTitle]);

  useEffect(() => {
    persistedShowTitleCoverRef.current = showTitleCover;
  }, [showTitleCover]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle mount/unmount animation and body scroll lock
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Lock body scroll when modal opens (prevent background scroll on mobile)
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;

      // Trigger animation after a brief delay to ensure DOM is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Restore body scroll
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);

      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
  }, [isOpen]);

  const handleClose = async () => {
    // Don't close if already submitting
    if (isSubmitting) return;

    // Clean up any uploaded media from storage before closing
    const mediaToDelete: string[] = [];

    if (uploadedMediaUrl) {
      mediaToDelete.push(uploadedMediaUrl);
    }
    if (videoThumbnailUrl) {
      mediaToDelete.push(videoThumbnailUrl);
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
    setVideoThumbnailUrl(null);
    setImageDisplayMode('cover');
    setArticleTitle('');
    setCoverImageUrl(null);
    setShowTitleCover(false);
    setError(null);

    // Clear all persisted refs
    persistedCoverImageRef.current = null;
    persistedArticleTitleRef.current = '';
    persistedShowTitleCoverRef.current = false;
    hasRestoredRef.current = false;

    onClose();
  };

  // Swipe-to-dismiss on mobile
  const { containerRef, dragDistance, isDragging } = useSwipeToDismiss({
    onDismiss: handleClose,
    enabled: isMobile && isOpen,
    threshold: 150,
    dragHandleSelector: '.drag-handle',
  });

  const handleSubmit = async () => {
    // Check auth first
    const isAuthed = await requireAuth();
    if (!isAuthed) return;

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
      return;
    }
    if (!user) {
      setError('Please log in to create a post');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    let createdPostId: string | null = null;
    let createdBeliefId: string | null = null;

    try {
      // Step 1: Get Privy auth token
      const jwt = await getAccessToken();
      if (!jwt) {
        throw new Error('Please log in to create a post');
      }

      // Step 2: Create post (no pool deployment required)
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
          media_urls: (postType === 'image' || postType === 'video') && uploadedMediaUrl
            ? (postType === 'video' && videoThumbnailUrl
                ? [videoThumbnailUrl, uploadedMediaUrl] // For videos: [thumbnail, video]
                : [uploadedMediaUrl]) // For images or videos without thumbnail
            : undefined,
          caption: (postType === 'image' || postType === 'video') ? caption || undefined : undefined,
          article_title: postType === 'text' && articleTitle ? articleTitle : undefined,
          cover_image_url: postType === 'text' && coverImageUrl ? coverImageUrl : undefined,
          image_display_mode: postType === 'image' ? imageDisplayMode : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      createdPostId = data.post_id;
      createdBeliefId = data.belief_id;

      // Success - reset and close IMMEDIATELY for better UX
      setPostType('text');
      setContentJson(null);
      setCaption('');
      setUploadedMediaUrl(null);
      setVideoThumbnailUrl(null);
      setImageDisplayMode('cover');
      setArticleTitle('');
      setCoverImageUrl(null);
      setError(null);
      onClose();

      // Trigger refetch immediately (non-blocking)
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (err) {
      console.error('Post creation error:', err);

      // If we created a post/belief but failed after, clean it up
      if (createdPostId || createdBeliefId) {
        try {
          const jwt = await getAccessToken();
          // Note: Edge function for cleanup is disabled for now
          // The database has cascading deletes that should handle this
          console.warn('Post/belief cleanup skipped:', {
            post_id: createdPostId,
            belief_id: createdBeliefId,
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

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex md:items-center md:justify-center items-end"
      onMouseDown={(e) => {
        // Only close on backdrop click, not on any child element
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal - Full-screen on mobile, centered on desktop */}
      <div
        ref={containerRef}
        className={`
          relative bg-[#1a1a1a] border border-gray-800 shadow-2xl w-full flex flex-col
          rounded-t-3xl md:rounded-xl
          h-full md:max-h-[95vh]
          md:max-w-2xl md:mx-4
          ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
          ${isAnimating ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
        `}
        style={{
          transform: isDragging ? `translateY(${dragDistance}px)` : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="md:hidden flex justify-center py-3 border-b border-gray-800 drag-handle">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-end px-6 md:px-8 py-2">
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
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-4">
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
                <div className="space-y-4 pt-2 pb-2 border-b border-gray-800">
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

              {/* Rich Text Editor - Primary input */}
              <div>
                <TiptapEditor
                  content={contentJson}
                  onChange={setContentJson}
                  placeholder="What's on your mind?"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {postType === 'image' && (
            <div className="space-y-4">
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
              <div>
                <ImageUpload
                  currentUrl={uploadedMediaUrl}
                  onUpload={setUploadedMediaUrl}
                  onRemove={() => setUploadedMediaUrl(null)}
                  disabled={isSubmitting}
                  displayMode={imageDisplayMode}
                />
              </div>

              {/* Image Display Mode Toggle */}
              {uploadedMediaUrl && (
                <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setImageDisplayMode('contain')}
                      disabled={isSubmitting}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        imageDisplayMode === 'contain'
                          ? 'bg-[#B9D9EB] text-[#0C1D51]'
                          : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                      }`}
                    >
                      <span>Full Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageDisplayMode('cover')}
                      disabled={isSubmitting}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        imageDisplayMode === 'cover'
                          ? 'bg-[#B9D9EB] text-[#0C1D51]'
                          : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                      }`}
                    >
                      <span>Fill Card</span>
                    </button>
                </div>
              )}
            </div>
          )}

          {postType === 'video' && (
            <div className="space-y-4">
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
              <div>
                <VideoUpload
                  currentUrl={uploadedMediaUrl}
                  onUpload={(videoUrl, thumbnailUrl) => {
                    setUploadedMediaUrl(videoUrl);
                    if (thumbnailUrl) {
                      setVideoThumbnailUrl(thumbnailUrl);
                    }
                  }}
                  onRemove={() => {
                    setUploadedMediaUrl(null);
                    setVideoThumbnailUrl(null);
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-4 border-t border-gray-800">
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

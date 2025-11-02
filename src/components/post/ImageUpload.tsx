'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { usePrivy } from '@/hooks/usePrivyHooks';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  currentUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
  displayMode?: 'cover' | 'contain';
}

export function ImageUpload({ onUpload, currentUrl, onRemove, disabled, displayMode = 'cover' }: ImageUploadProps) {
  const { getAccessToken } = usePrivy();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be smaller than 10MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Get Privy auth token
      const token = await getAccessToken();

      if (!token) {
        throw new Error('Please log in to upload images');
      }

      // Upload to API
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/media/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      if (!data.url) {
        console.error('[ImageUpload] No URL in response data:', data);
        throw new Error('Upload succeeded but no URL returned');
      }

      // Return the public URL
      onUpload(data.url);
    } catch (err) {
      console.error('Image upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Simulate file input change
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (currentUrl) {
    return (
      <div className="relative group">
        <div className={`w-full rounded-lg overflow-hidden ${displayMode === 'contain' ? 'bg-black' : ''}`}>
          <img
            key={currentUrl} // Force re-render when URL changes
            src={currentUrl}
            alt="Uploaded image"
            className={`w-full rounded-lg max-h-96 ${displayMode === 'contain' ? 'object-contain' : 'object-cover'}`}
            onError={(e) => {
              console.error('[ImageUpload] Image failed to load:', currentUrl);
            }}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 shadow-lg"
          title="Remove image"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          disabled
            ? 'border-gray-800 bg-gray-900/50 cursor-not-allowed opacity-60'
            : 'border-gray-700 hover:border-gray-600 cursor-pointer'
        }`}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
            <p className="text-gray-400">Uploading...</p>
          </div>
        ) : (
          <>
            <ImageIcon className={`w-12 h-12 mx-auto mb-3 ${disabled ? 'text-gray-700' : 'text-gray-600'}`} />
            <p className={`mb-2 ${disabled ? 'text-gray-600' : 'text-gray-300'}`}>
              {disabled ? (
                <span>Add a title first to enable cover upload</span>
              ) : (
                <>
                  <span className="text-blue-400 hover:text-blue-300">Click to upload</span> or drag and drop
                </>
              )}
            </p>
            <p className={`text-sm ${disabled ? 'text-gray-700' : 'text-gray-500'}`}>
              JPEG, PNG, GIF, or WebP (max 10MB)
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

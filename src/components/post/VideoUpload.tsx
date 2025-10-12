'use client';

import { useState, useRef } from 'react';
import { Upload, X, Video as VideoIcon } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';

interface VideoUploadProps {
  onUpload: (url: string) => void;
  currentUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
}

export function VideoUpload({ onUpload, currentUrl, onRemove, disabled }: VideoUploadProps) {
  const { getAccessToken } = usePrivy();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid video file (MP4, MOV, or WebM)');
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Video must be smaller than 100MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Get Privy auth token
      const token = await getAccessToken();

      if (!token) {
        throw new Error('Please log in to upload videos');
      }

      // Upload to API
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/media/upload-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload video');
      }

      // Return the public URL
      onUpload(data.url);
    } catch (err) {
      console.error('Video upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload video');
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
    if (file && file.type.startsWith('video/')) {
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
        <video
          src={currentUrl}
          controls
          className="w-full rounded-lg max-h-96"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          title="Remove video"
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
        className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-600 transition-colors cursor-pointer"
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
            <p className="text-gray-400">Uploading...</p>
          </div>
        ) : (
          <>
            <VideoIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-300 mb-2">
              <span className="text-blue-400 hover:text-blue-300">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-gray-500">
              MP4, MOV, or WebM (max 100MB)
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

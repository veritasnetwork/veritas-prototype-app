/**
 * EditProfileModal Component
 * Modal for editing username and profile photo
 */

'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';

interface EditProfileModalProps {
  currentUsername: string;
  currentAvatarUrl?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditProfileModal({
  currentUsername,
  currentAvatarUrl,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const { getAccessToken } = usePrivy();
  const { refreshUser } = useAuth();
  const [username, setUsername] = useState(currentUsername);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUploading(true);

    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        throw new Error('Authentication required');
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append('username', username);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const response = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      // Refresh user data to update sidebar avatar
      await refreshUser();

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsUploading(false);
    }
  };

  const hasChanges = username !== currentUsername || avatarFile !== null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-md w-full border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full border-3 border-[#B9D9EB] bg-gradient-to-br from-[#B9D9EB] to-[#0C1D51] flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-3xl font-bold">
                    {username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                aria-label="Upload photo"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-gray-400 text-center">
              Click the upload icon to change your photo
            </p>
          </div>

          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full pl-8 pr-4 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#B9D9EB]"
                placeholder="username"
                minLength={2}
                maxLength={50}
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              2-50 characters, lowercase letters, numbers, and underscores only
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
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
              disabled={!hasChanges || isUploading}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

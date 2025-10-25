'use client';

import { useState } from 'react';
import { usePrivy, useConnectWallet } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';

interface OnboardingModalProps {
  isOpen: boolean;
}

export function OnboardingModal({ isOpen }: OnboardingModalProps) {
  const { user: privyUser, getAccessToken } = usePrivy();
  const { refreshUser } = useAuth();
  const { connectWallet } = useConnectWallet();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // Get Solana wallet address
  const solanaWallet = privyUser?.linkedAccounts?.find(
    (account: { type: string; chainType?: string }) => account.type === 'wallet' && account.chainType === 'solana'
  );
  const solanaAddress = (solanaWallet as { address?: string })?.address;

  // Shortened wallet address for display
  const shortenedAddress = solanaAddress
    ? `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}`
    : '';

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      // Validate file size (5MB max)
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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate username
    if (!username) {
      setError('Username is required');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setError('Username must be 3-20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    setIsSubmitting(true);

    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        throw new Error('Failed to get access token');
      }

      let avatarUrl: string | null = null;

      // Upload avatar if provided
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);

        const uploadResponse = await fetch('/api/media/upload-profile-photo', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwt}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload profile photo');
        }

        const uploadData = await uploadResponse.json();
        avatarUrl = uploadData.url;
      }

      // Complete profile
      const response = await fetch('/api/users/complete-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          display_name: displayName || username,
          avatar_url: avatarUrl,
          solana_address: solanaAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete profile');
      }

      // Refresh user to exit onboarding
      await refreshUser();
    } catch (err: any) {
      console.error('Profile completion error:', err);
      setError(err.message || 'Failed to complete profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      <div className="bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-10 max-w-lg w-full mx-4 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img
              src="/icons/logo.png"
              alt="Veritas Logo"
              className="w-12 h-12"
            />
            <h2 className="text-white text-3xl font-bold font-mono tracking-wide">VERITAS</h2>
          </div>
          <p className="text-gray-400 text-sm">
            Welcome! Let's set up your profile
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#B9D9EB]/20 to-[#0C1D51]/20 border-2 border-white/10 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-gray-100 transition-colors border-2 border-[#0a0a0a]">
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-gray-300 text-sm font-medium mb-3">
              Username <span className="text-[#B9D9EB]">*</span>
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="johndoe"
              maxLength={20}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#B9D9EB]/50 focus:bg-white/10 transition-all"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-gray-300 text-sm font-medium mb-3">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              maxLength={50}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#B9D9EB]/50 focus:bg-white/10 transition-all"
              disabled={isSubmitting}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Wallet Connection Prompt (if no Solana wallet) */}
          {!solanaAddress && !isCreatingWallet && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
              <p className="text-yellow-400 text-xs mb-2">Solana wallet required</p>
              <button
                type="button"
                onClick={async () => {
                  setIsCreatingWallet(true);
                  try {
                    await connectWallet();
                  } catch (err) {
                    console.error('Wallet connection error:', err);
                  } finally {
                    setIsCreatingWallet(false);
                  }
                }}
                className="text-[#B9D9EB] text-sm hover:underline"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !username || !solanaAddress}
            className="w-full bg-gradient-to-r from-[#B9D9EB] to-[#a8c8d8] hover:from-[#0C1D51] hover:to-[#162d5f] text-[#0C1D51] hover:text-white font-semibold py-4 px-6 rounded-xl font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSubmitting ? 'CREATING PROFILE...' : !solanaAddress ? 'CONNECT WALLET FIRST' : 'GET STARTED'}
          </button>
        </form>
      </div>
    </div>
  );
}

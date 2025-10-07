/**
 * ProfilePage Component
 * Displays user profile with stats, stake information, and recent activity
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { PostCard } from '@/components/feed/PostCard/PostCard';
import { truncateAddress, formatCurrency } from '@/utils/formatters';
import { useState } from 'react';

interface ProfilePageProps {
  username: string;
}

export function ProfilePage({ username }: ProfilePageProps) {
  const router = useRouter();
  const { user: currentUser, logout } = useAuth();
  const { data: profileData, isLoading, error } = useProfile(username);
  const [copiedWallet, setCopiedWallet] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      router.push('/');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <main className="max-w-[680px] mx-auto px-6 md:px-6 py-8 md:py-8">
        <ProfileSkeleton />
      </main>
    );
  }

  // Error state
  if (error || !profileData) {
    return (
      <main className="max-w-[680px] mx-auto px-6 md:px-6 py-8 md:py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors mb-6"
        >
          <span>←</span>
          <span>Back</span>
        </button>
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-text-primary mb-4">
            {error === 'User not found' ? 'User Not Found' : 'Error Loading Profile'}
          </h2>
          <p className="text-text-secondary mb-6">
            {error === 'User not found'
              ? 'The user you\'re looking for doesn\'t exist.'
              : 'Something went wrong loading this profile.'}
          </p>
          <button
            onClick={() => router.push('/feed')}
            className="btn-primary"
          >
            Go to Feed
          </button>
        </div>
      </main>
    );
  }

  const { user, stats, recent_posts } = profileData;

  const handleCopyWallet = async () => {
    if (user.solana_address) {
      await navigator.clipboard.writeText(user.solana_address);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  return (
    <main className="max-w-[680px] mx-auto px-4 md:px-6 py-8 md:py-8">
      {/* Back Navigation & Logout */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Logout Button (Own Profile Only) */}
        {isOwnProfile && (
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-error hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2"
            aria-label="Logout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="text-center mb-8">
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-3 border-accent-primary bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-2xl md:text-3xl font-bold">
                {user.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
        </div>

        {/* Display Name */}
        <h1 className="text-2xl md:text-[28px] font-bold text-text-primary mb-1">
          {user.display_name || user.username}
        </h1>

        {/* Username */}
        <p className="text-base font-medium text-text-secondary mb-2">
          @{user.username}
        </p>

        {/* Wallet Address */}
        {user.solana_address && (
          <button
            onClick={handleCopyWallet}
            className="font-mono text-sm text-text-tertiary hover:text-text-secondary transition-colors relative inline-block"
            aria-label="Copy wallet address"
          >
            {truncateAddress(user.solana_address)}
            {copiedWallet && (
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-bg-elevated text-text-primary text-xs py-1 px-2 rounded whitespace-nowrap">
                Address copied!
              </span>
            )}
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Stake */}
        <div className="bg-bg-elevated border border-border rounded-xl p-5 text-center hover:shadow-sm transition-shadow">
          <p className="text-sm font-medium text-text-secondary mb-2">
            Stake
          </p>
          <p className="text-3xl font-bold text-text-primary">
            {formatCurrency(stats.total_stake)}
          </p>
        </div>

        {/* Posts */}
        <div className="bg-bg-elevated border border-border rounded-xl p-5 text-center hover:shadow-sm transition-shadow">
          <p className="text-sm font-medium text-text-secondary mb-2">
            Posts
          </p>
          <p className="text-3xl font-bold text-text-primary">
            {stats.total_posts}
          </p>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <h2 className="text-xl font-bold text-text-primary border-b border-border pb-2 mb-4">
          Recent Activity
        </h2>

        {/* Posts List */}
        {recent_posts && recent_posts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {recent_posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          // Empty State
          <div className="text-center py-12 bg-bg-elevated border border-border rounded-xl">
            <p className="text-text-primary font-medium mb-2">
              No posts yet
            </p>
            <p className="text-text-secondary text-sm mb-6">
              {isOwnProfile ? 'Create your first post!' : 'This user hasn\'t posted anything yet.'}
            </p>
            {isOwnProfile && (
              <button
                onClick={() => router.push('/feed')}
                className="btn-primary"
              >
                Create Post
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * ProfileSkeleton Component
 * Loading placeholder for profile page
 */
function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Back button skeleton */}
      <div className="h-6 w-16 bg-bg-elevated rounded mb-6" />

      {/* Profile header skeleton */}
      <div className="text-center mb-8">
        {/* Avatar skeleton */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-bg-elevated" />
        </div>

        {/* Name skeleton */}
        <div className="h-8 w-48 bg-bg-elevated rounded mx-auto mb-2" />

        {/* Username skeleton */}
        <div className="h-5 w-32 bg-bg-elevated rounded mx-auto mb-2" />

        {/* Wallet skeleton */}
        <div className="h-4 w-40 bg-bg-elevated rounded mx-auto" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-bg-elevated border border-border rounded-xl p-5">
          <div className="h-4 w-12 bg-bg-primary rounded mx-auto mb-3" />
          <div className="h-10 w-20 bg-bg-primary rounded mx-auto" />
        </div>
        <div className="bg-bg-elevated border border-border rounded-xl p-5">
          <div className="h-4 w-12 bg-bg-primary rounded mx-auto mb-3" />
          <div className="h-10 w-20 bg-bg-primary rounded mx-auto" />
        </div>
      </div>

      {/* Recent activity skeleton */}
      <div>
        <div className="h-6 w-40 bg-bg-elevated rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-bg-elevated border border-border rounded-xl p-6">
              <div className="h-4 w-32 bg-bg-primary rounded mb-3" />
              <div className="h-6 w-full bg-bg-primary rounded mb-2" />
              <div className="h-4 w-3/4 bg-bg-primary rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

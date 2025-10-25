/**
 * ProfilePage Component
 * Displays user profile with stats, stake information, and recent activity
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { CompactProfilePostCard } from '@/components/profile/CompactProfilePostCard';
import { HoldingCard } from '@/components/profile/HoldingCard';
import { FundWalletButton } from '@/components/wallet/FundWalletButton';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { WithdrawModal } from '@/components/profile/WithdrawModal';
import { truncateAddress, formatCurrency } from '@/utils/formatters';
import { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';

interface ProfilePageProps {
  username: string;
}

type TabType = 'posts' | 'holdings';

export function ProfilePage({ username }: ProfilePageProps) {
  const router = useRouter();
  const { user: currentUser, logout, refreshUser } = useAuth();
  const { data: profileData, isLoading, error, mutate } = useProfile(username);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [totalLocked, setTotalLocked] = useState(0);

  const isOwnProfile = currentUser?.username === username;

  // Fetch holdings when Holdings tab is clicked OR when on own profile (for locked calculation)
  useEffect(() => {
    if (activeTab === 'holdings' && holdings.length === 0) {
      fetchHoldings();
    }
  }, [activeTab]);

  // Fetch holdings on mount if own profile to calculate locked stake
  useEffect(() => {
    if (isOwnProfile && holdings.length === 0 && !holdingsLoading) {
      fetchHoldings();
    }
  }, [isOwnProfile]);

  const fetchHoldings = async () => {
    setHoldingsLoading(true);
    try {
      const response = await fetch(`/api/users/${username}/holdings`);
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);

        // Calculate total locked from holdings
        const locked = (data.holdings || []).reduce(
          (sum: number, h: any) => sum + (h.balance?.total_lock_usdc || 0),
          0
        );
        setTotalLocked(locked);
      }
    } catch (err) {
      console.error('Failed to fetch holdings:', err);
    } finally {
      setHoldingsLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      router.push('/feed');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#0f0f0f]">
        <div className="w-full px-6 py-8">
          <ProfileSkeleton />
        </div>
      </main>
    );
  }

  // Error state
  if (error || !profileData) {
    return (
      <main className="min-h-screen bg-[#0f0f0f]">
        <div className="w-full px-6 py-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-8"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div className="text-center py-16 max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {error === 'User not found' ? 'User Not Found' : 'Error Loading Profile'}
            </h2>
            <p className="text-gray-400 mb-6">
              {error === 'User not found'
                ? 'The user you\'re looking for doesn\'t exist.'
                : 'Something went wrong loading this profile.'}
            </p>
            <button
              onClick={() => router.push('/feed')}
              className="px-6 py-3 bg-[#B9D9EB] text-[#0C1D51] rounded-xl font-medium hover:bg-[#B9D9EB]/90 transition-all duration-200 hover:scale-105"
            >
              Go to Feed
            </button>
          </div>
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
    <main className="min-h-screen bg-[#0f0f0f]">
      {/* Full-width dashboard layout */}
      <div className="w-full px-6 py-8">
        {/* Back Navigation */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-8"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Two-column layout: Left sidebar + Right content */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 max-w-[1400px] mx-auto">
          {/* LEFT COLUMN - Profile Info */}
          <div className="space-y-4">
            {/* Profile Card */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 sticky top-6">
              {/* Avatar */}
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-full border-3 border-[#B9D9EB] bg-gradient-to-br from-[#B9D9EB] to-[#0C1D51] flex items-center justify-center shadow-lg">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-3xl font-bold">
                      {user.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <h1 className="text-2xl font-bold text-white text-center mb-1">
                {user.display_name || user.username}
              </h1>

              {/* Username */}
              <p className="text-sm font-medium text-gray-400 text-center mb-3">
                @{user.username}
              </p>

              {/* Wallet Address - Only show on own profile */}
              {isOwnProfile && user.solana_address && (
                <button
                  onClick={handleCopyWallet}
                  className="w-full font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors relative mb-4 py-2 px-3 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a]"
                  aria-label="Copy wallet address"
                >
                  {truncateAddress(user.solana_address)}
                  {copiedWallet && (
                    <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-[#2a2a2a] text-white text-xs py-1 px-3 rounded-lg shadow-lg whitespace-nowrap border border-[#3a3a3a]">
                      Address copied!
                    </span>
                  )}
                </button>
              )}

              {/* Action Buttons - Only show on own profile */}
              {isOwnProfile && (
                <div className="space-y-2 mb-4">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#B9D9EB]/10 hover:bg-[#B9D9EB]/20 border border-[#B9D9EB]/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Profile
                  </button>
                  <FundWalletButton variant="full" />
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-[#2a2a2a] my-4" />

              {/* Stats Cards (Stacked Vertically) */}
              <div className="space-y-3">
                {/* Total Stake - Only show on own profile */}
                {isOwnProfile && (
                  <>
                    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-400 mb-1">
                        Total Locked Stake
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(stats.total_stake)}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowWithdrawModal(true)}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-[#F5F5DC] hover:bg-[#F5F5DC]/90 text-[#0f0f0f] rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Withdraw
                    </button>
                  </>
                )}
              </div>

              {/* Logout Button */}
              {isOwnProfile && (
                <>
                  <div className="border-t border-[#2a2a2a] my-4" />
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-400/5 border border-[#2a2a2a] hover:border-red-400/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Content Area */}
          <div>
            {/* Tab Navigation */}
            <div className="border-b border-[#2a2a2a] mb-6">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`px-6 py-3 font-medium text-[15px] transition-colors rounded-t-lg ${
                    activeTab === 'posts'
                      ? 'text-white border-b-2 border-[#B9D9EB]'
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  Posts ({stats.total_posts})
                </button>
                <button
                  onClick={() => setActiveTab('holdings')}
                  className={`px-6 py-3 font-medium text-[15px] transition-colors rounded-t-lg ${
                    activeTab === 'holdings'
                      ? 'text-white border-b-2 border-[#B9D9EB]'
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  Holdings {holdings.length > 0 ? `(${holdings.length})` : ''}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div>
              {/* Posts Tab */}
              {activeTab === 'posts' && (
                <>
                  {recent_posts && recent_posts.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {recent_posts.map((post) => (
                        <CompactProfilePostCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                      <p className="text-white font-medium mb-2 text-lg">
                        No posts yet
                      </p>
                      <p className="text-gray-400 text-sm mb-6">
                        {isOwnProfile ? 'Create your first post!' : 'This user hasn\'t posted anything yet.'}
                      </p>
                      {isOwnProfile && (
                        <button
                          onClick={() => router.push('/feed')}
                          className="px-6 py-3 bg-[#B9D9EB] text-[#0C1D51] rounded-xl font-medium hover:bg-[#B9D9EB]/90 transition-all duration-200 hover:scale-105"
                        >
                          Create Post
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Holdings Tab */}
              {activeTab === 'holdings' && (
                <>
                  {holdingsLoading ? (
                    <div className="text-center py-16">
                      <p className="text-gray-400">Loading holdings...</p>
                    </div>
                  ) : holdings.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {holdings.map((holding) => (
                        <HoldingCard
                          key={holding.post.id}
                          post={{
                            id: holding.post.id,
                            post_type: holding.post.post_type,
                            content_text: holding.post.content_text,
                            caption: holding.post.caption,
                            media_urls: holding.post.media_urls,
                            cover_image: holding.post.cover_image,
                            title: holding.post.title,
                            author: {
                              username: holding.post.author.username,
                              display_name: holding.post.author.display_name,
                            },
                            timestamp: holding.post.created_at,
                            poolAddress: holding.pool.pool_address,
                            poolLongTokenSupply: holding.pool.supply_long,
                            poolShortTokenSupply: holding.pool.supply_short,
                          }}
                          holdings={{
                            long_balance: holding.balance.long_balance,
                            short_balance: holding.balance.short_balance,
                            token_balance: holding.balance.long_balance + holding.balance.short_balance,
                            current_value_usdc: holding.balance.current_value_usdc,
                            total_usdc_spent: holding.balance.total_usdc_spent,
                            total_usdc_received: holding.balance.total_usdc_received,
                            total_lock_usdc: holding.balance.total_lock_usdc,
                            price_long: holding.balance.price_long,
                            price_short: holding.balance.price_short,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                      <p className="text-white font-medium mb-2 text-lg">
                        No holdings yet
                      </p>
                      <p className="text-gray-400 text-sm mb-6">
                        {isOwnProfile ? 'Buy tokens to support posts!' : 'This user doesn\'t hold any tokens yet.'}
                      </p>
                      {isOwnProfile && (
                        <button
                          onClick={() => router.push('/feed')}
                          className="px-6 py-3 bg-[#B9D9EB] text-[#0C1D51] rounded-xl font-medium hover:bg-[#B9D9EB]/90 transition-all duration-200 hover:scale-105"
                        >
                          Browse Feed
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {showEditModal && (
          <EditProfileModal
            currentUsername={user.username}
            currentAvatarUrl={user.avatar_url}
            onClose={() => setShowEditModal(false)}
            onSuccess={async () => {
              // Refresh both user data and profile data
              await refreshUser();
              mutate();
            }}
          />
        )}

        {/* Withdraw Modal */}
        {showWithdrawModal && (
          <WithdrawModal
            totalStake={stats.total_stake}
            totalLocked={totalLocked}
            onClose={() => setShowWithdrawModal(false)}
            onSuccess={async () => {
              // Refresh profile data after withdrawal
              mutate();
              // Re-fetch holdings to update locked amount
              if (holdings.length > 0) {
                fetchHoldings();
              }
            }}
          />
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
      <div className="h-6 w-16 bg-[#1a1a1a] rounded mb-8" />

      {/* Two-column layout skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 max-w-[1400px] mx-auto">
        {/* LEFT COLUMN - Profile Info Skeleton */}
        <div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            {/* Avatar skeleton */}
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-[#0f0f0f]" />
            </div>

            {/* Name skeleton */}
            <div className="h-8 w-32 bg-[#0f0f0f] rounded mx-auto mb-1" />

            {/* Username skeleton */}
            <div className="h-5 w-24 bg-[#0f0f0f] rounded mx-auto mb-3" />

            {/* Wallet skeleton */}
            <div className="h-9 w-full bg-[#0f0f0f] rounded mb-4" />

            {/* Action buttons skeleton */}
            <div className="space-y-2 mb-4">
              <div className="h-10 w-full bg-[#0f0f0f] rounded" />
              <div className="h-10 w-full bg-[#0f0f0f] rounded" />
            </div>

            {/* Divider */}
            <div className="border-t border-[#2a2a2a] my-4" />

            {/* Stats skeleton */}
            <div className="space-y-3">
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4">
                <div className="h-4 w-16 bg-[#1a1a1a] rounded mb-2" />
                <div className="h-8 w-20 bg-[#1a1a1a] rounded" />
              </div>
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4">
                <div className="h-4 w-16 bg-[#1a1a1a] rounded mb-2" />
                <div className="h-8 w-20 bg-[#1a1a1a] rounded" />
              </div>
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4">
                <div className="h-4 w-16 bg-[#1a1a1a] rounded mb-2" />
                <div className="h-8 w-20 bg-[#1a1a1a] rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Content Skeleton */}
        <div>
          {/* Tab navigation skeleton */}
          <div className="border-b border-[#2a2a2a] mb-6">
            <div className="flex gap-1">
              <div className="h-12 w-24 bg-[#1a1a1a] rounded-t-lg" />
              <div className="h-12 w-28 bg-[#1a1a1a] rounded-t-lg" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
                <div className="h-4 w-32 bg-[#0f0f0f] rounded mb-3" />
                <div className="h-6 w-full bg-[#0f0f0f] rounded mb-2" />
                <div className="h-4 w-3/4 bg-[#0f0f0f] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

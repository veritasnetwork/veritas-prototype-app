/**
 * ProfilePage Component
 * Displays user profile with stats, stake information, and recent activity
 */

'use client';

import { useRouter } from 'next/navigation';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { CompactProfilePostCard } from '@/components/profile/CompactProfilePostCard';
import { HoldingCard } from '@/components/profile/HoldingCard';
import { FundWalletButton } from '@/components/wallet/FundWalletButton';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { WithdrawModal } from '@/components/profile/WithdrawModal';
import { TransferFundsModal } from '@/components/wallet/TransferFundsModal';
import { ManageWalletButton } from '@/components/wallet/ManageWalletButton';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { truncateAddress, formatCurrency } from '@/utils/formatters';
import { useState, useEffect, useRef } from 'react';
import { Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfilePageProps {
  username: string;
}

type TabType = 'posts' | 'holdings';

export function ProfilePage({ username }: ProfilePageProps) {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { user: currentUser, logout, refreshUser, needsOnboarding, isLoading: authLoading } = useAuth();
  const { data: profileData, isLoading, error, mutate } = useProfile(username);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  // Use the wallet balances hook for environment-aware balance fetching
  const {
    sol: solBalance,
    usdc: usdcBalance,
    loading: balancesLoading,
    refresh: refreshBalances
  } = useWalletBalances(isOwnProfile ? profileData?.user?.solana_address : null);

  // Track if user was logged in on mount
  const wasLoggedInRef = useRef(!!currentUser);

  // Redirect to feed if user logs out
  useEffect(() => {
    if (wasLoggedInRef.current && !currentUser) {
      router.push('/feed');
    }
  }, [currentUser, router]);

  // Redirect to feed if unauthenticated user tries to view a profile that doesn't exist
  useEffect(() => {
    if (!authenticated && !authLoading && error) {
      router.push('/feed');
    }
  }, [authenticated, authLoading, error, router]);

  // Fetch holdings when Holdings tab is clicked
  useEffect(() => {
    if (activeTab === 'holdings' && holdings.length === 0) {
      fetchHoldings();
    }
  }, [activeTab]);

  const fetchHoldings = async () => {
    setHoldingsLoading(true);
    try {
      const response = await fetch(`/api/users/${username}/holdings`);
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
      }
    } catch (err) {
      console.error('Failed to fetch holdings:', err);
    } finally {
      setHoldingsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/feed');
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
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-3 border-[#B9D9EB] bg-[#F5F5DC] flex items-center justify-center shadow-lg">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-[#0C1D51] text-3xl font-bold">
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  {/* Edit Profile Button - Only show on own profile */}
                  {isOwnProfile && (
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="absolute top-0 right-0 w-6 h-6 bg-[#B9D9EB] hover:bg-[#a3cfe3] text-[#0C1D51] rounded-full flex items-center justify-center shadow-lg transition-colors"
                      aria-label="Edit profile"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Display Name and Username */}
              <div className="text-center mb-4">
                <div className="flex items-baseline justify-center gap-2">
                  <h1 className="text-2xl font-bold text-white">
                    {user.display_name || user.username}
                  </h1>
                  <span className="text-sm font-medium text-gray-400">
                    @{user.username}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#2a2a2a] my-4" />

              {/* Balances - Compact List */}
              {isOwnProfile && (
                <div className="space-y-3">
                  {/* USDC Balance */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-400">USDC</p>
                      <p className="text-lg font-bold text-white">
                        {balancesLoading ? '...' : formatCurrency(usdcBalance)}
                      </p>
                    </div>
                    <div className="mt-5">
                      <FundWalletButton variant="compact" currency="USDC" />
                    </div>
                  </div>

                  {/* SOL Balance */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-400">SOL</p>
                      <p className="text-lg font-bold text-white">
                        {balancesLoading ? '...' : solBalance.toFixed(4)}
                      </p>
                    </div>
                    <div className="mt-5">
                      <FundWalletButton variant="compact" currency="SOL" />
                    </div>
                  </div>

                  {/* Total Stake */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-400">Total Stake</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(stats.total_stake)}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowWithdrawModal(true)}
                      className="text-sm font-medium text-gray-400 hover:text-white transition-colors mt-5 px-3 py-1 rounded-md border border-[#2a2a2a] hover:border-gray-400"
                    >
                      Withdraw
                    </button>
                  </div>

                  {/* Send & Settings Buttons */}
                  <div className="border-t border-[#2a2a2a] pt-3 mt-1">
                    <div className="relative flex items-center -mt-3 pt-3 pb-3">
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="absolute inset-0 text-sm font-medium text-gray-400 hover:text-[#B9D9EB] transition-colors flex items-center justify-center gap-1.5 border-t border-transparent hover:border-[#B9D9EB]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        Send
                      </button>
                      <div className="ml-auto relative z-10 flex items-center gap-2">
                        <div className="h-4 w-px bg-[#2a2a2a]" />
                        <ManageWalletButton variant="icon" className="!p-0 !hover:bg-transparent" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Logout Button */}
              {isOwnProfile && (
                <div className="border-t border-[#2a2a2a] pt-3 mt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-sm font-medium text-gray-400 hover:text-orange-400 transition-colors text-center flex items-center justify-center gap-1.5 -mt-3 pt-3 border-t border-transparent hover:border-orange-400"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Content Area */}
          <div>
            {/* Tab Navigation - Sliding Toggle */}
            <div className="mb-6">
              <div className="relative flex gap-2 p-1 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
                {/* Animated background slider */}
                <div
                  className={cn(
                    "absolute top-1 bottom-1 rounded-md transition-all duration-300 ease-in-out",
                    activeTab === 'posts' ? "left-1 right-[calc(50%+4px)] bg-[#B9D9EB]" : "left-[calc(50%+4px)] right-1 bg-[#B9D9EB]"
                  )}
                />
                <button
                  onClick={() => setActiveTab('posts')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-300 text-sm relative z-10",
                    activeTab === 'posts'
                      ? "text-black"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Posts
                </button>
                <button
                  onClick={() => setActiveTab('holdings')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-300 text-sm relative z-10",
                    activeTab === 'holdings'
                      ? "text-black"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Holdings
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
                      {holdings.map((holding, index) => (
                        <HoldingCard
                          key={`${holding.post?.id}-${holding.token_type}-${index}`}
                          tokenType={holding.token_type}
                          post={{
                            id: holding.post?.id,
                            post_type: holding.post?.post_type,
                            content_text: holding.post?.content_text,
                            caption: holding.post?.caption,
                            media_urls: holding.post?.media_urls,
                            cover_image: holding.post?.cover_image,
                            title: holding.post?.title,
                            author: {
                              username: holding.post?.author?.username || 'unknown',
                              display_name: holding.post?.author?.display_name,
                            },
                            timestamp: holding.post?.created_at,
                            poolAddress: holding.pool?.pool_address,
                            poolLongTokenSupply: holding.pool?.supply_long ?? 0,
                            poolShortTokenSupply: holding.pool?.supply_short ?? 0,
                          }}
                          holdings={{
                            token_balance: holding.holdings?.token_balance ?? 0,
                            current_value_usdc: holding.holdings?.current_value_usdc ?? 0,
                            total_usdc_spent: holding.holdings?.total_usdc_spent ?? 0,
                            total_usdc_received: holding.holdings?.total_usdc_received ?? 0,
                            belief_lock: holding.holdings?.belief_lock ?? 0,
                            current_price: holding.holdings?.current_price ?? 0,
                            entry_price: holding.holdings?.entry_price,
                          }}
                          pool={{
                            supply_long: holding.pool?.supply_long ?? 0,
                            supply_short: holding.pool?.supply_short ?? 0,
                            price_long: holding.pool?.price_long ?? 0,
                            price_short: holding.pool?.price_short ?? 0,
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
            totalLocked={stats.total_locked || 0}
            onClose={() => setShowWithdrawModal(false)}
            onSuccess={async () => {
              // Refresh profile data after withdrawal
              mutate();
            }}
          />
        )}

        {/* Transfer Funds Modal */}
        {showTransferModal && (
          <TransferFundsModal
            isOpen={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            solBalance={solBalance}
            usdcBalance={usdcBalance}
            onSuccess={() => {
              // Refresh balances after transfer
              refreshBalances();
            }}
          />
        )}

        {/* Onboarding Modal - Show if user needs onboarding */}
        {authenticated && needsOnboarding && !authLoading && (
          <OnboardingModal isOpen={true} />
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
          <div className="mb-6">
            <div className="h-11 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]" />
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

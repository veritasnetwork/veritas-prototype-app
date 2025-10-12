/**
 * ProfilePage Component
 * Displays user profile with stats, stake information, and recent activity
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { PostCard } from '@/components/feed/PostCard/PostCard';
import { CompactPostCard } from '@/components/feed/CompactPostCard';
import { truncateAddress, formatCurrency } from '@/utils/formatters';
import { useState, useEffect } from 'react';

interface ProfilePageProps {
  username: string;
}

type TabType = 'posts' | 'holdings';

export function ProfilePage({ username }: ProfilePageProps) {
  const router = useRouter();
  const { user: currentUser, logout } = useAuth();
  const { data: profileData, isLoading, error } = useProfile(username);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  const isOwnProfile = currentUser?.username === username;

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
    if (confirm('Are you sure you want to logout?')) {
      logout();
      router.push('/');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#0f0f0f]">
        <div className="max-w-[680px] mx-auto px-6 md:px-6 py-8 md:py-12">
          <ProfileSkeleton />
        </div>
      </main>
    );
  }

  // Error state
  if (error || !profileData) {
    return (
      <main className="min-h-screen bg-[#0f0f0f]">
        <div className="max-w-[680px] mx-auto px-6 md:px-6 py-8 md:py-12">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-6"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div className="text-center py-12">
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
      <div className="max-w-[680px] mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Back Navigation & Logout */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          {/* Logout Button (Own Profile Only) */}
          {isOwnProfile && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-[#1a1a1a] rounded-lg transition-colors flex items-center gap-2"
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
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-3 border-[#B9D9EB] bg-gradient-to-br from-[#B9D9EB] to-[#0C1D51] flex items-center justify-center shadow-lg">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-white text-3xl md:text-4xl font-bold">
                  {user.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
          </div>

          {/* Display Name */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {user.display_name || user.username}
          </h1>

          {/* Username */}
          <p className="text-lg font-medium text-gray-400 mb-3">
            @{user.username}
          </p>

          {/* Wallet Address */}
          {user.solana_address && (
            <button
              onClick={handleCopyWallet}
              className="font-mono text-sm text-gray-500 hover:text-gray-300 transition-colors relative inline-block"
              aria-label="Copy wallet address"
            >
              {truncateAddress(user.solana_address)}
              {copiedWallet && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] text-white text-xs py-1 px-3 rounded-lg shadow-lg whitespace-nowrap border border-[#2a2a2a]">
                  Address copied!
                </span>
              )}
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Stake */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <p className="text-sm font-medium text-gray-400 mb-2">
              Stake
            </p>
            <p className="text-3xl font-bold text-white">
              {formatCurrency(stats.total_stake)}
            </p>
          </div>

          {/* Posts */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <p className="text-sm font-medium text-gray-400 mb-2">
              Posts
            </p>
            <p className="text-3xl font-bold text-white">
              {stats.total_posts}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#2a2a2a] mb-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-5 py-3 font-medium text-[15px] transition-colors rounded-t-lg ${
                activeTab === 'posts'
                  ? 'text-white border-b-2 border-[#B9D9EB]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-5 py-3 font-medium text-[15px] transition-colors rounded-t-lg ${
                activeTab === 'holdings'
                  ? 'text-white border-b-2 border-[#B9D9EB]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
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
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
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
                <div className="text-center py-12">
                  <p className="text-gray-400">Loading holdings...</p>
                </div>
              ) : holdings.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {holdings.map((holding) => (
                    <CompactPostCard
                      key={holding.post.id}
                      post={{
                        id: holding.post.id,
                        post_type: holding.post.post_type,
                        content_text: holding.post.content_text,
                        caption: holding.post.caption,
                        media_urls: holding.post.media_urls,
                        author: {
                          username: holding.post.author.username,
                          display_name: holding.post.author.display_name,
                        },
                        timestamp: holding.post.created_at,
                        poolAddress: holding.pool.pool_address,
                        poolTokenSupply: holding.pool.token_supply,
                        poolReserveBalance: holding.pool.reserve * 1_000_000, // Convert back to micro-USDC
                        poolKQuadratic: holding.pool.k_quadratic,
                      }}
                      holdings={{
                        token_balance: holding.balance.token_balance,
                        current_value_usdc: holding.balance.current_value_usdc,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
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

      {/* Profile header skeleton */}
      <div className="text-center mb-8">
        {/* Avatar skeleton */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-[#1a1a1a]" />
        </div>

        {/* Name skeleton */}
        <div className="h-10 w-48 bg-[#1a1a1a] rounded mx-auto mb-2" />

        {/* Username skeleton */}
        <div className="h-6 w-32 bg-[#1a1a1a] rounded mx-auto mb-3" />

        {/* Wallet skeleton */}
        <div className="h-4 w-40 bg-[#1a1a1a] rounded mx-auto" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="h-4 w-12 bg-[#0f0f0f] rounded mx-auto mb-3" />
          <div className="h-10 w-20 bg-[#0f0f0f] rounded mx-auto" />
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="h-4 w-12 bg-[#0f0f0f] rounded mx-auto mb-3" />
          <div className="h-10 w-20 bg-[#0f0f0f] rounded mx-auto" />
        </div>
      </div>

      {/* Tab navigation skeleton */}
      <div className="border-b border-[#2a2a2a] mb-6">
        <div className="flex gap-1">
          <div className="h-10 w-20 bg-[#1a1a1a] rounded-t-lg" />
          <div className="h-10 w-24 bg-[#1a1a1a] rounded-t-lg" />
        </div>
      </div>

      {/* Recent activity skeleton */}
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
  );
}

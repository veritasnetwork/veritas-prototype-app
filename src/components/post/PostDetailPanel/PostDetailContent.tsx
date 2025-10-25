/**
 * PostDetailContent Component
 * Full post content display for the detail panel
 * Phase 2: Complete post display with pool metrics
 */

'use client';

import { useState, useEffect } from 'react';
import { getPostTitle, type Post } from '@/types/post.types';
import { TiptapRenderer } from '../TiptapRenderer';
import { usePanel } from './PanelProvider';
import { DeployPoolCard } from './DeployPoolCard';
import { PoolMetricsCard } from './PoolMetricsCard';
import { UnifiedSwapComponent } from './UnifiedSwapComponent';
import { TradingChartCard } from './TradingChartCard';
import { SettlementButton } from '@/components/pool/SettlementButton';
import { usePoolData } from '@/hooks/usePoolData';
import { useTradeHistory } from '@/hooks/api/useTradeHistory';
import { invalidatePoolData } from '@/services/PoolDataService';
import { supabase } from '@/lib/supabase';

interface PostDetailContentProps {
  postId: string;
}

interface PoolDeployment {
  pool_address: string;
  status: string;
  belief_id: string;
}

interface Belief {
  previous_aggregate: number | null;
}

export function PostDetailContent({ postId }: PostDetailContentProps) {
  const { closePanel } = usePanel();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lifted state: which side is selected in the swap component
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');

  // Fetch pool data from chain
  const { poolData, loading: poolLoading, error: poolError } = usePoolData(post?.poolAddress || undefined, postId);
  const { data: tradeHistory } = useTradeHistory(post?.poolAddress || undefined);

  // Callback to refresh chart and pool data after trade
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleTradeSuccess = () => {
    console.log('[PostDetailContent] Trade completed, triggering refresh');
    setRefreshTrigger(prev => prev + 1);

    // Invalidate pool data cache to fetch fresh metrics
    invalidatePoolData(postId);
  };

  // Debug: Log pool data state
  useEffect(() => {
    console.log('🔍 [PostDetailContent] Pool data state:', {
      postId,
      poolAddress: post?.poolAddress,
      poolData,
      poolLoading,
      poolError: poolError?.message,
      hasPoolData: !!poolData
    });
  }, [postId, post?.poolAddress, poolData, poolLoading, poolError]);

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/posts/${postId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch post: ${response.status}`);
        }

        const data = await response.json();
        setPost(data);
      } catch (err) {
        console.error('[PostDetailContent] Error fetching post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading post...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <p className="text-gray-400">Unable to load post. Please try again.</p>
        </div>
      </div>
    );
  }

  const postTitle = getPostTitle(post);

  return (
    <div className="p-6 relative">
      {/* Close Button */}
      <button
        onClick={closePanel}
        className="absolute top-6 left-6 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors z-10"
        aria-label="Close"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4L4 12M4 4L12 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Post Header */}
      <div className="mb-6 mt-8">
        <h1 className="text-2xl font-bold text-white mb-2">{postTitle}</h1>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>@{post.author?.username || 'unknown'}</span>
          <span>•</span>
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Post Content */}
      <div className="prose prose-invert max-w-none">
        {post.contentRich ? (
          <TiptapRenderer content={post.contentRich} />
        ) : (
          <p className="text-gray-300 whitespace-pre-wrap">{post.content}</p>
        )}
      </div>

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className="mt-6 space-y-4">
          {post.media.map((item, index) => (
            <div key={index}>
              {item.type === 'image' && (
                <img src={item.url} alt={item.alt || ''} className="rounded-lg max-w-full" />
              )}
              {item.type === 'video' && (
                <video src={item.url} controls className="rounded-lg max-w-full" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pool Section */}
      <div className="mt-8 border-t border-[#2a2a2a] pt-6">
        <h2 className="text-lg font-semibold text-white mb-4">Market</h2>

        {!post?.poolAddress ? (
          <DeployPoolCard
            postId={postId}
            onDeploySuccess={() => {
              // Refresh to show the newly deployed pool
              window.location.reload();
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Trading Chart */}
            <TradingChartCard
              postId={postId}
              refreshTrigger={refreshTrigger}
            />

            {/* Pool Metrics */}
            {poolLoading ? (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
                  <div className="h-6 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ) : poolError ? (
              <div className="bg-[#1a1a1a] border border-red-900/50 rounded-lg p-4">
                <p className="text-red-400 text-sm">Failed to load pool metrics: {poolError.message}</p>
              </div>
            ) : poolData ? (
              <PoolMetricsCard
                poolData={poolData}
                stats={tradeHistory?.stats}
                side={selectedSide}
              />
            ) : (
              <div className="bg-[#1a1a1a] border border-yellow-900/50 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">Pool data not available. Waiting for on-chain sync...</p>
              </div>
            )}

            {/* Swap Component */}
            {poolLoading ? (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                <div className="animate-pulse">
                  <div className="h-10 bg-gray-700 rounded mb-4"></div>
                  <div className="h-20 bg-gray-700 rounded"></div>
                </div>
              </div>
            ) : poolError ? (
              <div className="bg-[#1a1a1a] border border-red-900/50 rounded-lg p-4">
                <p className="text-red-400 text-sm">Trading unavailable: {poolError.message}</p>
              </div>
            ) : poolData ? (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                <UnifiedSwapComponent
                  poolAddress={post.poolAddress}
                  postId={postId}
                  priceLong={poolData.priceLong}
                  priceShort={poolData.priceShort}
                  supplyLong={poolData.supplyLong}
                  supplyShort={poolData.supplyShort}
                  f={poolData.f}
                  betaNum={poolData.betaNum}
                  betaDen={poolData.betaDen}
                  selectedSide={selectedSide}
                  onSideChange={setSelectedSide}
                  onTradeSuccess={handleTradeSuccess}
                />
              </div>
            ) : (
              <div className="bg-[#1a1a1a] border border-yellow-900/50 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">Swap interface unavailable. Waiting for pool data...</p>
              </div>
            )}

            {/* Settlement Button - only show if BD score is available */}
            {post?.belief?.previous_aggregate !== undefined && post?.poolAddress && (
              <SettlementButton
                postId={postId}
                poolAddress={post.poolAddress}
                bdScore={post.belief.previous_aggregate}
                onSettlementSuccess={handleTradeSuccess}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

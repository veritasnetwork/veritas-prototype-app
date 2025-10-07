'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { useSellTokens } from '@/hooks/useSellTokens';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';

interface PostDetailViewProps {
  postId: string;
}

type TabType = 'overview' | 'trading' | 'analytics';

export function PostDetailView({ postId }: PostDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [postData, setPostData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { address: solanaAddress } = useSolanaWallet();
  const { buyTokens, isLoading: isBuying } = useBuyTokens();
  const { sellTokens, isLoading: isSelling } = useSellTokens();

  // Trading state
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState(false);

  // Fetch post data
  useEffect(() => {
    async function fetchPost() {
      try {
        setLoading(true);
        const response = await fetch(`/api/posts/${postId}`);

        if (!response.ok) {
          throw new Error('Post not found');
        }

        const data = await response.json();
        setPostData(data);
      } catch (err) {
        console.error('Error fetching post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId]);

  // Fetch history data when analytics tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && !historyData) {
      async function fetchHistory() {
        try {
          const response = await fetch(`/api/posts/${postId}/history`);
          if (response.ok) {
            const data = await response.json();
            setHistoryData(data);
          }
        } catch (err) {
          console.error('Error fetching history:', err);
        }
      }
      fetchHistory();
    }
  }, [activeTab, postId, historyData]);

  const handleTrade = async () => {
    if (!solanaAddress) {
      setTradeError('Please connect your Solana wallet');
      return;
    }

    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      setTradeError('Please enter a valid amount');
      return;
    }

    if (!postData?.post?.id || !postData?.pool?.[0]?.pool_address) {
      setTradeError('Pool data not available');
      return;
    }

    try {
      setTradeError(null);
      setTradeSuccess(false);

      if (tradeType === 'buy') {
        // Convert USDC amount to base units
        const usdcBaseAmount = Math.floor(amount * 1_000_000);
        await buyTokens(postData.post.id, postData.pool[0].pool_address, usdcBaseAmount);
      } else {
        // Sell tokens
        await sellTokens(postData.post.id, postData.pool[0].pool_address, amount);
      }

      setTradeSuccess(true);
      setTradeAmount('');

      // Refresh post data
      const response = await fetch(`/api/posts/${postId}`);
      if (response.ok) {
        const data = await response.json();
        setPostData(data);
      }
    } catch (err) {
      console.error('Trade error:', err);
      setTradeError(err instanceof Error ? err.message : 'Trade failed');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-12 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-8"></div>
        </div>
      </div>
    );
  }

  if (error || !postData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-xl text-red-500 mb-4">{error || 'Post not found'}</p>
          <button
            onClick={() => router.push('/feed')}
            className="text-blue-500 hover:underline"
          >
            ← Back to Feed
          </button>
        </div>
      </div>
    );
  }

  const post = postData.post;
  const belief = postData.belief;
  const pool = postData.pool && postData.pool.length > 0 ? postData.pool[0] : null;
  const userHoldings = postData.user_holdings;

  // Calculate pool metrics
  const tokenSupply = pool ? parseInt(pool.token_supply) : 0;
  const reserve = pool ? parseInt(pool.reserve) / 1_000_000 : 0; // Convert micro-USDC to USDC
  const kQuadratic = pool?.k_quadratic || 1;
  const currentPrice = tokenSupply > 0 ? reserve / (kQuadratic * Math.pow(tokenSupply, 2)) : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <button
        onClick={() => router.push('/feed')}
        className="text-text-secondary hover:text-text-primary mb-6 flex items-center gap-2"
      >
        <span>←</span> Back to Feed
      </button>

      {/* Post Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
            {post.users?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium">{post.users?.display_name || post.users?.username || 'Unknown'}</p>
            <p className="text-sm text-text-secondary">
              {new Date(post.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4">{post.title || 'Untitled'}</h1>
        <p className="text-lg leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-2">
          {(['overview', 'trading', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-text-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Belief Market Status */}
            {belief && (
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">📊 Belief Market Status</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">Current Aggregate</p>
                    <p className="text-2xl font-bold">
                      {((belief.previous_aggregate || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Delta Relevance</p>
                    <p className={`text-2xl font-bold ${
                      (belief.delta_relevance || 0) > 0 ? 'text-green-500' :
                      (belief.delta_relevance || 0) < 0 ? 'text-red-500' : ''
                    }`}>
                      {((belief.delta_relevance || 0) * 100).toFixed(1)}%
                      {(belief.delta_relevance || 0) > 0 ? ' ↑' :
                       (belief.delta_relevance || 0) < 0 ? ' ↓' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Certainty</p>
                    <p className="text-xl font-bold">
                      {((belief.certainty || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Status</p>
                    <p className="text-xl font-bold capitalize">{belief.status || 'unknown'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pool Metrics */}
            {pool && (
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">💎 Pool Metrics</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">Token Supply</p>
                    <p className="text-xl font-bold">{tokenSupply.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Reserve</p>
                    <p className="text-xl font-bold">${reserve.toFixed(2)} USDC</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Current Price</p>
                    <p className="text-xl font-bold">${currentPrice.toFixed(6)} USDC</p>
                  </div>
                  {userHoldings && (
                    <div>
                      <p className="text-sm text-text-secondary">Your Holdings</p>
                      <p className="text-xl font-bold">
                        {parseFloat(userHoldings.token_balance).toFixed(2)} tokens
                      </p>
                      <p className="text-sm text-text-secondary">
                        (${(parseFloat(userHoldings.token_balance) * currentPrice).toFixed(2)})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trading' && pool && (
          <div className="card p-6 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-6">Trade Tokens</h2>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setTradeType('buy')}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  tradeType === 'buy'
                    ? 'bg-accent-dark text-white'
                    : 'bg-bg-hover text-text-secondary'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeType('sell')}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  tradeType === 'sell'
                    ? 'bg-accent-dark text-white'
                    : 'bg-bg-hover text-text-secondary'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Amount {tradeType === 'buy' ? '(USDC)' : '(Tokens)'}
              </label>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder={tradeType === 'buy' ? '1.0' : '100'}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-accent-primary focus:outline-none"
                min="0"
                step={tradeType === 'buy' ? '0.01' : '1'}
              />
            </div>

            {/* Error/Success Messages */}
            {tradeError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {tradeError}
              </div>
            )}
            {tradeSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
                ✅ Trade successful!
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleTrade}
              disabled={isBuying || isSelling || !tradeAmount}
              className="w-full py-4 bg-accent-dark text-white rounded-lg font-medium hover:bg-accent-darker disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isBuying || isSelling
                ? 'Processing...'
                : !solanaAddress
                ? 'Connect Wallet'
                : `${tradeType === 'buy' ? 'Buy' : 'Sell'} Tokens`}
            </button>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Price History Chart */}
            {historyData?.price_history && historyData.price_history.length > 0 ? (
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Token Price History</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={historyData.price_history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="recorded_at"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: any) => [`$${parseFloat(value).toFixed(6)}`, 'Price']}
                    />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card p-6 text-center text-text-secondary">
                <p>No price history available yet</p>
              </div>
            )}

            {/* Belief History Chart */}
            {historyData?.belief_history && historyData.belief_history.length > 0 ? (
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Delta Relevance History</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={historyData.belief_history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="epoch" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => [`${(parseFloat(value) * 100).toFixed(1)}%`, 'Delta Relevance']}
                    />
                    <Line
                      type="monotone"
                      dataKey="delta_relevance"
                      stroke="#82ca9d"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card p-6 text-center text-text-secondary">
                <p>No belief history available yet</p>
              </div>
            )}

            {/* Trade History */}
            {historyData?.trade_history && historyData.trade_history.length > 0 && (
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Recent Trades</h2>
                <div className="space-y-2">
                  {historyData.trade_history.slice(-10).reverse().map((trade: any) => (
                    <div key={trade.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <span className={`font-medium ${trade.trade_type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.trade_type.toUpperCase()}
                        </span>
                        <span className="text-text-secondary ml-2">
                          {parseFloat(trade.token_amount).toFixed(2)} tokens
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">${(parseFloat(trade.usdc_amount) / 1_000_000).toFixed(2)}</p>
                        <p className="text-xs text-text-secondary">
                          {new Date(trade.recorded_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

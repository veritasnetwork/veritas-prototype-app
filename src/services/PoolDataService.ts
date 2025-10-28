/**
 * PoolDataService - Centralized, efficient pool data polling
 *
 * Polls the DATABASE (not the chain) for pool state.
 * Event indexer keeps pool_deployments table fresh in real-time.
 *
 * Features:
 * - Single fetch per pool regardless of subscriber count
 * - Adaptive polling intervals (fast when active, slow when idle)
 * - Event-based invalidation on trades
 * - Automatic cleanup when no subscribers
 * - Request deduplication and caching
 */

export interface PoolData {
  priceLong: number;
  priceShort: number;
  supplyLong: number;
  supplyShort: number;
  f: number;
  betaNum: number;
  betaDen: number;
  vaultBalance: number;
  totalSupply: number;
  currentPrice: number;
  reserveBalance: number;
  marketCap: number;
}

type Subscriber = (data: PoolData | null) => void;

interface PoolSubscription {
  postId: string;
  subscribers: Set<Subscriber>;
  data: PoolData | null;
  lastFetch: number;
  intervalId: NodeJS.Timeout | null;
  isFetching: boolean;
  error: Error | null;
}

function coerceNumber(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (typeof x === 'string') {
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

function safeNumber(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

class PoolDataService {
  private subscriptions = new Map<string, PoolSubscription>();
  private cache = new Map<string, PoolData>(); // Persistent cache across subscriptions

  // Adaptive polling intervals
  private readonly ACTIVE_INTERVAL = 5000;   // 5s when recently traded
  private readonly NORMAL_INTERVAL = 30000;  // 30s normal polling
  private readonly IDLE_INTERVAL = 60000;    // 60s when idle
  private readonly ACTIVE_WINDOW = 60000;    // 60s after trade = "active"

  /**
   * Subscribe to pool data updates with optional initial data
   */
  subscribe(postId: string, callback: Subscriber, initialData?: PoolData | null): () => void {
    console.log('[PoolDataService] subscribe called for postId:', postId);
    let sub = this.subscriptions.get(postId);

    if (!sub) {
      console.log('[PoolDataService] Creating new subscription for postId:', postId);
      // Create new subscription
      sub = {
        postId,
        subscribers: new Set(),
        data: initialData || null,
        lastFetch: 0,
        intervalId: null,
        isFetching: false,
        error: null,
      };
      this.subscriptions.set(postId, sub);

      // If initial data provided, cache it immediately
      if (initialData) {
        console.log('[PoolDataService] Caching initial data for postId:', postId);
        this.cache.set(postId, initialData);
      }
    }

    // Add subscriber
    sub.subscribers.add(callback);
    console.log('[PoolDataService] Total subscribers for postId:', postId, '=', sub.subscribers.size);

    // Check for cached data first (prioritize: initialData > persistent cache > subscription data)
    const cachedData = initialData || this.cache.get(postId) || sub.data;
    if (cachedData) {
      console.log('[PoolDataService] Using cached data for postId:', postId);
      // Immediately notify with cached data (synchronous)
      callback(cachedData);
      sub.data = cachedData; // Ensure subscription has the cached data
    }

    // If first subscriber, start polling
    if (sub.subscribers.size === 1) {
      console.log('[PoolDataService] First subscriber, starting polling for postId:', postId);
      this.startPolling(postId);
    }

    // Return unsubscribe function
    return () => {
      const subscription = this.subscriptions.get(postId);
      if (!subscription) {
        return;
      }

      subscription.subscribers.delete(callback);

      // If no more subscribers, stop polling and cleanup
      if (subscription.subscribers.size === 0) {
        this.stopPolling(postId);
        this.subscriptions.delete(postId);
      }
    };
  }

  /**
   * Invalidate cache and trigger immediate refresh
   */
  invalidate(postId: string) {
    const sub = this.subscriptions.get(postId);
    if (!sub) {
      console.warn(`⚠️  [PoolDataService] No subscription found for postId: ${postId}`);
      return;
    }

    // Mark as recently active for faster polling
    sub.lastFetch = 0; // Force immediate fetch

    // Fetch immediately
    this.fetchPoolData(postId);

    // Restart polling with active interval
    this.restartPolling(postId, this.ACTIVE_INTERVAL);

    // After active window, revert to normal interval
    setTimeout(() => {
      this.restartPolling(postId, this.NORMAL_INTERVAL);
    }, this.ACTIVE_WINDOW);
  }

  /**
   * Get current interval based on activity
   */
  private getInterval(postId: string): number {
    const sub = this.subscriptions.get(postId);
    if (!sub) return this.NORMAL_INTERVAL;

    const timeSinceLastFetch = Date.now() - sub.lastFetch;

    // Active: recently fetched (likely due to trade)
    if (timeSinceLastFetch < this.ACTIVE_WINDOW) {
      return this.ACTIVE_INTERVAL;
    }

    // Normal: regular activity
    if (sub.subscribers.size > 0) {
      return this.NORMAL_INTERVAL;
    }

    // Idle: no recent activity
    return this.IDLE_INTERVAL;
  }

  /**
   * Start polling for a pool
   */
  private startPolling(postId: string) {
    console.log('[PoolDataService] startPolling for postId:', postId);
    const sub = this.subscriptions.get(postId);
    if (!sub) {
      console.log('[PoolDataService] No subscription found in startPolling for postId:', postId);
      return;
    }

    // Fetch immediately
    console.log('[PoolDataService] Fetching immediately for postId:', postId);
    this.fetchPoolData(postId);

    // Start interval
    const interval = this.getInterval(postId);
    console.log('[PoolDataService] Setting up interval:', interval, 'ms for postId:', postId);
    sub.intervalId = setInterval(() => {
      this.fetchPoolData(postId);
    }, interval);
  }

  /**
   * Stop polling for a pool
   */
  private stopPolling(postId: string) {
    const sub = this.subscriptions.get(postId);
    if (!sub?.intervalId) return;

    clearInterval(sub.intervalId);
    sub.intervalId = null;
  }

  /**
   * Restart polling with new interval
   */
  private restartPolling(postId: string, interval: number) {
    const sub = this.subscriptions.get(postId);
    if (!sub) return;

    // Clear existing interval
    if (sub.intervalId) {
      clearInterval(sub.intervalId);
    }

    // Start new interval
    sub.intervalId = setInterval(() => {
      this.fetchPoolData(postId);
    }, interval);
  }

  /**
   * Fetch pool data from database via API
   * Event indexer keeps the database fresh - we don't poll the chain
   */
  private async fetchPoolData(postId: string) {
    console.log('[PoolDataService] fetchPoolData called for postId:', postId);
    const sub = this.subscriptions.get(postId);
    if (!sub) {
      console.log('[PoolDataService] No subscription found in fetchPoolData for postId:', postId);
      return;
    }

    // Prevent concurrent fetches for same pool
    if (sub.isFetching) {
      console.log('[PoolDataService] Already fetching for postId:', postId);
      return;
    }

    sub.isFetching = true;

    try {
      console.log('[PoolDataService] Fetching from API for postId:', postId);
      const response = await fetch(`/api/posts/${postId}`, {
        cache: 'no-store',
        headers: {
          'X-Requested-With': 'PoolDataService',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const raw: unknown = await response.json();
      const data = (raw ?? {}) as any;

      console.log('[PoolDataService] Fetched post data:', {
        postId,
        poolAddress: data.poolAddress,
        poolPriceLong: data.poolPriceLong,
        poolPriceShort: data.poolPriceShort,
        poolSupplyLong: data.poolSupplyLong,
        poolSupplyShort: data.poolSupplyShort,
        poolVaultBalance: data.poolVaultBalance,
        poolF: data.poolF,
        poolBetaNum: data.poolBetaNum,
        poolBetaDen: data.poolBetaDen,
      });

      // If no pool deployed, return early
      if (!data.poolAddress) {
        console.log('[PoolDataService] No pool deployed for post:', postId);
        sub.data = null;
        sub.error = new Error('No pool deployed');
        this.notifySubscribers(postId);
        return;
      }

      const priceLong = coerceNumber(data.poolPriceLong);
      const priceShort = coerceNumber(data.poolPriceShort);
      const supplyLong = coerceNumber(data.poolSupplyLong);
      const supplyShort = coerceNumber(data.poolSupplyShort);

      if (priceLong === null || priceShort === null || supplyLong === null || supplyShort === null) {
        console.error('[PoolDataService] Missing pool data fields:', {
          priceLong,
          priceShort,
          supplyLong,
          supplyShort,
          rawData: data,
        });
        sub.data = null;
        sub.error = new Error('Incomplete pool data');
        this.notifySubscribers(postId);
        return;
      }

      const f = coerceNumber(data.poolF) ?? 1;
      const betaNum = coerceNumber(data.poolBetaNum) ?? 1;
      const betaDen = coerceNumber(data.poolBetaDen) ?? 2;
      const vaultBalance = coerceNumber(data.poolVaultBalance) ?? 0;

      const totalSupply = safeNumber(supplyLong + supplyShort);
      const marketCapLong = safeNumber(supplyLong * priceLong);
      const marketCapShort = safeNumber(supplyShort * priceShort);
      const marketCap = safeNumber(marketCapLong + marketCapShort);
      const currentPrice = totalSupply > 0 ? safeNumber(marketCap / totalSupply) : 0;

      const poolData: PoolData = {
        priceLong,
        priceShort,
        supplyLong,
        supplyShort,
        f,
        betaNum,
        betaDen,
        vaultBalance,
        totalSupply,
        currentPrice,
        reserveBalance: vaultBalance,
        marketCap,
      };

      sub.data = poolData;
      this.cache.set(postId, poolData); // Store in persistent cache

      sub.error = null;
      sub.lastFetch = Date.now();


      // Notify all subscribers
      this.notifySubscribers(postId);
    } catch (error) {
      console.error(`[PoolDataService] Error fetching pool ${postId}:`, error);
      sub.error = error instanceof Error ? error : new Error('Unknown error');
      this.notifySubscribers(postId);
    } finally {
      sub.isFetching = false;
    }
  }

  /**
   * Notify all subscribers with current data
   */
  private notifySubscribers(postId: string) {
    const sub = this.subscriptions.get(postId);
    if (!sub) return;

    sub.subscribers.forEach((callback) => {
      try {
        callback(sub.data);
      } catch (error) {
        console.error('[PoolDataService] Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Get current subscription count (for debugging)
   */
  getStats() {
    return {
      totalPools: this.subscriptions.size,
      poolStats: Array.from(this.subscriptions.entries()).map(([postId, sub]) => ({
        postId,
        subscribers: sub.subscribers.size,
        lastFetch: sub.lastFetch,
        hasData: !!sub.data,
        hasError: !!sub.error,
      })),
    };
  }
}

// Singleton instance
export const poolDataService = new PoolDataService();

// Global invalidation function for trade events
export function invalidatePoolData(postId: string) {
  poolDataService.invalidate(postId);
}

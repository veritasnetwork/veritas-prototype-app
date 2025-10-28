/**
 * Pool Sync Service
 *
 * Centralized service for syncing pool state from Solana to database.
 * Handles all pool state updates with proper error handling and logging.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface PoolSyncResult {
  success: boolean;
  poolAddress: string;
  error?: string;
}

export class PoolSyncService {
  /**
   * Sync pool state from Solana to database
   *
   * @param poolAddress - Solana pool address
   * @param options - Sync options
   * @returns Sync result
   */
  static async syncPool(
    poolAddress: string,
    options: { throwOnError?: boolean; timeout?: number } = {}
  ): Promise<PoolSyncResult> {
    const { throwOnError = false, timeout = 10000 } = options;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      const error = 'Missing Supabase configuration';
      console.error('[PoolSyncService] Configuration error:', error);
      if (throwOnError) throw new Error(error);
      return { success: false, poolAddress, error };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-pool-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ pool_address: poolAddress }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      return {
        success: true,
        poolAddress,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PoolSyncService] Sync error:', { poolAddress, error: errorMessage });

      if (throwOnError) {
        throw error;
      }

      return {
        success: false,
        poolAddress,
        error: errorMessage,
      };
    }
  }

  /**
   * Sync pool after a trade (non-blocking)
   * Always returns immediately, logs errors but doesn't throw
   *
   * @param poolAddress - Solana pool address
   */
  static async syncAfterTrade(poolAddress: string): Promise<void> {
    // Fire and forget - don't await
    this.syncPool(poolAddress, { throwOnError: false })
      .catch(error => {
        console.warn('[PoolSyncService] Background sync failed (non-critical):', error);
      });
  }

  /**
   * Sync pool after deployment (blocking with retry)
   * Used when initial sync is critical for UX
   *
   * @param poolAddress - Solana pool address
   * @param maxRetries - Maximum retry attempts
   */
  static async syncAfterDeployment(
    poolAddress: string,
    maxRetries: number = 3
  ): Promise<PoolSyncResult> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

      const result = await this.syncPool(poolAddress, { throwOnError: false });

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      poolAddress,
      error: `Failed after ${maxRetries} attempts: ${lastError}`,
    };
  }

  /**
   * Sync multiple pools in parallel
   *
   * @param poolAddresses - Array of pool addresses
   * @param options - Sync options
   */
  static async syncMultiplePools(
    poolAddresses: string[],
    options: { throwOnError?: boolean } = {}
  ): Promise<PoolSyncResult[]> {
    const promises = poolAddresses.map(address =>
      this.syncPool(address, options)
    );

    return Promise.all(promises);
  }

  /**
   * Trigger a full sync of all pools (admin operation)
   * Calls the edge function without a specific pool_address
   */
  static async syncAllPools(): Promise<{ success: boolean; error?: string }> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { success: false, error: 'Missing Supabase configuration' };
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-pool-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({}), // Empty body = sync all pools
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync all failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PoolSyncService] Sync all error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

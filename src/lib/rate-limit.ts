/**
 * Rate Limiting Module
 *
 * Uses Upstash Redis for distributed rate limiting across server instances.
 * Implements sliding window algorithm for accurate rate limiting.
 *
 * Setup:
 * 1. Create free Upstash account at https://upstash.com
 * 2. Create Redis database
 * 3. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (singleton)
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing Upstash environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required'
      );
    }

    redis = new Redis({
      url,
      token,
    });
  }

  return redis;
}

// Rate limiters for different endpoint types
export const rateLimiters = {
  /**
   * Pool Deployment Rate Limiter
   * Limit: 30 deployments per hour per user
   * Prevents spam pool creation while allowing active development
   */
  poolDeploy: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, '1h'),
    prefix: 'ratelimit:pool-deploy',
    analytics: true, // Track analytics in Upstash dashboard
  }),

  /**
   * Trade Rate Limiter
   * Limit: 50 trades per hour per user
   * Prevents trade spam while allowing active trading
   */
  trade: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(50, '1h'),
    prefix: 'ratelimit:trade',
    analytics: true,
  }),

  /**
   * Post Creation Rate Limiter
   * Limit: 10 posts per hour per user
   * Prevents content spam
   */
  postCreate: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, '1h'),
    prefix: 'ratelimit:post-create',
    analytics: true,
  }),

  /**
   * Media Upload Rate Limiter
   * Limit: 20 uploads per hour per user
   * Prevents storage exhaustion and bandwidth abuse
   */
  mediaUpload: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, '1h'),
    prefix: 'ratelimit:media-upload',
    analytics: true,
  }),

  /**
   * Profile Update Rate Limiter
   * Limit: 50 updates per hour per user
   * Prevents excessive profile update spam
   */
  profileUpdate: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(50, '1h'),
    prefix: 'ratelimit:profile-update',
    analytics: true,
  }),
};

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (usually user_id or wallet address)
 * @param limiter - Rate limiter instance to use
 * @returns Object with success status and response headers
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<{
  success: boolean;
  headers: Record<string, string>;
}> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    },
  };
}

/**
 * Reset rate limits for testing/admin purposes
 * Use with caution in production
 */
export async function resetRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<void> {
  // Note: Upstash doesn't provide a direct reset method
  // This is a placeholder for future implementation if needed
  console.warn('[Rate Limit] Reset not implemented - limits expire naturally');
}

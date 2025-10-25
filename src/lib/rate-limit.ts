/**
 * Rate Limiting Module
 *
 * Uses Upstash Redis for distributed rate limiting across server instances.
 * Implements sliding window algorithm for accurate rate limiting.
 *
 * For local development without Redis, rate limiting is automatically disabled.
 *
 * Setup for production:
 * 1. Create free Upstash account at https://upstash.com
 * 2. Create Redis database
 * 3. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Check if rate limiting is enabled
const isRateLimitEnabled = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Environment-specific prefix to prevent local/staging/prod cache collision
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

// Initialize Redis client (singleton)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!isRateLimitEnabled) {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return redis;
}

// Rate limiters for different endpoint types
function createRateLimiters() {
  const redisClient = getRedis();

  if (!redisClient) {
    console.log('[Rate Limit] Redis not configured - rate limiting disabled');
    return {
      poolDeploy: null,
      trade: null,
      postCreate: null,
      mediaUpload: null,
      profileUpdate: null,
    };
  }

  return {
    /**
     * Pool Deployment Rate Limiter
     * Limit: 30 deployments per hour per user
     * Prevents spam pool creation while allowing active development
     */
    poolDeploy: new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(30, '1h'),
      prefix: `${ENV_PREFIX}:ratelimit:pool-deploy`,
      analytics: true, // Track analytics in Upstash dashboard
    }),

    /**
     * Trade Rate Limiter
     * Limit: 50 trades per hour per user
     * Prevents trade spam while allowing active trading
     */
    trade: new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(50, '1h'),
      prefix: `${ENV_PREFIX}:ratelimit:trade`,
      analytics: true,
    }),

    /**
     * Post Creation Rate Limiter
     * Limit: 5 posts per hour per user
     * Prevents content spam
     */
    postCreate: new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(5, '1h'),
      prefix: `${ENV_PREFIX}:ratelimit:post-create`,
      analytics: true,
    }),

    /**
     * Media Upload Rate Limiter
     * Limit: 20 uploads per hour per user
     * Prevents storage exhaustion and bandwidth abuse
     */
    mediaUpload: new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(20, '1h'),
      prefix: `${ENV_PREFIX}:ratelimit:media-upload`,
      analytics: true,
    }),

    /**
     * Profile Update Rate Limiter
     * Limit: 50 updates per hour per user
     * Prevents excessive profile update spam
     */
    profileUpdate: new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(50, '1h'),
      prefix: `${ENV_PREFIX}:ratelimit:profile-update`,
      analytics: true,
    }),
  };
}

export const rateLimiters = createRateLimiters();

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (usually user_id or wallet address)
 * @param limiter - Rate limiter instance to use (null if rate limiting disabled)
 * @returns Object with success status and response headers
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit | null
): Promise<{
  success: boolean;
  headers: Record<string, string>;
}> {
  // If rate limiting is disabled (local dev), always allow
  if (!limiter) {
    return {
      success: true,
      headers: {
        'X-RateLimit-Limit': '∞',
        'X-RateLimit-Remaining': '∞',
        'X-RateLimit-Reset': new Date().toISOString(),
      },
    };
  }

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
  limiter: Ratelimit | null
): Promise<void> {
  // Note: Upstash doesn't provide a direct reset method
  // This is a placeholder for future implementation if needed
  console.warn('[Rate Limit] Reset not implemented - limits expire naturally');
}

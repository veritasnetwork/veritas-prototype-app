/**
 * Rate Limiting Module
 *
 * Uses Upstash Redis for distributed rate limiting across server instances.
 * Implements sliding window algorithm for accurate rate limiting.
 *
 * ⚠️  IMPORTANT FOR PRODUCTION:
 * Rate limiting is DISABLED without Redis configuration.
 * This leaves your app vulnerable to:
 * - API abuse and DDoS attacks
 * - Solana transaction spam (costs real money on mainnet)
 * - Database exhaustion
 * - Storage abuse
 *
 * Setup for production (REQUIRED):
 * 1. Create free Upstash account at https://upstash.com
 * 2. Create Redis database (free tier: 10,000 requests/day)
 * 3. Add to Vercel environment variables:
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

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
    if (process.env.NODE_ENV === 'production') {
      logger.error('🚨 [Rate Limit] Redis not configured in PRODUCTION - rate limiting DISABLED');
      logger.error('   This is a SECURITY RISK. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
    } else {
      logger.debug('[Rate Limit] Redis not configured - rate limiting disabled (dev mode)');
    }
    return {
      poolDeploy: null,
      trade: null,
      postCreate: null,
      mediaUpload: null,
      profileUpdate: null,
      withdraw: null,
      deposit: null,
    };
  }

  logger.info('[Rate Limit] Redis configured - rate limiting enabled');
  return createActiveLimiters(redisClient);
}

function createActiveLimiters(redisClient: Redis) {

  /**
   * Pool Deployment Rate Limiter
   * Limit: 30 deployments per hour per user
   * Prevents spam pool creation while allowing active development
   */
  const poolDeploy = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(30, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:pool-deploy`,
    analytics: true, // Track analytics in Upstash dashboard
  });

  /**
   * Trade Rate Limiter
   * Limit: 50 trades per hour per user
   * Prevents trade spam while allowing active trading
   */
  const trade = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(50, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:trade`,
    analytics: true,
  });

  /**
   * Post Creation Rate Limiter
   * Limit: 5 posts per hour per user
   * Prevents content spam
   */
  const postCreate = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(5, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:post-create`,
    analytics: true,
  });

  /**
   * Media Upload Rate Limiter
   * Limit: 20 uploads per hour per user
   * Prevents storage exhaustion and bandwidth abuse
   */
  const mediaUpload = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(20, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:media-upload`,
    analytics: true,
  });

  /**
   * Profile Update Rate Limiter
   * Limit: 50 updates per hour per user
   * Prevents excessive profile update spam
   */
  const profileUpdate = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(50, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:profile-update`,
    analytics: true,
  });

  /**
   * Withdrawal Rate Limiter
   * Limit: 10 withdrawals per hour per user
   * Prevents withdrawal spam and potential abuse
   */
  const withdraw = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(10, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:withdraw`,
    analytics: true,
  });

  /**
   * Deposit Rate Limiter
   * Limit: 20 deposits per hour per user
   * Prevents deposit spam while allowing funding flexibility
   */
  const deposit = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(20, '1h'),
    prefix: `${ENV_PREFIX}:ratelimit:deposit`,
    analytics: true,
  });

  return {
    poolDeploy,
    trade,
    postCreate,
    mediaUpload,
    profileUpdate,
    withdraw,
    deposit,
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
  logger.warn('[Rate Limit] Reset not implemented - limits expire naturally');
}

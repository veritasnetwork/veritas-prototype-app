# Rate Limiting Setup Guide

This guide explains how to set up Upstash Redis for rate limiting in Veritas.

## Why Rate Limiting?

Rate limiting protects the API from:
- **DDoS attacks** - Prevents overwhelming the server
- **Spam/abuse** - Limits users from excessive actions
- **Resource exhaustion** - Prevents single users from monopolizing resources

## Current Rate Limits

- **Pool Deployments**: 3 per hour per user
- **Trading (prepare)**: 10 per minute per wallet
- **Trading (record)**: 10 per minute per wallet

These limits are generous for normal usage but prevent abuse.

## Setup Instructions

### 1. Create Upstash Account (Free)

1. Go to https://upstash.com
2. Click "Get Started" or "Sign Up"
3. Sign up with GitHub, Google, or email
4. **No credit card required** for free tier

### 2. Create Redis Database

1. After signing in, click "Create Database"
2. Configure your database:
   - **Name**: `veritas-rate-limiting` (or any name you prefer)
   - **Type**: Regional (faster, cheaper)
   - **Region**: Choose closest to your users/server
     - US East (N. Virginia) for US deployments
     - US West (Oregon) for West Coast
     - EU (Frankfurt) for European deployments
   - **Primary Region**: Select the region above
   - **Read Regions**: None needed (keep empty for free tier)
3. Click "Create"

### 3. Get Your Credentials

After creating the database:

1. You'll see your database dashboard
2. Scroll to **REST API** section (not "Redis Protocol")
3. Copy two values:
   - `UPSTASH_REDIS_REST_URL` (e.g., `https://your-db-name.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (long string starting with `AXX1AA...`)

### 4. Add to Environment Variables

Add these to your `.env.local` file:

```bash
# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-actual-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX1AAIncDEFG...your-actual-token
```

⚠️ **Important**: Never commit these values to git! `.env.local` is already in `.gitignore`.

### 5. Test It Works

Restart your dev server:

```bash
npm run dev
```

Try deploying a pool or making trades. You should see no errors related to rate limiting.

To test the rate limit, try to:
- Deploy 4 pools in quick succession (should fail on 4th with 429 error)
- Make 11 trades in under a minute (should fail on 11th with 429 error)

## Free Tier Limits

Upstash free tier includes:
- ✅ **10,000 commands/day** (enough for 100+ active users)
- ✅ **256 MB storage**
- ✅ **No credit card required**
- ✅ Unlimited databases

### When to Upgrade?

You'll only need paid tier when:
- You have 100+ daily active users trading heavily
- You hit the 10,000 commands/day limit
- Upstash will send you email alerts if approaching limit

Paid tier is only **$10/month** for 100K commands/day.

## Monitoring

View rate limit analytics:
1. Go to Upstash dashboard
2. Click on your database
3. View "Analytics" tab to see:
   - Commands per second
   - Daily usage
   - Top commands

## Troubleshooting

### Error: "Missing Upstash environment variables"

**Cause**: Environment variables not set or dev server not restarted.

**Fix**:
1. Check `.env.local` has both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. Restart dev server: `npm run dev`

### Error: "connect ECONNREFUSED" or network errors

**Cause**: Incorrect URL or firewall blocking Upstash.

**Fix**:
1. Verify URL starts with `https://` (not `http://`)
2. Check you copied the **REST API** URL (not Redis Protocol URL)
3. Test connectivity: `curl https://your-db-name.upstash.io`

### Rate limits not working (no 429 errors)

**Cause**: Rate limiting fails open (by design for availability).

**Check**:
1. Look for error logs: `[/api/...] Rate limit check failed`
2. If you see these, rate limiting is failing but requests still work
3. Fix Upstash connection first

### Want to disable rate limiting temporarily?

Comment out the rate limit check in the route:

```typescript
// Temporarily disable rate limiting
// const { success, headers } = await checkRateLimit(...);
```

Or catch errors and always continue:

```typescript
try {
  const { success, headers } = await checkRateLimit(...);
  // ...
} catch (err) {
  console.log('Rate limiting disabled:', err);
  // Continue without rate limiting
}
```

## Production Deployment

For production (Vercel, etc.):

1. Add environment variables to your hosting platform:
   - Vercel: Project Settings → Environment Variables
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - Make sure to set for Production environment

2. Consider using regional Redis:
   - Create database in same region as your deployment
   - Reduces latency for rate limit checks

## Security Notes

- ✅ Rate limiting uses wallet addresses as identifiers (public data)
- ✅ Rate limiters are defined in `src/lib/rate-limit.ts`
- ✅ All routes fail open (if Upstash is down, requests still work)
- ✅ Upstash tokens are server-side only (never exposed to browser)

## Adjusting Rate Limits

Edit `src/lib/rate-limit.ts`:

```typescript
export const rateLimiters = {
  poolDeploy: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, '1h'), // 3 per hour
    // Change to: Ratelimit.slidingWindow(5, '1h') for 5 per hour
  }),

  trade: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, '1m'), // 10 per minute
    // Change to: Ratelimit.slidingWindow(20, '1m') for 20 per minute
  }),
};
```

Available time windows: `'1s'`, `'1m'`, `'1h'`, `'1d'`

## Questions?

- Upstash Docs: https://upstash.com/docs/redis
- Rate Limit Library: https://github.com/upstash/ratelimit
- Report issues: Your project's issue tracker

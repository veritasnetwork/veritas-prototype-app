# Rate Limiting System

## Overview
Distributed rate limiting using Upstash Redis to prevent abuse of resource-intensive API endpoints. Implements sliding window algorithm with fail-open design for availability. All limits are per authenticated user or wallet address.

## Context
- **Layer:** Infrastructure
- **Dependencies:** Upstash Redis, Privy authentication
- **Used By:** All protected API endpoints (trades, pools, posts, media, profiles)
- **Status:** Implemented

---

## High-Level Design

### Flow
1. User makes API request to protected endpoint
2. Authenticate user → extract identifier (privyUserId or walletAddress)
3. Check rate limit via Upstash Redis
4. If under limit → allow request, decrement remaining count
5. If over limit → return 429 with rate limit headers
6. If Upstash unavailable → allow request (fail-open)

### State Changes
- Upstash Redis: Increment counter for user/endpoint combination
- No database state changes (rate limit state is ephemeral)

### Key Decisions
- **Fail-open design**: Requests succeed if Upstash is down (availability over strict limiting)
- **Per-user limits**: Uses privyUserId or walletAddress as identifier (not IP)
- **Sliding window**: More accurate than fixed window, prevents burst at window boundaries
- **Shared limiters**: Media uploads share one limiter (20/hour total, not per type)

---

## Implementation

### Module Location
`src/lib/rate-limit.ts`

### Rate Limiters

| Limiter | Limit | Window | Identifier | Purpose |
|---------|-------|--------|------------|---------|
| `poolDeploy` | 30 | 1 hour | privyUserId | Prevent pool spam |
| `trade` | 50 | 1 hour | walletAddress | Prevent trade spam |
| `postCreate` | 10 | 1 hour | privyUserId | Prevent content spam |
| `mediaUpload` | 20 | 1 hour | privyUserId | Prevent storage exhaustion |
| `profileUpdate` | 50 | 1 hour | privyUserId | Prevent profile spam |

### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getRedis` | `() => Redis` | Singleton Redis client |
| `checkRateLimit` | `(identifier: string, limiter: Ratelimit) => Promise<{success: boolean, headers: Record<string, string>}>` | Check limit and return headers |

### Data Structures

```typescript
// Rate limit result
interface RateLimitResult {
  success: boolean;  // true if under limit
  headers: {
    'X-RateLimit-Limit': string;      // Max requests allowed
    'X-RateLimit-Remaining': string;  // Requests remaining
    'X-RateLimit-Reset': string;      // ISO timestamp when limit resets
  };
}

// Upstash configuration
interface RedisConfig {
  url: string;    // UPSTASH_REDIS_REST_URL
  token: string;  // UPSTASH_REDIS_REST_TOKEN
}
```

### Protected Endpoints

| Endpoint | Limiter | Identifier | Error Message |
|----------|---------|------------|---------------|
| `POST /api/pools/deploy` | `poolDeploy` | privyUserId | "You can deploy up to 30 pools per hour" |
| `POST /api/trades/prepare` | `trade` | walletAddress | "You can make up to 50 trades per hour" |
| `POST /api/trades/record` | `trade` | walletAddress | "You can record up to 50 trades per hour" |
| `POST /api/posts/create` | `postCreate` | privyUserId | "You can create up to 10 posts per hour" |
| `POST /api/media/upload-image` | `mediaUpload` | privyUserId | "You can upload up to 20 files per hour" |
| `POST /api/media/upload-video` | `mediaUpload` | privyUserId | "You can upload up to 20 files per hour" |
| `POST /api/media/upload-profile-photo` | `mediaUpload` | privyUserId | "You can upload up to 20 files per hour" |
| `POST /api/users/update-profile` | `profileUpdate` | privyUserId | "You can update your profile up to 50 times per hour" |
| `POST /api/users/complete-profile` | `profileUpdate` | privyUserId | "You can update your profile up to 50 times per hour" |

### Edge Cases
- **Upstash unavailable**: Catch error, log warning, allow request (fail-open)
- **Missing environment variables**: Throw error at initialization (fails early)
- **Rate limit exactly at boundary**: Sliding window ensures accurate counting
- **Multiple concurrent requests**: Redis handles atomic increment/decrement
- **Different identifiers for same user**: Pool deployments use privyUserId, trades use walletAddress (independent limits)

### Errors

| Condition | Response Code | Response Body |
|-----------|---------------|---------------|
| Rate limit exceeded | 429 | `{error: "Rate limit exceeded...", rateLimitExceeded: true}` |
| Missing Redis credentials | 500 | Throws error at startup (before requests) |
| Upstash API error | 200 | Logs error, allows request (fail-open) |

---

## Integration

### Environment Variables
```bash
# Required for rate limiting to work
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX1AAInc...
```

### Usage Pattern

```typescript
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // 1. Authenticate user
  const userId = await authenticate(req);

  // 2. Check rate limit
  try {
    const { success, headers } = await checkRateLimit(userId, rateLimiters.postCreate);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. You can create up to 10 posts per hour.' },
        { status: 429, headers }
      );
    }
  } catch (err) {
    // Fail open: log error but continue
    console.error('Rate limit check failed:', err);
  }

  // 3. Process request
  // ...
}
```

### Response Headers

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-10-23T21:00:00.000Z
Content-Type: application/json

{
  "error": "Rate limit exceeded. You can create up to 10 posts per hour.",
  "rateLimitExceeded": true
}
```

### Upstash Free Tier

**Limits:**
- 10,000 commands per day
- 256 MB storage
- No credit card required

**Usage Estimation:**
- 10 active users × 50 trades/hour × 24 hours = 12,000 commands/day (exceeds free tier)
- 100 active users → Requires paid tier ($10/month for 100K commands/day)

---

## Operational

### Monitoring

**Upstash Dashboard:**
- Commands per second
- Daily usage vs free tier limit
- Top commands (rate limit checks)
- Error rate

**Application Logs:**
- `[endpoint] Rate limit exceeded for user: [id]` - User hit limit
- `[endpoint] Rate limit check failed: [error]` - Upstash error (fail-open triggered)

### Adjusting Limits

**To change a rate limit:**
1. Edit `src/lib/rate-limit.ts`
2. Update `Ratelimit.slidingWindow(count, window)` values
3. Update error messages in affected routes
4. Restart server

**Example:**
```typescript
// Before: 10 posts per hour
postCreate: new Ratelimit({
  limiter: Ratelimit.slidingWindow(10, '1h'),
}),

// After: 20 posts per hour
postCreate: new Ratelimit({
  limiter: Ratelimit.slidingWindow(20, '1h'),
}),
```

### Available Time Windows
- `'1s'` - 1 second
- `'1m'` - 1 minute
- `'1h'` - 1 hour
- `'1d'` - 1 day

---

## Testing

### Critical Paths
1. Under limit → request succeeds, returns correct remaining count
2. At limit → 11th request returns 429 with correct headers
3. Upstash down → request succeeds (fail-open)
4. Different users → independent rate limits
5. Sliding window → new requests allowed as old ones expire

### Test Implementation
- **Test Spec:** `specs/test-specs/architecture/rate-limiting.test.md`
- **Test Code:** `tests/integration/rate-limiting.test.ts`

### Validation
- Make 11 rapid requests → 10 succeed, 11th returns 429
- Check `X-RateLimit-Remaining` decrements correctly
- Wait 1 hour → limit resets, requests succeed again
- Disable Upstash → requests still succeed (fail-open verified)

### Manual Testing

**Test rate limit for posts:**
```bash
# Make 11 POST requests rapidly
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/posts/create \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test","post_type":"text","content_json":{}}' \
    | jq '.error'
done

# First 10: null (success)
# 11th: "Rate limit exceeded. You can create up to 10 posts per hour."
```

---

## References
- Code: `src/lib/rate-limit.ts`
- Implementation:
  - `app/api/pools/deploy/route.ts:33`
  - `app/api/trades/prepare/route.ts:52`
  - `app/api/trades/record/route.ts:61`
  - `app/api/posts/create/route.ts:43`
  - `app/api/media/upload-image/route.ts:36`
  - `app/api/media/upload-video/route.ts:36`
  - `app/api/media/upload-profile-photo/route.ts:28`
  - `app/api/users/update-profile/route.ts:21`
  - `app/api/users/complete-profile/route.ts:26`
- Setup: `RATE_LIMITING_SETUP.md`
- Upstash Docs: https://upstash.com/docs/redis/features/ratelimiting
- Library: https://github.com/upstash/ratelimit

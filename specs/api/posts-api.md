# Posts API

## Overview
Endpoints for creating and fetching posts with embedded ICBS pool data, trade history, and edit history.

## Context
- **Layer:** App
- **Auth:** Mixed (see individual endpoints)
- **Dependencies:** Supabase (posts, pool_deployments), Solana RPC (pool sync)
- **Used By:** Feed, PostDetail, CreatePostModal

---

## Endpoints

### GET `/api/posts/[id]`

Fetch individual post with author details and ICBS pool data.

**Auth:** Optional

**Parameters:**
- `id` (path): Post UUID

**Response (200):**
```typescript
{
  id: string,
  authorId: string,
  timestamp: string,  // ISO 8601
  createdAt: string,
  post_type: 'text' | 'image' | 'video',
  content_text: string | null,
  content_json: object | null,  // Tiptap JSON
  caption: string | null,
  media_urls: string[] | null,
  article_title: string | null,
  cover_image_url: string | null,
  author: {
    id: string,
    username: string,
    display_name: string | null,
    avatar_url: string | null
  },
  belief: null,  // TODO: Implement belief aggregation
  poolAddress: string | null,
  poolLongTokenSupply: number | null,      // Atomic units (6 decimals)
  poolShortTokenSupply: number | null,
  poolSqrtPriceLongX96: string | null,
  poolSqrtPriceShortX96: string | null,
  poolVaultBalance: number | null,         // Micro-USDC
  poolF: number,                            // Growth exponent (default 3)
  poolBetaNum: number,                      // Beta numerator (default 1)
  poolBetaDen: number,                      // Beta denominator (default 2)
  likes: number,
  views: number
}
```

**Side Effects:**
- Auto-syncs pool data from Solana if `last_synced_at > 10 seconds ago`
- Updates `pool_deployments.supply_long`, `supply_short`, `sqrt_price_*`, `vault_balance`

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 404 | Post not found | `{error: "Post not found"}` |
| 500 | DB error | `{error: "Internal server error"}` |
| 503 | DB unavailable | `{error: "Database unavailable"}` |

**Implementation:** `app/api/posts/[id]/route.ts`

**Flow:**
1. Parse `id` from URL params
2. Query `posts` table with JOIN on `users` for author
3. LEFT JOIN `pool_deployments` for pool data
4. Check `last_synced_at` timestamp
5. If stale (>10s): Fetch pool state from Solana RPC
6. If fetched: UPDATE pool_deployments with fresh data
7. Transform to API response schema
8. Validate with Zod schema
9. Return response

**Edge Cases:**
- Post has no pool deployed → `poolAddress: null`, all pool fields null
- Pool sync fails → Log warning, return stale data
- Validation fails (dev) → Log warning, return unvalidated
- Validation fails (prod) → Return 500 error

---

### GET `/api/posts/[id]/trades`

Fetch trade history and aggregated price/volume data for charting.

**Auth:** Optional

**Parameters:**
- `id` (path): Post UUID
- `range` (query): `1H` | `24H` | `7D` | `ALL` (default: `ALL`)

**Response (200):**
```typescript
{
  priceData: Array<{
    time: number,      // Unix timestamp (seconds)
    value: number      // Price in USDC
  }>,
  volumeData: Array<{
    time: number,
    value: number,     // Volume in USDC
    color: string      // 'green' for buy, 'red' for sell
  }>,
  trades: Array<{
    id: string,
    trader_address: string,
    side: 'long' | 'short',
    trade_type: 'buy' | 'sell',
    amount_usdc: number,
    amount_tokens: number,
    price: number,
    timestamp: string
  }>
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid range | `{error: "Invalid range parameter"}` |
| 404 | Post not found | `{error: "Post not found"}` |
| 500 | DB error | `{error: "Internal server error"}` |

**Implementation:** `app/api/posts/[id]/trades/route.ts`

**Flow:**
1. Parse `id` and `range` from params
2. Validate range parameter
3. Calculate time window based on range
4. Query `trades` table filtered by `post_id` and `created_at >= window`
5. Order by `created_at ASC`
6. Aggregate into price data (time-series of avg price)
7. Aggregate into volume data (sum per time bucket)
8. Return response

**Edge Cases:**
- No trades yet → Return empty arrays
- Invalid range → Default to 'ALL'
- Missing pool_address → 404 (pool not deployed)

---

### GET `/api/posts/[id]/history`

Fetch edit history for a post.

**Auth:** Optional

**Parameters:**
- `id` (path): Post UUID

**Response (200):**
```typescript
{
  versions: Array<{
    version: number,
    content_text: string | null,
    content_json: object | null,
    edited_at: string,
    edited_by: string  // User ID
  }>
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 404 | Post not found | `{error: "Post not found"}` |
| 500 | DB error | `{error: "Internal server error"}` |

**Implementation:** `app/api/posts/[id]/history/route.ts`

**Flow:**
1. Parse `id` from params
2. Query `post_versions` table for `post_id`
3. Order by `version DESC`
4. Return array of versions

**Edge Cases:**
- No edit history → Return empty array
- Current version not in history → Include current post as version 1

---

### POST `/api/posts/create`

Create a new post (text, image, or video).

**Auth:** Required (Privy JWT)

**Request:**
```typescript
{
  post_type: 'text' | 'image' | 'video',
  content_text?: string,           // For text posts
  content_json?: object,           // Tiptap JSON for rich text
  caption?: string,                // For image/video posts
  media_urls?: string[],           // Pre-uploaded media URLs
  article_title?: string,          // For text posts
  cover_image_url?: string         // For text posts
}
```

**Response (201):**
```typescript
{
  post: {
    id: string,
    authorId: string,
    timestamp: string,
    post_type: string,
    // ... full post object
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Missing required fields | `{error: "Missing required fields"}` |
| 400 | Invalid post_type | `{error: "Invalid post type"}` |
| 400 | Empty content | `{error: "Content cannot be empty"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 500 | DB error | `{error: "Failed to create post"}` |

**Implementation:** `app/api/posts/create/route.ts`

**Flow:**
1. Validate auth token → Extract user_id
2. Parse request body
3. Validate post_type and required fields
4. Validate content not empty
5. Check user has completed profile
6. Generate UUID for post_id
7. Create belief market entry (if protocol enabled)
8. INSERT into `posts` table
9. Return created post

**Validation Rules:**
- `post_type`: Must be 'text', 'image', or 'video'
- `content_text` or `content_json`: Required for text posts
- `caption`: Required for image/video posts
- `media_urls`: Required for image/video posts, must be valid URLs

**Edge Cases:**
- User incomplete profile → 403 Forbidden
- Duplicate media URLs → Allow (same image in multiple posts)
- Empty content_json → Reject with 400
- Media URL doesn't exist → Accept (media deletion is separate)

---

## Data Structures

### Post Schema (Database)
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID REFERENCES users(id),
  belief_id UUID REFERENCES beliefs(id),
  post_type TEXT NOT NULL CHECK (post_type IN ('text', 'image', 'video')),
  content_text TEXT,
  content_json JSONB,
  caption TEXT,
  media_urls TEXT[],
  article_title TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0
);
```

### Pool Deployment Schema (Database)
```sql
CREATE TABLE pool_deployments (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  belief_id UUID REFERENCES beliefs(id),
  pool_address TEXT UNIQUE NOT NULL,
  supply_long NUMERIC,
  supply_short NUMERIC,
  sqrt_price_long_x96 TEXT,
  sqrt_price_short_x96 TEXT,
  vault_balance NUMERIC,
  f INTEGER DEFAULT 3,
  beta_num INTEGER DEFAULT 1,
  beta_den INTEGER DEFAULT 2,
  last_synced_at TIMESTAMPTZ
);
```

---

## Testing

### Critical Paths
1. GET post with pool → returns ICBS fields
2. GET post without pool → null pool fields
3. GET trades with data → returns chart data
4. GET trades empty → empty arrays
5. POST create valid → creates post
6. POST create invalid → validation error

### Test Implementation
- **Test Spec:** `specs/test-specs/api/posts-api.test.md`
- **Test Code:** `tests/api/posts.test.ts`

### Validation
- Response schemas match TypeScript types
- Pool sync updates database
- Chart data aggregates correctly
- Edge cases handled gracefully

---

## References
- Code: `app/api/posts/[id]/route.ts`, `app/api/posts/create/route.ts`
- Types: `src/types/post.types.ts`, `src/types/api.ts`
- Database: `specs/data-structures/01-protocol-tables.md`
- Related: `specs/api/pools-api.md`

# API Endpoints Reference

Complete documentation of all Veritas API endpoints with request/response schemas.

---

## Posts API

### GET `/api/posts/[id]`

Fetch individual post with author details and pool data.

**Authentication:** Optional (returns same data regardless)

**Parameters:**

- `id` (path): Post UUID

**Response:** `PostAPIResponseSchema` (see `src/types/api.ts`)

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "authorId": "660e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2025-10-14T12:00:00.000Z",
  "createdAt": "2025-10-14T12:00:00.000Z",
  "post_type": "text",
  "content_text": "This is a post about...",
  "content_json": {
    "type": "doc",
    "content": [...]
  },
  "caption": null,
  "media_urls": null,
  "article_title": "My Article Title",
  "cover_image_url": "https://example.com/cover.jpg",
  "author": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "username": "johndoe",
    "display_name": "John Doe",
    "avatar_url": null
  },
  "belief": null,
  "poolAddress": "5vMBU9...",
  "poolTokenSupply": 15432000000,
  "poolReserveBalance": 2483000000,
  "poolKQuadratic": 1,
  "likes": 42,
  "views": 1234
}
```

**Side Effects:**

- Auto-syncs pool data from Solana if last sync >10 seconds old
- Updates `pool_deployments` table with fresh `token_supply`, `reserve`, `k_quadratic`

**Error Responses:**

| Status | Error                                | Cause                        |
| ------ | ------------------------------------ | ---------------------------- |
| 404    | `{ error: "Post not found" }`        | Post ID doesn't exist        |
| 500    | `{ error: "Internal server error" }` | Database or validation error |
| 503    | `{ error: "Database unavailable" }`  | Cannot connect to Supabase   |

**Implementation:** [app/api/posts/[id]/route.ts](../../app/api/posts/[id]/route.ts)

**Validation:** Zod schema validates response before returning (dev mode logs warning, prod fails)

---

### GET `/api/posts/[id]/trades`

Fetch trade history and price/volume data for charting.

**Authentication:** Optional

**Parameters:**

- `id` (path): Post UUID
- `range` (query): Time range - `1H` | `24H` | `7D` | `ALL` (default: `ALL`)

**Response:** `TradeHistoryResponseSchema`

**Example Response:**

```json
{
  "priceData": [
    { "time": 1697000000, "value": 0.0012 },
    { "time": 1697003600, "value": 0.0015 },
    { "time": 1697007200, "value": 0.0018 }
  ],
  "volumeData": [
    {
      "time": 1697000000,
      "value": 125.5,
      "color": "rgba(34, 197, 94, 0.8)"
    },
    {
      "time": 1697003600,
      "value": 87.25,
      "color": "rgba(239, 68, 68, 0.8)"
    }
  ],
  "stats": {
    "totalVolume": 2483.5,
    "totalTrades": 42,
    "highestPrice": 0.0018,
    "lowestPrice": 0.001,
    "currentPrice": 0.0015,
    "priceChange24h": 0.0003,
    "priceChangePercent24h": 25.0
  }
}
```

**Response Fields:**

**priceData:**

- `time`: Unix timestamp (seconds)
- `value`: Token price in USDC

**volumeData:**

- `time`: Unix timestamp (seconds)
- `value`: Trade volume in USDC
- `color`: `green` for buys, `red` for sells

**stats:**

- All prices in USDC
- All volumes in USDC
- Percentage change based on 24h window

**Empty Response (no trades):**

```json
{
  "priceData": [],
  "volumeData": [],
  "stats": {
    "totalVolume": 0,
    "totalTrades": 0,
    "highestPrice": 0,
    "lowestPrice": 0,
    "currentPrice": 0,
    "priceChange24h": 0,
    "priceChangePercent24h": 0
  }
}
```

**Error Responses:**

| Status | Error                                       | Cause            |
| ------ | ------------------------------------------- | ---------------- |
| 404    | `{ error: "Pool not found for this post" }` | No pool deployed |
| 500    | `{ error: "Failed to fetch trades" }`       | Database error   |

**Implementation:** [app/api/posts/[id]/trades/route.ts](../../app/api/posts/[id]/trades/route.ts)

**Notes:**

- Prices calculated from bonding curve using `calculateTokenPrice(supply, k)`
- Handles duplicate timestamps by adding millisecond offsets
- Filters out invalid data (malformed supply/k values)

---

### GET `/api/posts/[id]/history`

Fetch belief history, price history, and trade history for analytics.

**Authentication:** Optional

**Parameters:**

- `id` (path): Post UUID

**Response:**

```json
{
  "belief_history": [],
  "price_history": [...],
  "trade_history": [...]
}
```

**Status:** ⚠️ Partially Implemented

**Notes:**

- Belief history currently returns empty array (waiting on protocol integration)
- Price and trade history available
- Not currently consumed by any UI components

**Implementation:** [app/api/posts/[id]/history/route.ts](../../app/api/posts/[id]/history/route.ts)

---

## Trades API

### POST `/api/trades/record`

Record a completed trade in the database after on-chain execution.

**Authentication:** Required (Privy JWT)

**Request Body:** `TradeRecordRequestSchema`

```json
{
  "user_id": "uuid",
  "pool_address": "SolanaAddress...",
  "post_id": "uuid",
  "wallet_address": "SolanaWalletAddress...",
  "trade_type": "buy" | "sell",
  "token_amount": "1234567890",
  "usdc_amount": "1234567890",
  "token_supply_after": "15432000000",
  "reserve_after": "2483000000",
  "k_quadratic": "1",
  "tx_signature": "SolanaSignature..."
}
```

**Field Units:**

- `token_amount`: Display units as string (e.g., "123.45")
- `usdc_amount`: Display units as string (e.g., "50.00")
- `token_supply_after`: Atomic units as string (6 decimals)
- `reserve_after`: Micro-USDC as string (6 decimals)
- `k_quadratic`: Display units as string

**Response:**

```json
{
  "success": true
}
```

**Error Responses:**

| Status | Error                                 | Cause                       |
| ------ | ------------------------------------- | --------------------------- |
| 400    | `{ error: "Invalid request body" }`   | Missing or malformed fields |
| 401    | `{ error: "Unauthorized" }`           | No auth token               |
| 500    | `{ error: "Failed to record trade" }` | Database error              |

**Implementation:** [app/api/trades/record/route.ts](../../app/api/trades/record/route.ts)

**Called By:**

- `src/hooks/useBuyTokens.ts` (after successful buy)
- `src/hooks/useSellTokens.ts` (after successful sell)

**Side Effects:**

- Inserts row into `trades` table
- Used for price history and volume calculations

---

## Users API

### GET `/api/users/[username]/profile`

Fetch user profile information.

**Authentication:** Optional

**Parameters:**

- `username` (path): Username string

**Response:**

```json
{
  "id": "uuid",
  "username": "johndoe",
  "display_name": "John Doe",
  "avatar_url": "https://...",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Implementation:** [app/api/users/[username]/profile/route.ts](../../app/api/users/[username]/profile/route.ts)

---

### GET `/api/users/[username]/holdings`

Fetch user's token holdings across all pools.

**Authentication:** Optional

**Parameters:**

- `username` (path): Username string

**Response:**

```json
{
  "holdings": [
    {
      "post_id": "uuid",
      "pool_address": "SolanaAddress...",
      "token_balance": 1234.56,
      "value_usd": 50.25
    }
  ]
}
```

**Implementation:** [app/api/users/[username]/holdings/route.ts](../../app/api/users/[username]/holdings/route.ts)

**Status:** ⚠️ Not fully implemented (requires Solana balance queries)

---

## Auth API

### GET `/api/auth/status`

Check current authentication status.

**Authentication:** Optional (checks for Privy JWT)

**Response:**

```json
{
  "authenticated": true,
  "userId": "uuid",
  "username": "johndoe"
}
```

**Implementation:** [app/api/auth/status/route.ts](../../app/api/auth/status/route.ts)

---

## Configuration API

### GET `/api/config/pool`

Fetch Solana program configuration (program IDs, PDAs, etc.).

**Authentication:** None required

**Response:**

```json
{
  "programId": "SolanaProgramId...",
  "usdcMint": "USDCMintAddress...",
  "protocolConfig": "ProtocolConfigPDA...",
  ...
}
```

**Implementation:** [app/api/config/pool/route.ts](../../app/api/config/pool/route.ts)

---

## General Patterns

### Authentication

**Header:**

```
Authorization: Bearer <privy-jwt-token>
```

**Getting Token:**

```typescript
const { getAccessToken } = usePrivy();
const token = await getAccessToken();

fetch("/api/endpoint", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Error Handling

All errors follow this pattern:

```json
{
  "error": "Human-readable error message",
  "details": "Optional additional details",
  "code": "ERROR_CODE"
}
```

### Validation

All API routes with Zod validation:

- **Development:** Logs validation errors, returns data anyway
- **Production:** Returns 500 error on validation failure

**Validated Endpoints:**

- ✅ `GET /api/posts/[id]` - PostAPIResponseSchema
- ✅ `GET /api/posts/[id]/trades` - TradeHistoryResponseSchema
- ⚠️ Others pending validation

---

## Conventions

See [../../docs/conventions/README.md](../../docs/conventions/README.md) for:

- Naming conventions (camelCase vs snake_case)
- Unit conversions (atomic vs display)
- Field mappings across layers

---

**Last Updated:** October 14, 2025

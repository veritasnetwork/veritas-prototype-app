# Users API

## Overview
Endpoints for fetching user profiles, holdings, and managing profile updates.

## Context
- **Layer:** App
- **Auth:** Mixed (see individual endpoints)
- **Dependencies:** Supabase (users, agents, holdings), Privy (auth)
- **Used By:** ProfilePage, NavigationHeader, OnboardingModal

---

## Endpoints

### GET `/api/users/[username]/profile`

Fetch user profile with statistics and recent posts.

**Auth:** Optional

**Parameters:**
- `username` (path): User's username

**Response (200):**
```typescript
{
  user: {
    id: string,
    username: string,
    display_name: string | null,
    avatar_url: string | null,
    solana_address: string | null
  },
  stats: {
    total_posts: number,
    total_holdings: number,
    total_value_usdc: number,
    joined_at: string
  },
  recent_posts: Array<{
    id: string,
    post_type: 'text' | 'image' | 'video',
    content_text: string | null,
    caption: string | null,
    media_urls: string[] | null,
    article_title: string | null,
    cover_image_url: string | null,
    timestamp: string,
    author: {
      username: string,
      display_name: string | null,
      avatar_url: string | null
    },
    belief: null,
    poolAddress: string | null,
    poolLongTokenSupply: number | null,
    poolShortTokenSupply: number | null,
    poolSqrtPriceLongX96: string | null,
    poolSqrtPriceShortX96: string | null,
    poolVaultBalance: number | null,
    poolF: number | null,
    poolBetaNum: number | null,
    poolBetaDen: number | null,
    relevanceScore: number,
    signals: {
      truth: number,
      novelty: number,
      importance: number,
      virality: number
    },
    discussionCount: number
  }>
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 404 | User not found | `{error: "User not found"}` |
| 500 | DB error | `{error: "Internal server error"}` |

**Implementation:** `app/api/users/[username]/profile/route.ts`

**Flow:**
1. Parse `username` from URL params
2. Query `users` table for user by username
3. Get Solana address from `agents` table (linked by auth_id)
4. Calculate stats from `posts` and `holdings` tables
5. Fetch recent posts (limit 10) with pool data
6. Return profile response

**Edge Cases:**
- User has no posts → `recent_posts: []`
- User has no Solana address → `solana_address: null`
- Post has no pool → null pool fields

---

### GET `/api/users/[username]/holdings`

Fetch user's token holdings across all posts.

**Auth:** Optional

**Parameters:**
- `username` (path): User's username

**Response (200):**
```typescript
{
  holdings: Array<{
    post_id: string,
    pool_address: string,
    long_balance: number,      // Atomic units
    short_balance: number,
    long_value_usdc: number,
    short_value_usdc: number,
    total_value_usdc: number,
    post: {
      id: string,
      article_title: string | null,
      caption: string | null,
      post_type: string,
      author: {
        username: string,
        display_name: string | null
      },
      created_at: string
    },
    pool: {
      pool_address: string,
      supply_long: number,
      supply_short: number,
      sqrt_price_long_x96: string,
      sqrt_price_short_x96: string,
      vault_balance: number,
      f: number,
      beta_num: number,
      beta_den: number
    }
  }>
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 404 | User not found | `{error: "User not found"}` |
| 500 | DB error | `{error: "Internal server error"}` |

**Implementation:** `app/api/users/[username]/holdings/route.ts`

**Flow:**
1. Parse `username` from URL params
2. Query `users` table for user
3. Get agent_id from `agents` table
4. Query `holdings` view/table for agent_id
5. JOIN with `posts` and `pool_deployments`
6. Calculate current values using ICBS pricing
7. Return holdings array

**Edge Cases:**
- User has no holdings → `holdings: []`
- Pool not synced recently → Use stale prices
- Zero balance holding → Exclude from results

---

### POST `/api/users/complete-profile`

Complete user profile during onboarding.

**Auth:** Required (Privy JWT)

**Request:**
```typescript
{
  username: string,
  display_name?: string,
  avatar_url?: string
}
```

**Response (200):**
```typescript
{
  user: {
    id: string,
    username: string,
    display_name: string | null,
    avatar_url: string | null,
    auth_id: string,
    auth_provider: string
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid username | `{error: "Username must be 3-20 alphanumeric characters"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 409 | Username taken | `{error: "Username already taken"}` |
| 500 | DB error | `{error: "Failed to complete profile"}` |

**Implementation:** `app/api/users/complete-profile/route.ts`

**Flow:**
1. Validate auth token → Extract auth_id
2. Parse request body
3. Validate username format (3-20 chars, alphanumeric + underscore)
4. Check username uniqueness
5. Call `app-user-creation` edge function with user data
6. Edge function creates user + agent (with upsert behavior)
7. Return created/updated user

**Validation Rules:**
- `username`: Required, 3-20 characters, alphanumeric + underscore, unique
- `display_name`: Optional, max 50 characters
- `avatar_url`: Optional, must be valid URL

**Edge Cases:**
- Username already taken → 409 Conflict
- User already exists → Upsert behavior (update existing)
- Invalid avatar_url → 400 Bad Request
- Edge function creates protocol agent automatically

---

### POST `/api/users/update-profile`

Update user profile (display name, avatar).

**Auth:** Required (Privy JWT)

**Request:**
```typescript
{
  display_name?: string,
  avatar_url?: string
}
```

**Response (200):**
```typescript
{
  user: {
    id: string,
    username: string,
    display_name: string | null,
    avatar_url: string | null
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid display_name | `{error: "Display name too long"}` |
| 400 | Invalid avatar_url | `{error: "Invalid avatar URL"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 500 | DB error | `{error: "Failed to update profile"}` |

**Implementation:** `app/api/users/update-profile/route.ts`

**Flow:**
1. Validate auth token → Extract user_id
2. Parse request body
3. Validate display_name length
4. Validate avatar_url format
5. UPDATE `users` SET display_name, avatar_url, updated_at
6. Return updated user

**Validation Rules:**
- `display_name`: Optional, max 50 characters
- `avatar_url`: Optional, must be valid URL

**Edge Cases:**
- No fields provided → 400 Bad Request
- Empty string for display_name → Set to NULL
- Same values → No-op, return current user

---

## Data Structures

### User Schema (Database)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Agent Schema (Database)
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  auth_id TEXT UNIQUE REFERENCES users(auth_id),
  solana_address TEXT UNIQUE,
  total_stake NUMERIC DEFAULT 0,
  epistemic_weight NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Testing

### Critical Paths
1. GET profile exists → returns user + stats
2. GET profile not found → 404
3. GET holdings with data → returns holdings array
4. GET holdings empty → empty array
5. POST complete-profile valid → updates user
6. POST complete-profile duplicate username → 409
7. POST update-profile → updates fields

### Test Implementation
- **Test Spec:** `specs/test-specs/api/users-api.test.md`
- **Test Code:** `tests/api/users.test.ts`

### Validation
- Username uniqueness enforced
- Display name length validated
- Holdings values calculated correctly
- Profile completion flow works

---

## References
- Code: `app/api/users/[username]/profile/route.ts`, `app/api/users/complete-profile/route.ts`
- Types: `src/types/api.ts`
- Database: `specs/data-structures/01-protocol-tables.md`
- Related: `specs/api/posts-api.md`

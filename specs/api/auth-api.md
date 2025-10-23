# Auth API

## Overview
Endpoint for checking user authentication status with Privy.

## Context
- **Layer:** App
- **Auth:** Optional (checks for token)
- **Dependencies:** Privy JWT verification
- **Used By:** AuthProvider, protected routes

---

## Endpoints

### GET `/api/auth/status`

Check if user is authenticated and get basic user info.

**Auth:** Optional

**Parameters:** None

**Response (200) - Authenticated:**
```typescript
{
  authenticated: true,
  user: {
    id: string,
    auth_id: string,
    auth_provider: string,
    username: string | null,
    display_name: string | null,
    avatar_url: string | null
  }
}
```

**Response (200) - Not Authenticated:**
```typescript
{
  authenticated: false
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 500 | DB error | `{error: "Failed to check auth status"}` |

**Implementation:** `app/api/auth/status/route.ts`

**Flow:**
1. Extract Authorization header
2. If no token → Return `{authenticated: false}`
3. Verify Privy JWT token (with fallback handling)
4. If invalid → Return `{authenticated: false}`
5. Extract auth_id from token
6. Query `users` table for auth_id
7. If user not found → Return `{authenticated: false}`
8. Return user data with `authenticated: true`

**Edge Cases:**
- Expired token → `authenticated: false`
- Invalid token format → `authenticated: false`
- User deleted from DB but has valid token → `authenticated: false`
- User exists but no username → `username: null`

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

---

## Security

### Token Verification
- Uses Privy's JWT verification
- No server-side token refresh (handled by Privy client)
- Tokens expire after Privy's configured TTL

### Privacy
- Only returns public profile fields
- No sensitive data (email, wallet private keys)
- No session IDs exposed

---

## Testing

### Critical Paths
1. Valid token → returns authenticated with user data
2. No token → returns not authenticated
3. Invalid token → returns not authenticated
4. Expired token → returns not authenticated
5. Valid token but user deleted → returns not authenticated

### Test Implementation
- **Test Spec:** `specs/test-specs/api/auth-api.test.md`
- **Test Code:** `tests/api/auth.test.ts`

### Validation
- Token verification works correctly
- User lookup accurate
- No information leakage on errors

---

## References
- Code: `app/api/auth/status/route.ts`
- Provider: `src/providers/AuthProvider.tsx`
- Privy: https://docs.privy.io/
- Related: `specs/api/users-api.md`

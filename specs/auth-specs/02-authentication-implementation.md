# Authentication Implementation

**Endpoint**: Privy React SDK (client-side) + Next.js API Routes
**Dependencies**: @privy-io/react-auth, jose (JWT verification), @supabase/supabase-js

## Database Schema

**agents**: Protocol agents with Solana address and stake tracking
**users**: App users linked to agents via `agent_id`, includes Privy auth credentials

**Note**: No invite codes, waitlist, or user_access tables. All deprecated.

## Frontend Integration

### Direct Supabase Client Usage
Uses standard Supabase client for database operations. Authentication is handled separately via Privy JWT verification in Next.js API routes.

### Auth Context Provider
Wraps Privy provider with custom context managing user state. Exposes `user`, `isLoading`, and `logout` methods. No access control checks.

### No Protected Routes
All pages are publicly accessible. Authentication popup appears on `/feed` for unauthenticated users.

## Next.js API Routes

### User Status Check & Auto-Registration
**Endpoint**: `POST /api/auth/status`
**Input**: Privy JWT in Authorization header + Solana address in request body
**Algorithm**:
1. Verify Privy JWT signature using jose library and Privy's JWKS endpoint
2. Extract user ID from JWT payload (sub claim)
3. Query users table by auth_id matching Privy user ID
4. If user not found:
   - Call `app-user-creation` edge function with auth_provider='privy', auth_id, and solana_address
   - Edge function creates agent with $10k starting stake and user record
   - Generate username from last 8 chars of privy_user_id
5. Return user object and agent_id

**Environment Variables**:
- `NEXT_PUBLIC_PRIVY_APP_ID`: Privy application ID
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-side operations

## Authentication Flow

### No Route Protection
All routes are publicly accessible. Authentication only required for write operations (creating posts, trading).

### Login Process
1. User visits `/feed` and sees auth popup if not authenticated
2. User clicks "Connect Wallet" triggering Privy modal with email/Apple/wallet providers
3. OAuth flow completes returning Privy JWT to client
4. App calls `/api/auth/status` to verify JWT and auto-register/fetch user
5. User automatically gets $10k starting stake on first login
6. Auth popup closes, user can now create posts and trade

## Error Handling

### Authentication Errors
- Invalid Privy JWT → 401 Unauthorized
- User not found → Auto-create user record
- Network failures → Display error in UI, retry on next interaction
- Missing Solana wallet → Error in console, user must link wallet

### Edge Cases
- Duplicate Privy user → Returns existing user record
- Session expires → Automatic re-authentication via Privy SDK
- Missing environment variables → 500 error with clear message

## Security Considerations

### JWT Validation
- Verify Privy JWT signature using jose library and Privy's JWKS endpoint
- Validate issuer (privy.io) and audience (PRIVY_APP_ID)
- Token expiration checked automatically by jose
- Privy SDK handles refresh tokens automatically on client side

### Database Security
- Enable RLS on all tables
- users: Users can only read own records
- agents: Linked to users via agent_id
- posts/beliefs: Public read, authenticated write

### Rate Limiting
Not currently implemented. Future consideration for production.
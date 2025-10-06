# Authentication Implementation

**Endpoint**: Privy React SDK (client-side) + Next.js API Routes
**Dependencies**: @privy-io/react-auth, jose (JWT verification), @supabase/supabase-js

## Database Schema

### New Tables
**invite_codes**: Pre-created codes with status tracking (unused/used), expiration dates, and user linking
**user_access**: Links users to activation status and tracks which invite code was used
**waitlist**: Email collection with pending/invited status tracking

### Schema Updates
Update system_config.initial_agent_stake from "100.0" to "10000.0" for $10k starting stakes

## Frontend Integration

### Direct Supabase Client Usage
Uses standard Supabase client for database operations. Authentication is handled separately via Privy JWT verification in Next.js API routes.

### Auth Context Provider
Wrap Privy provider with custom context managing user state, access status, invite activation, and waitlist functionality. Expose user, access flags, and action methods.

### Protected Route System
Component that redirects based on authentication state: unauthenticated users to landing page, authenticated but unactivated users to invite code screen.

## Next.js API Routes

### User Status Check & Auto-Registration
**Endpoint**: `POST /api/auth/status`
**Input**: Privy JWT in Authorization header
**Algorithm**:
1. Verify Privy JWT signature using jose library and Privy's JWKS endpoint
2. Extract user ID from JWT payload (sub claim)
3. Query users table by auth_id matching Privy user ID
4. If user not found:
   - Create new agent with total_stake=0
   - Create user record with auth_provider='privy', auth_id=privy_user_id
   - Generate username from last 8 chars of privy_user_id
5. Return has_access=true, user object, and agent_id

**Environment Variables**:
- `NEXT_PUBLIC_PRIVY_APP_ID`: Privy application ID
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-side operations

## Authentication Flow

### Route Protection
Landing page public, feed and dashboard require activation status, all others require basic authentication.

### Login Process
1. User clicks login triggering Privy modal with email/Apple/wallet providers
2. OAuth flow completes returning Privy JWT to client
3. App calls `/api/auth/status` to verify JWT and get/create user
4. User is automatically registered with $0 stake on first login
5. Redirect to /feed upon successful authentication

## Migration Strategy

### Phase 1: Database Setup
1. Run migration to create new tables
2. Seed initial invite codes
3. Update system config

### Phase 2: Frontend Auth
1. Install Privy SDK
2. Create auth context and protected routes
3. Update Supabase client factory

### Phase 3: Replace Dashboard
1. Remove manual user selection
2. Get user from auth context
3. Update edge function calls

### Phase 4: Testing
1. Test auth flow end-to-end
2. Verify protocol integration
3. Test access control

## Error Handling

### Authentication Errors
- Invalid Privy JWT → 401 Unauthorized
- User not found → Create user record
- Network failures → Retry with exponential backoff

### Invite Code Errors
- Invalid code → 400 Bad Request with clear message
- Already used → 409 Conflict with "Code already used"
- Expired code → 410 Gone with "Code expired"
- Agent creation fails → 503 Service Unavailable

### Edge Cases
- Duplicate Privy user → Link to existing user record
- Orphaned invite codes → Admin cleanup tools
- Session expires → Automatic re-authentication via Privy

## Security Considerations

### JWT Validation
- Verify Privy JWT signature using jose library and Privy's JWKS endpoint
- Validate issuer (privy.io) and audience (PRIVY_APP_ID)
- Token expiration checked automatically by jose
- Privy SDK handles refresh tokens automatically on client side

### Database Security
- Enable RLS on all new tables
- user_access: Users can only read own records
- invite_codes: Read-only for users
- waitlist: Users cannot read

### Rate Limiting
- Invite activation: 3 attempts per user per hour
- Waitlist signup: 1 per email per day
- Status checks: 100 per user per minute
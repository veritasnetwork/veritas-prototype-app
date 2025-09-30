# Authentication Implementation

**Endpoint**: Privy React SDK (client-side) + Supabase edge functions
**Dependencies**: @privy-io/react-auth, existing protocol functions

## Database Schema

### New Tables
**invite_codes**: Pre-created codes with status tracking (unused/used), expiration dates, and user linking
**user_access**: Links users to activation status and tracks which invite code was used
**waitlist**: Email collection with pending/invited status tracking

### Schema Updates
Update system_config.initial_agent_stake from "100.0" to "10000.0" for $10k starting stakes

## Frontend Integration

### Supabase Client Factory
Create authenticated client factory that injects Privy JWT into Supabase headers for authenticated requests. Keep existing public client for unauthenticated operations.

### Auth Context Provider
Wrap Privy provider with custom context managing user state, access status, invite activation, and waitlist functionality. Expose user, access flags, and action methods.

### Protected Route System
Component that redirects based on authentication state: unauthenticated users to landing page, authenticated but unactivated users to invite code screen.

## Edge Functions

### Waitlist Signup
**Endpoint**: `/app/auth/waitlist-join`
**Input**: Email address
**Algorithm**:
1. Validate email format using regex
2. Insert into waitlist table with status 'pending' (ignore duplicates)
3. Return success confirmation

### Invite Code Activation
**Endpoint**: `/app/auth/activate-invite`
**Input**: Invite code string, Privy user ID from JWT
**Algorithm**:
1. Validate Privy JWT signature and extract user ID
2. Verify invite code exists and has status 'unused'
3. Call protocol agent creation function with $10k starting stake
4. Update users table with auth_provider='privy', auth_id=privy_user_id, agent_id=new_agent_id
5. Mark invite code as 'used' with used_by_user_id and used_at timestamp
6. Create user_access record with status='activated' and invite_code_used
7. Return success with user_id and agent_id

### User Status Check
**Endpoint**: `/app/auth/status`
**Input**: Privy JWT in Authorization header
**Algorithm**:
1. Validate Privy JWT signature and extract user ID
2. Find user record by auth_id matching Privy user ID
3. Query user_access table for activation status
4. Return has_access boolean, needs_invite boolean, and agent_id if activated

## Authentication Flow

### Route Protection
Landing page public, feed and dashboard require activation status, all others require basic authentication.

### Login Process
1. User clicks login triggering Privy modal with OAuth providers
2. OAuth flow completes returning Privy JWT to client
3. App calls status endpoint to check activation state
4. If activated redirect to feed, if not activated show invite code input

### Invite Activation
1. User enters invite code in form
2. Call activation endpoint with code and JWT
3. If valid create agent and redirect to feed
4. If invalid display error message and allow retry

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
- Verify Privy JWT signature on every request
- Check token expiration
- Handle refresh tokens automatically

### Database Security
- Enable RLS on all new tables
- user_access: Users can only read own records
- invite_codes: Read-only for users
- waitlist: Users cannot read

### Rate Limiting
- Invite activation: 3 attempts per user per hour
- Waitlist signup: 1 per email per day
- Status checks: 100 per user per minute
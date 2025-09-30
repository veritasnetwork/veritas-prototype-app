# Authentication Edge Functions - Test Specifications

*References: `/specs/auth-specs/01-authentication-system.md`, `/specs/auth-specs/02-authentication-implementation.md`*

Test specification for authentication edge functions: status check, invite activation, and waitlist signup.

## Core Requirements

### **Status Check** (`/app/auth/status`)
- Validate Privy JWT signature and extract user ID
- Check user existence and activation status
- Return user access state and agent information

### **Invite Activation** (`/app/auth/activate-invite`)
- Validate invite code availability
- Create protocol agent with $10k starting stake
- Link Privy user to protocol agent
- Update invite code and access records

### **Waitlist Signup** (`/app/auth/waitlist-join`)
- Validate email format
- Insert into waitlist with duplicate handling
- Return success confirmation

## Essential Tests - Status Check

### **Authentication**
```
Test 1: Valid JWT token
- Input: Valid Privy JWT in Authorization header
- Expected: Successfully extract user ID, process request

Test 2: Missing authorization header
- Input: Request without Authorization header
- Expected: 401 Unauthorized, error message

Test 3: Invalid JWT format
- Input: Authorization header without "Bearer " prefix
- Expected: 401 Unauthorized, invalid format error

Test 4: Malformed JWT
- Input: Invalid JWT signature or structure
- Expected: 401 Unauthorized, token validation error
```

### **User Status Detection**
```
Test 5: New user (no database record)
- Input: Valid JWT for user not in database
- Expected: { has_access: false, needs_invite: true, user: null }

Test 6: User with pending access
- Input: User exists but user_access.status = 'pending'
- Expected: { has_access: false, needs_invite: true, user: null }

Test 7: Activated user
- Input: User with user_access.status = 'activated'
- Expected: { has_access: true, needs_invite: false, user: {...}, agent_id: "..." }

Test 8: User without access record
- Input: User exists but no user_access entry
- Expected: { has_access: false, needs_invite: true, user: null }
```

### **Error Handling**
```
Test 9: Database connection failure
- Setup: Mock database unavailable
- Expected: 500 Internal Server Error

Test 10: User table query failure
- Setup: Force database error during user lookup
- Expected: 500 Internal Server Error, logged error
```

## Essential Tests - Invite Activation

### **Invite Code Validation**
```
Test 11: Valid unused invite code
- Input: Valid code "ALPHA001", valid JWT
- Expected: Agent created, user linked, invite marked used

Test 12: Invalid invite code
- Input: Non-existent code "INVALID"
- Expected: 400 Bad Request, "Invalid invite code"

Test 13: Already used invite code
- Input: Code with status = 'used'
- Expected: 409 Conflict, "Invite code already used"

Test 14: Missing invite code
- Input: Request body without 'code' field
- Expected: 400 Bad Request, "Invite code is required"
```

### **Agent Creation Flow**
```
Test 15: Successful agent creation
- Input: Valid invite code, valid user
- Expected: New agent with $10k stake, active_status = true

Test 16: Initial stake configuration
- Input: Valid activation request
- Expected: Agent created with system_config.initial_agent_stake value

Test 17: Agent creation failure
- Setup: Force database error during agent creation
- Expected: 500 Internal Server Error, no partial state
```

### **User Record Management**
```
Test 18: New user creation
- Input: Privy user not in database
- Expected: User record created with auth_id, auth_provider, agent_id

Test 19: Existing user update
- Input: User exists but no agent_id
- Expected: User record updated with new agent_id

Test 20: User creation failure
- Setup: Force error during user upsert
- Expected: 500 Internal Server Error, agent creation rolled back
```

### **Access Record Creation**
```
Test 21: Access record creation
- Input: Successful activation
- Expected: user_access record with status='activated', activated_at timestamp

Test 22: Invite code update
- Input: Successful activation
- Expected: invite_codes.status='used', used_by_user_id set, used_at timestamp
```

## Essential Tests - Waitlist Signup

### **Email Validation**
```
Test 23: Valid email format
- Input: "user@example.com"
- Expected: 200 Success, email added to waitlist

Test 24: Invalid email format
- Input: "invalid-email", "user@", "@domain.com"
- Expected: 400 Bad Request, "Valid email address is required"

Test 25: Missing email field
- Input: Request body without 'email'
- Expected: 400 Bad Request, "Valid email address is required"
```

### **Duplicate Handling**
```
Test 26: New email signup
- Input: Email not in waitlist
- Expected: 200 Success, new waitlist record created

Test 27: Duplicate email signup
- Input: Email already in waitlist
- Expected: 200 Success, no error (graceful duplicate handling)

Test 28: Case insensitive emails
- Input: "USER@EXAMPLE.COM" when "user@example.com" exists
- Expected: 200 Success, treats as duplicate
```

### **Database Operations**
```
Test 29: Successful insertion
- Input: Valid new email
- Expected: waitlist record with status='pending', created_at timestamp

Test 30: Database failure
- Setup: Force database error during insertion
- Expected: 500 Internal Server Error
```

## Database Transaction Tests

### **Atomicity**
```
Test 31: Invite activation rollback
- Setup: Force failure after agent creation but before user update
- Expected: Complete rollback, no orphaned agent records

Test 32: Partial state prevention
- Setup: Force failure during invite code update
- Expected: All related records rolled back or none created

Test 33: Concurrent invite activation
- Setup: Two users try to use same invite code simultaneously
- Expected: One succeeds, one gets "already used" error
```

## Integration Tests

### **End-to-End Flows**
```
Test 34: Full activation flow
- Flow: Status check (needs invite) → Activate invite → Status check (has access)
- Expected: Proper state transitions, consistent responses

Test 35: Waitlist to activation flow
- Flow: Join waitlist → Manual invite creation → Activate invite
- Expected: Complete user journey success

Test 36: Authentication integration
- Flow: Privy login → Status check → App access determination
- Expected: Proper routing based on access status
```

### **Cross-Function Consistency**
```
Test 37: User state consistency
- Flow: Activate invite → Check status from different session
- Expected: Consistent user state across requests

Test 38: Agent linkage verification
- Flow: Activate invite → Verify agent exists with correct stake
- Expected: Agent properly linked and configured
```

## Security Tests

### **JWT Security**
```
Test 39: Expired JWT handling
- Input: Expired Privy JWT
- Expected: 401 Unauthorized, token expired error

Test 40: Tampered JWT detection
- Input: JWT with modified signature
- Expected: 401 Unauthorized, invalid signature error

Test 41: Wrong issuer JWT
- Input: JWT from different issuer
- Expected: 401 Unauthorized, invalid issuer error
```

### **Rate Limiting**
```
Test 42: Invite activation rate limiting
- Input: Multiple activation attempts from same user
- Expected: Rate limit after 3 attempts per hour

Test 43: Waitlist signup rate limiting
- Input: Multiple signups from same IP/email
- Expected: Rate limit after 1 attempt per day per email
```

## Error Recovery Tests

### **Network Failures**
```
Test 44: Database timeout handling
- Setup: Mock slow database responses
- Expected: Proper timeout and error response

Test 45: Service degradation
- Setup: Partial service failures
- Expected: Graceful degradation, clear error messages
```

## Validation Rules
- All JWT validation must be thorough and secure
- Database transactions must be atomic
- Error messages must not leak sensitive information
- All timestamps must be in UTC
- Database cleanup after each test
- Invite codes must be case-insensitive
- Email addresses must be normalized to lowercase
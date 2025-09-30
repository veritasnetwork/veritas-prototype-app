# Authentication Database - Test Specifications

*References: `/specs/auth-specs/02-authentication-implementation.md`, `/supabase/migrations/20241216_add_auth_tables.sql`*

Test specification for authentication database tables, constraints, and Row Level Security policies.

## Core Requirements

### **Database Schema**
- invite_codes: Pre-created codes with status tracking
- user_access: User activation status per invite code
- waitlist: Email collection for future invites
- users: Link Privy auth_id to protocol agent_id

### **Row Level Security**
- Proper access control on all auth tables
- User isolation and data protection
- Service role administrative access

### **Data Integrity**
- Referential integrity constraints
- Status consistency validation
- Atomic operations and transactions

## Essential Tests - Table Structure

### **invite_codes Table**
```
Test 1: Table creation and structure
- Verify: id (UUID), code (TEXT UNIQUE), status (TEXT), created_by_user_id (UUID)
- Verify: used_by_user_id (UUID), used_at (TIMESTAMPTZ), expires_at (TIMESTAMPTZ)
- Expected: All columns present with correct types

Test 2: Unique constraint on code
- Insert: Two records with same code value
- Expected: Second insert fails with unique constraint violation

Test 3: Status enum constraint
- Insert: Record with status = 'invalid'
- Expected: Insert fails, only 'unused'/'used' allowed

Test 4: Consistency constraint validation
- Insert: status='used' with null used_by_user_id
- Expected: Insert fails, constraint violation

Test 5: Foreign key constraints
- Insert: created_by_user_id referencing non-existent user
- Expected: Insert fails with foreign key violation
```

### **user_access Table**
```
Test 6: Table structure validation
- Verify: id (UUID), user_id (UUID UNIQUE), status (TEXT), invite_code_used (TEXT)
- Verify: activated_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
- Expected: All columns present, user_id has unique constraint

Test 7: User uniqueness enforcement
- Insert: Two access records for same user_id
- Expected: Second insert fails with unique constraint violation

Test 8: Status validation
- Insert: Record with status = 'invalid'
- Expected: Insert fails, only 'pending'/'activated' allowed

Test 9: Activation consistency constraint
- Insert: status='activated' with null activated_at
- Expected: Insert fails, consistency constraint violation

Test 10: Invite code reference constraint
- Insert: invite_code_used referencing non-existent code
- Expected: Insert fails with foreign key violation
```

### **waitlist Table**
```
Test 11: Table structure validation
- Verify: id (UUID), email (TEXT UNIQUE), status (TEXT)
- Verify: invited_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
- Expected: All columns present with correct constraints

Test 12: Email uniqueness enforcement
- Insert: Two records with same email
- Expected: Second insert fails with unique constraint violation

Test 13: Status validation
- Insert: Record with status = 'invalid'
- Expected: Insert fails, only 'pending'/'invited' allowed

Test 14: Invitation consistency constraint
- Insert: status='invited' with null invited_at
- Expected: Insert fails, consistency constraint violation
```

## Essential Tests - Row Level Security

### **invite_codes RLS Policies**
```
Test 15: Authenticated user read access
- Setup: User with valid JWT
- Action: SELECT from invite_codes
- Expected: Query succeeds, returns visible records

Test 16: Unauthenticated user access
- Setup: No authentication
- Action: SELECT from invite_codes
- Expected: Query fails with insufficient privileges

Test 17: User write restrictions
- Setup: Authenticated user
- Action: INSERT/UPDATE/DELETE on invite_codes
- Expected: Operations fail, read-only access only

Test 18: Service role full access
- Setup: Service role credentials
- Action: All CRUD operations on invite_codes
- Expected: All operations succeed
```

### **user_access RLS Policies**
```
Test 19: User can view own record
- Setup: User authenticated with JWT
- Action: SELECT from user_access WHERE user_id = current_user
- Expected: Query succeeds, returns user's record

Test 20: User cannot view others' records
- Setup: User authenticated with JWT
- Action: SELECT from user_access WHERE user_id != current_user
- Expected: Query returns empty result set

Test 21: User write restrictions
- Setup: Authenticated user
- Action: INSERT/UPDATE on user_access
- Expected: Operations fail, read-only access

Test 22: Service role administrative access
- Setup: Service role credentials
- Action: Full CRUD operations on user_access
- Expected: All operations succeed
```

### **waitlist RLS Policies**
```
Test 23: User access restriction
- Setup: Authenticated user
- Action: SELECT from waitlist
- Expected: Query fails, no user access allowed

Test 24: Service role exclusive access
- Setup: Service role credentials
- Action: All CRUD operations on waitlist
- Expected: All operations succeed

Test 25: Anonymous write prevention
- Setup: No authentication
- Action: INSERT into waitlist
- Expected: Query fails with insufficient privileges
```

## Essential Tests - Data Operations

### **Invite Code Operations**
```
Test 26: Initial seed data verification
- Action: SELECT from invite_codes WHERE code IN ('ALPHA001', 'ALPHA002', ...)
- Expected: 5 initial codes present with status='unused'

Test 27: Code activation flow
- Action: Update invite code status to 'used' with timestamps
- Expected: Update succeeds, constraints satisfied

Test 28: Code expiration handling
- Setup: Insert code with past expires_at
- Action: Query for available codes
- Expected: Expired codes properly identified

Test 29: Code usage tracking
- Action: Update code with used_by_user_id and used_at
- Expected: Proper linkage to user, timestamp recorded
```

### **User Access Operations**
```
Test 30: New user access creation
- Action: INSERT user_access with status='pending'
- Expected: Record created with created_at timestamp

Test 31: User activation process
- Action: UPDATE user_access SET status='activated', activated_at=NOW()
- Expected: Status updated, timestamp recorded, constraints satisfied

Test 32: Access status queries
- Action: Query user access status for authentication
- Expected: Efficient query execution, correct status returned

Test 33: User cleanup operations
- Action: DELETE user and associated access records
- Expected: Cascading deletes work properly
```

### **Waitlist Operations**
```
Test 34: Email signup insertion
- Action: INSERT waitlist with normalized email
- Expected: Record created with status='pending'

Test 35: Duplicate email handling
- Action: INSERT same email twice
- Expected: Second insert fails with unique constraint

Test 36: Email normalization
- Action: INSERT email with mixed case
- Expected: Email stored in lowercase

Test 37: Invitation tracking
- Action: UPDATE waitlist SET status='invited', invited_at=NOW()
- Expected: Status updated with proper timestamp
```

## Essential Tests - System Configuration

### **Initial Stake Configuration**
```
Test 38: System config update verification
- Action: SELECT value FROM system_config WHERE key='initial_agent_stake'
- Expected: Value = '10000.0' (updated from migration)

Test 39: Stake value data type
- Action: Verify initial_agent_stake can be parsed as float
- Expected: Value parses correctly to 10000.0

Test 40: Configuration consistency
- Action: Query system_config for required auth-related settings
- Expected: All necessary configuration present
```

## Essential Tests - Indexing and Performance

### **Index Effectiveness**
```
Test 41: Invite code lookup performance
- Action: Query invite_codes by code value
- Expected: Uses idx_invite_codes_code index efficiently

Test 42: User access lookup performance
- Action: Query user_access by user_id
- Expected: Uses idx_user_access_user_id index efficiently

Test 43: Waitlist email lookup performance
- Action: Query waitlist by email
- Expected: Uses idx_waitlist_email index efficiently

Test 44: Status filtering performance
- Action: Query records by status fields
- Expected: Uses appropriate status indexes efficiently
```

## Integration Tests

### **Cross-Table Relationships**
```
Test 45: User to agent linkage
- Flow: Create user → Link to agent → Verify relationship
- Expected: Proper foreign key relationships maintained

Test 46: Invite activation chain
- Flow: Use invite code → Create user access → Update invite status
- Expected: All related records properly linked and updated

Test 47: User cleanup cascade
- Flow: Delete user → Verify related records handling
- Expected: Proper cascade behavior, no orphaned records

Test 48: Agent creation integration
- Flow: Invite activation → Agent creation → User linkage
- Expected: Complete integration works atomically
```

## Transaction Tests

### **Atomicity**
```
Test 49: Invite activation transaction
- Setup: Begin transaction, update invite and create access
- Test: Force failure after first operation
- Expected: Complete rollback, no partial state

Test 50: User creation transaction
- Setup: Begin transaction, create user and access records
- Test: Force failure during user creation
- Expected: Complete rollback, no orphaned access record

Test 51: Concurrent code usage
- Setup: Two transactions attempt to use same invite code
- Expected: One succeeds, one fails with proper error

Test 52: Database deadlock handling
- Setup: Concurrent operations creating potential deadlock
- Expected: Proper deadlock detection and resolution
```

## Migration Tests

### **Schema Migration Validation**
```
Test 53: Migration idempotency
- Action: Run migration twice
- Expected: Second run succeeds without errors

Test 54: Migration rollback
- Action: Apply migration then rollback
- Expected: Schema returns to previous state

Test 55: Data preservation during migration
- Setup: Existing data in related tables
- Action: Run auth migration
- Expected: Existing data preserved, no corruption

Test 56: Index creation verification
- Action: Run migration and verify indexes
- Expected: All specified indexes created correctly
```

## Security Tests

### **SQL Injection Prevention**
```
Test 57: Parameter injection attempts
- Action: Attempt SQL injection through auth endpoints
- Expected: All attempts blocked by parameterized queries

Test 58: RLS bypass attempts
- Action: Attempt to bypass RLS with crafted queries
- Expected: Security policies prevent unauthorized access

Test 59: Privilege escalation prevention
- Action: Attempt unauthorized operations as regular user
- Expected: Operations blocked by security policies
```

## Validation Rules
- All constraints must be properly enforced
- RLS policies must provide complete security
- Indexes must exist for all frequently queried columns
- Foreign key relationships must be consistent
- Transaction atomicity must be maintained
- Migration must be reversible and idempotent
- Error messages must not leak sensitive information
- Performance must meet acceptable thresholds
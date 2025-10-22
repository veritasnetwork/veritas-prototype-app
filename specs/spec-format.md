# Veritas Specification Format

**Purpose:** Standard format for all specs - lean, scannable, complete
**Philosophy:** High-level overview + low-level details. No bloat. Only facts.

---

## Template Structure

Every spec follows this structure:

```markdown
# [Feature Name]

## Overview
[2-3 sentences: What it does, why it exists, where it fits]

## Context
- **Layer:** [App / Protocol / Solana / Infrastructure]
- **Dependencies:** [List of other features this depends on]
- **Used By:** [What uses this feature]
- **Status:** [Implemented / In Progress / Planned]

---

## High-Level Design

### Flow
[Numbered list of steps - no prose, just the sequence]

### State Changes
[What data changes when this runs]

### Key Decisions
[2-4 bullet points on important design choices]

---

## Implementation

### Functions
[Table format - name, signature, purpose]

### Data Structures
[Schemas/types - TypeScript or SQL format]

### Edge Cases
[Bullet list of edge cases and how they're handled]

### Errors
[Table: Error condition → Response/Action]

---

## Integration

### API Contract
[For APIs: method, path, request/response]

### Events Emitted
[For event sources: event names and payloads]

### Required Permissions
[Auth requirements, access controls]

---

## Testing

### Critical Paths
[3-5 must-test scenarios]

### Test Implementation
- **Test Spec:** `specs/test-specs/category/feature-name.test.md`
- **Test Code:** `tests/category/feature-name.test.ts`

### Validation
[How to verify this works correctly]

---

## References
[Links to code, related specs, external docs]
```

---

## Format Rules

### ✅ DO:
- Use tables for structured data (functions, errors, API routes)
- Use numbered lists for sequences/flows
- Use bullet points for sets/options
- Include actual TypeScript/SQL schemas
- State facts, not explanations
- Link to code with file:line notation
- Reference both test spec AND test code in Testing section

### ❌ DON'T:
- Write paragraphs explaining "why" (save for Key Decisions)
- Repeat information from other specs (link instead)
- Include examples unless they clarify edge cases
- Write prose - use lists and tables
- Speculate or use "should" (document what IS)
- Forget to link test specs and test code

---

## Spec Type Templates

### 1. API Route Spec

```markdown
# POST /api/example/route

## Overview
[What this endpoint does in 1 sentence]

## Context
- **Layer:** App
- **Auth:** Required (Privy JWT) / Admin / Public
- **Dependencies:** [database tables, services]
- **Used By:** [UI components, other services]

---

## API Contract

**Method:** POST
**Path:** `/api/example/route`
**Auth:** Bearer token (Privy JWT)

### Request
```typescript
{
  field1: string,
  field2: number,
  optional?: boolean
}
```

### Response (200)
```typescript
{
  result: string,
  data: {...}
}
```

### Errors
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid field1 | `{error: "field1 must be..."}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 404 | Resource not found | `{error: "Not found"}` |
| 500 | Database error | `{error: "Internal error"}` |

---

## Implementation

### Flow
1. Validate auth token → user_id
2. Parse request body → validate fields
3. Query database for existing record
4. If exists: update, else: create
5. Return result

### Validation Rules
- `field1`: 3-50 chars, alphanumeric
- `field2`: > 0, < 1000000

### Database Operations
```sql
-- Query
SELECT * FROM table WHERE user_id = $1

-- Update/Insert
INSERT INTO table (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET ...
```

### Edge Cases
- Missing optional field → use default value
- Duplicate key → return 409 with existing record
- Concurrent updates → last write wins

---

## Testing

### Critical Paths
1. Valid request → 200 success
2. Invalid field1 → 400 validation error
3. No auth → 401 unauthorized
4. Duplicate → 409 conflict

### Test Implementation
- **Test Spec:** `specs/test-specs/api/example-route.test.md`
- **Test Code:** `tests/api/example-route.test.ts`

---

## References
- Code: `app/api/example/route/route.ts`
- Database: `specs/data-structures/01-protocol-tables.md#table-name`
- Related: `specs/api/other-endpoint.md`
```

---

### 2. UI Component Spec

```markdown
# ComponentName

## Overview
[What the component renders and its purpose]

## Context
- **Layer:** App
- **Location:** `src/components/path/ComponentName.tsx`
- **Used In:** [Parent components or pages]
- **Dependencies:** [Hooks, services, APIs]

---

## Interface

```typescript
interface ComponentNameProps {
  required: string;
  optional?: number;
  onAction: (data: Type) => void;
}
```

---

## Behavior

### User Flow
1. Component renders with initial state
2. User interacts (click, input, etc.)
3. Component updates state / calls API
4. Shows result / error state

### State Management
| State | Type | Purpose |
|-------|------|---------|
| `isLoading` | boolean | Shows loading spinner |
| `error` | string \| null | Error message |
| `data` | Type \| null | Fetched data |

### Events
| Event | Trigger | Action |
|-------|---------|--------|
| `onClick` | Button click | Call API, show loading |
| `onSuccess` | API success | Update state, call onAction |
| `onError` | API error | Show error message |

---

## Implementation

### API Calls
```typescript
POST /api/endpoint
Request: { field: value }
Response: { result: data }
```

### Validation
- Field 1: Required, min 3 chars
- Field 2: Number, range 0-100

### Edge Cases
- No data loaded → show empty state
- API error → show error message with retry
- Loading during submit → disable button

---

## Testing

### Critical Paths
1. Render with props → displays correctly
2. Submit valid data → success state
3. Submit invalid data → validation error
4. API failure → error state with retry

### Test Implementation
- **Test Spec:** `specs/test-specs/ui/component-name.test.md`
- **Test Code:** `tests/ui/ComponentName.test.tsx`

---

## References
- Code: `src/components/path/ComponentName.tsx:1`
- API: `specs/api/endpoint.md`
- Parent: `specs/ui-specs/pages/PageName.md`
```

---

### 3. Service/Library Spec

```markdown
# ServiceName / LibraryName

## Overview
[What this code does - 1 sentence]

## Context
- **Layer:** [App / Protocol / Infrastructure]
- **Location:** `src/services/name.ts` or `src/lib/name.ts`
- **Used By:** [Components, APIs, other services]
- **Dependencies:** [External libraries, other services]

---

## Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `mainFunction` | `(param: Type) => Promise<Result>` | Does X with Y |
| `helper` | `(a: number, b: number) => number` | Calculates Z |

---

## Implementation

### `mainFunction`

**Signature:**
```typescript
async function mainFunction(
  param1: Type1,
  param2?: Type2
): Promise<ResultType>
```

**Flow:**
1. Validate inputs
2. Call dependency A
3. Transform data
4. Call dependency B
5. Return result

**Edge Cases:**
- `param1` is null → throw error
- `param2` missing → use default value
- Dependency fails → retry 3 times, then throw

**Errors:**
| Condition | Error Type | Message |
|-----------|------------|---------|
| Invalid input | `ValidationError` | "param1 must be..." |
| Dependency timeout | `TimeoutError` | "Request timed out" |

---

### `helper`

**Signature:**
```typescript
function helper(a: number, b: number): number
```

**Purpose:** Calculates sum with overflow protection

**Edge Cases:**
- `a + b > MAX_SAFE_INTEGER` → throw RangeError
- `a` or `b` is NaN → throw TypeError

---

## Data Structures

```typescript
interface ResultType {
  success: boolean;
  data?: DataType;
  error?: string;
}

interface DataType {
  id: string;
  value: number;
}
```

---

## Testing

### Critical Paths
1. Valid inputs → correct result
2. Invalid inputs → validation error
3. Dependency failure → error handling
4. Edge case handling → correct behavior

### Test Implementation
- **Test Spec:** `specs/test-specs/services/service-name.test.md`
- **Test Code:** `tests/services/service-name.test.ts`

### Validation
- Unit tests for all functions
- Integration tests with real dependencies
- Edge case coverage > 90%

---

## References
- Code: `src/services/name.ts`
- Used in: `app/api/route/route.ts:42`
- Dependencies: `specs/libraries/dependency.md`
```

---

### 4. Architecture/System Spec

```markdown
# System Name

## Overview
[What the system does - 2-3 sentences]

## Context
- **Layer:** [Infrastructure / Cross-cutting]
- **Components:** [List major components]
- **Dependencies:** [External systems, services]

---

## Architecture

### Components
| Component | Type | Responsibility |
|-----------|------|----------------|
| Component A | Service | Handles X |
| Component B | Library | Provides Y |
| Component C | API | Exposes Z |

### Data Flow
```
Source → Component A → Component B → Destination
                    ↓
                Component C (side effect)
```

### State Management
- **Where stored:** Database / Memory / Chain
- **How updated:** Event-driven / Polling / Manual
- **Consistency:** Eventually consistent / Strongly consistent

---

## Implementation

### Component A

**Location:** `src/path/component-a.ts`

**Functions:**
| Function | Purpose |
|----------|---------|
| `processX` | Main processing logic |
| `handleY` | Error recovery |

**Flow:**
1. Receive input from source
2. Validate and transform
3. Call Component B
4. Handle response
5. Trigger Component C if needed

---

### Component B

**Location:** `src/path/component-b.ts`

**Functions:**
| Function | Purpose |
|----------|---------|
| `calculate` | Core calculation |
| `validate` | Input validation |

---

### Integration Points

| System | Direction | Protocol | Purpose |
|--------|-----------|----------|---------|
| External API | Outbound | REST | Fetch data |
| Database | Bidirectional | PostgreSQL | Persist state |
| Event Bus | Publish | WebSocket | Notify changes |

---

## Edge Cases

### System-Level
- Component A unavailable → Circuit breaker, fallback to cache
- Network partition → Queue messages, retry after reconnect
- High load → Rate limiting, backpressure

### Data-Level
- Duplicate events → Deduplication with unique IDs
- Out-of-order events → Sequence numbers, buffer and reorder
- Corrupted data → Validation, reject and log

---

## Operational

### Monitoring
- Metric 1: Latency p95 < 500ms
- Metric 2: Error rate < 0.1%
- Metric 3: Queue depth < 1000

### Recovery
- Component failure → Auto-restart, alert if > 3 failures
- Data corruption → Rollback, resync from source
- Missed events → Backfill mechanism

---

## Testing

### Critical Paths
1. Happy path: Full flow end-to-end
2. Component failure: Recovery works
3. High load: System remains stable
4. Data issues: Handled correctly

### Test Implementation
- **Test Spec:** `specs/test-specs/architecture/system-name.test.md`
- **Test Code:** `tests/integration/system-name.test.ts`

### Validation
- Integration tests with all components
- Chaos testing (random failures)
- Load testing (10x expected traffic)

---

## References
- Code: `src/path/`
- Related: `specs/architecture/related-system.md`
- External: [External API docs](https://example.com)
```

---

### 5. Solana Contract Spec

```markdown
# ContractName

## Overview
[What the contract does - 1 sentence]

## Context
- **Layer:** Solana
- **Program ID:** `[address on mainnet/devnet]`
- **Location:** `solana/veritas-curation/programs/veritas-curation/src/module/`
- **Dependencies:** [Other programs via CPI]

---

## Instructions

| Instruction | Accounts | Purpose |
|-------------|----------|---------|
| `initialize` | 5 accounts | Creates program state |
| `execute` | 8 accounts | Main operation |
| `close` | 3 accounts | Cleanup |

---

## State

```rust
#[account]
pub struct ProgramState {
    pub authority: Pubkey,
    pub counter: u64,
    pub bump: u8,
}

// Size: 8 + 32 + 8 + 1 = 49 bytes
```

**PDA Derivation:**
```rust
seeds: ["state", authority.key().as_ref()]
```

---

## Implementation

### `initialize`

**Accounts:**
```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + ProgramState::SIZE,
        seeds = ["state", authority.key().as_ref()],
        bump
    )]
    pub state: Account<'info, ProgramState>,

    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. Validate authority is signer
2. Initialize state with default values
3. Store bump seed
4. Emit InitializedEvent

**Constraints:**
- State account must not exist
- Payer must have sufficient SOL for rent

**Edge Cases:**
- Already initialized → Error: AccountAlreadyInitialized
- Insufficient rent → Error: InsufficientFunds

---

### `execute`

**Accounts:**
```rust
#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(
        mut,
        seeds = ["state", authority.key().as_ref()],
        bump = state.bump,
        has_one = authority
    )]
    pub state: Account<'info, ProgramState>,

    pub authority: Signer<'info>,

    // ... other accounts
}
```

**Parameters:**
```rust
pub struct ExecuteParams {
    pub amount: u64,
    pub option: u8,
}
```

**Logic:**
1. Validate authority matches state.authority
2. Validate amount > 0
3. Update state.counter
4. Perform operation based on option
5. Emit ExecutedEvent

**Constraints:**
- `amount > 0`
- `option in [0, 1, 2]`
- Authority must match

**Edge Cases:**
- amount = 0 → Error: InvalidAmount
- Invalid option → Error: InvalidOption
- Wrong authority → Error: Unauthorized

---

## Events

```rust
#[event]
pub struct InitializedEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ExecutedEvent {
    pub authority: Pubkey,
    pub amount: u64,
    pub counter: u64,
}
```

---

## Errors

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Invalid option")]
    InvalidOption,

    #[msg("Unauthorized")]
    Unauthorized,
}
```

---

## Testing

### Critical Paths
1. Initialize → creates state correctly
2. Execute with valid params → updates state
3. Execute with invalid params → returns error
4. Execute with wrong authority → unauthorized

### Test Implementation
- **Test Spec:** `specs/test-specs/solana/ContractName.test.md`
- **Test Code:** `solana/veritas-curation/tests/contract-name.test.ts`

### Validation
- All instructions tested
- All error cases covered
- PDA derivation verified
- Event emission verified

---

## References
- Code: `solana/veritas-curation/programs/veritas-curation/src/module/instructions/`
- State: `solana/veritas-curation/programs/veritas-curation/src/module/state.rs`
- Tests: `solana/veritas-curation/tests/module.test.ts`
```

---

## Example: Filled Out Spec

Here's a real example using the lean format:

```markdown
# Event Indexing System

## Overview
Synchronizes on-chain events (trades, settlements, deposits) to Supabase database in real-time. Uses WebSocket for local/devnet, Helius webhooks for mainnet.

## Context
- **Layer:** Infrastructure
- **Dependencies:** Solana RPC, Helius API, event-processor service, Supabase
- **Used By:** Trading UI, analytics, pool metrics
- **Status:** Implemented

---

## High-Level Design

### Flow
1. Blockchain emits event (Trade, Settlement, etc.)
2. Indexer receives event (WebSocket or webhook)
3. Event processor parses Anchor logs
4. Check deduplication (event_signature)
5. Write to database (trades, settlements, etc.)
6. Update derived state (pool balances, user holdings)

### State Changes
- `trades` table: INSERT new row
- `pool_deployments`: UPDATE reserves, supplies
- `agents`: UPDATE total_stake, active_belief_count

### Key Decisions
- Two indexers (WebSocket + webhook) for different networks
- Event signature deduplication prevents double-processing
- Idempotent inserts (ON CONFLICT DO NOTHING)
- Eventually consistent (accept slight lag)

---

## Implementation

### Components

| Component | Type | Location |
|-----------|------|----------|
| WebSocket Indexer | Service | `src/services/websocket-indexer.service.ts` |
| Helius Webhook | API Route | `app/api/webhooks/helius/route.ts` |
| Event Processor | Service | `src/services/event-processor.service.ts` |

### Event Processor Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `processTrade` | `(event: TradeEvent, tx: string) => Promise<void>` | Record trade in DB |
| `processSettlement` | `(event: SettlementEvent, tx: string) => Promise<void>` | Record settlement |
| `generateEventSig` | `(tx: string, ix: number, ev: number) => string` | Create unique ID |

### Data Structures

```typescript
interface TradeEvent {
  trader: PublicKey;
  pool: PublicKey;
  side: 'long' | 'short';
  direction: 'buy' | 'sell';
  amountUsdc: bigint;
  tokensTraded: bigint;
  sqrtPriceLongX96: bigint;
  sqrtPriceShortX96: bigint;
}

interface SettlementEvent {
  pool: PublicKey;
  epoch: number;
  bdScore: number;
  fLong: number;
  fShort: number;
  reservesLongBefore: bigint;
  reservesLongAfter: bigint;
  reservesShortBefore: bigint;
  reservesShortAfter: bigint;
}
```

### Edge Cases
- Duplicate event (same tx + ix + event) → ON CONFLICT DO NOTHING
- Out-of-order events → Event signature guarantees deduplication
- Missing pool in DB → Error, skip event (pool must exist first)
- Indexer restart → Replay from last processed slot
- Network partition → WebSocket reconnects, webhooks retry

### Errors

| Condition | Action |
|-----------|--------|
| Invalid event format | Log error, skip event |
| Database constraint violation | Log warning, continue (likely duplicate) |
| Missing related record | Log error, skip event |
| Connection failure | Reconnect with exponential backoff |

---

## Integration

### WebSocket Subscription
```typescript
connection.onLogs(
  new PublicKey(PROGRAM_ID),
  (logs) => processLogs(logs),
  'confirmed'
);
```

### Helius Webhook
```
POST https://your-domain.com/api/webhooks/helius
Headers: x-helius-signature: [HMAC signature]
Body: { transaction: {...}, events: [...] }
```

### Database Schema
```sql
-- Event signature for deduplication
ALTER TABLE trades ADD COLUMN event_signature TEXT UNIQUE;
ALTER TABLE settlements ADD COLUMN event_signature TEXT UNIQUE;

-- Indexer state tracking
ALTER TABLE trades ADD COLUMN indexed_at TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN confirmed BOOLEAN DEFAULT false;
```

---

## Testing

### Critical Paths
1. Trade event → correctly recorded in trades table
2. Duplicate event → skipped (no duplicate DB entry)
3. Settlement event → updates pool reserves
4. Indexer restart → resumes from last slot

### Test Implementation
- **Test Spec:** `specs/test-specs/architecture/event-indexing.test.md`
- **Test Code:** `tests/services/event-processor.test.ts`

### Validation
- Event count on chain matches DB row count
- Pool reserves match chain state
- No duplicate event signatures
- Indexer lag < 5 seconds

---

## References
- WebSocket: `src/services/websocket-indexer.service.ts`
- Webhook: `app/api/webhooks/helius/route.ts`
- Processor: `src/services/event-processor.service.ts`
- Related: `specs/architecture/trading-flow.md`
```

---

## Spec File Naming

**Locations:**
- API routes: `specs/api/comprehensive-api-spec.md` (all routes in one file)
- UI components: `specs/ui-specs/components/ComponentName.md`
- Services: `specs/services/service-name.md`
- Libraries: `specs/libraries/library-name.md`
- Architecture: `specs/architecture/system-name.md`
- Solana: `specs/solana-specs/smart-contracts/ContractName.md`
- Development: `specs/development/tool-name.md`

**Convention:**
- Kebab-case for file names
- PascalCase for component/contract names in title
- One spec per service/library
- Group related API routes in one spec when sensible

---

## Maintenance

**When to update specs:**
1. Before implementing feature (spec-first)
2. After changing behavior
3. After adding edge case handling
4. After fixing bug (document the edge case)

**What to update:**
- Functions table (add/remove/change signatures)
- Flow (if steps change)
- Edge cases (add new ones discovered)
- Errors (add new error conditions)

**What NOT to update:**
- Don't add "nice to have" information
- Don't document temporary debugging code
- Don't explain obvious things
- Don't duplicate info from other specs (link instead)

---

## Quality Checklist

Before committing a spec, verify:

- [ ] Overview is 1-3 sentences max
- [ ] All functions have signatures in table format
- [ ] All edge cases listed with handling
- [ ] All errors documented with conditions
- [ ] Flow uses numbered list (not prose)
- [ ] No paragraphs explaining "why" (Key Decisions only)
- [ ] Code references use `file:line` format
- [ ] Cross-references to other specs work
- [ ] TypeScript/Rust/SQL is valid syntax
- [ ] No TODO or placeholder text

---

**End of Format Guide**

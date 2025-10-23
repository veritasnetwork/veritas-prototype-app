# Event Indexing System

## Overview
Synchronizes on-chain events (trades, settlements, deposits) to Supabase database in real-time. Uses WebSocket indexer for local/devnet, Helius webhooks for mainnet.

## Context
- **Layer:** Infrastructure
- **Dependencies:** Solana RPC, Helius API, event-processor service, Supabase
- **Used By:** Trading UI, pool metrics, analytics, user holdings
- **Status:** Implemented

---

## High-Level Design

### Flow
1. Blockchain emits event (Trade, Settlement, MarketDeployed, etc.)
2. Indexer receives event (WebSocket subscription OR Helius webhook)
3. Parse transaction logs to extract Anchor events
4. Generate event signature for deduplication
5. Check if event already processed (query by event_signature)
6. If new: Process event through event-processor service
7. Write to database tables (trades, settlements, pool_deployments)
8. Update derived state (pool reserves, user balances)

### State Changes
- `trades`: INSERT new row with event data
- `settlements`: INSERT settlement record
- `pool_deployments`: UPDATE reserves, supplies, mint addresses
- `custodian_deposits`: INSERT deposit record
- `custodian_withdrawals`: INSERT withdrawal record
- `agents`: UPDATE total_stake, active_belief_count (via redistribution)

### Key Decisions
- **Dual indexer approach:** WebSocket for local/devnet (low latency), Helius for mainnet (reliable, managed)
- **Event signature deduplication:** Prevents double-processing on indexer restarts or duplicate events
- **Idempotent inserts:** Database constraints (UNIQUE on event_signature) ensure safety
- **Eventually consistent:** Accept slight lag (1-5 seconds) for reliability over strict consistency

---

## Implementation

### Components

| Component | Type | Location | Purpose |
|-----------|------|----------|---------|
| WebSocket Indexer | Service | `src/services/websocket-indexer.service.ts` | Local/devnet event streaming |
| Helius Webhook | API Route | `app/api/webhooks/helius/route.ts` | Mainnet event ingestion |
| Event Processor | Service | `src/services/event-processor.service.ts` | Shared event parsing and DB writes |

### Event Types Supported

| Event | Emitted By | Triggers |
|-------|------------|----------|
| `Trade` | ContentPool::trade | Buy/sell LONG or SHORT tokens |
| `MarketDeployed` | ContentPool::deploy_market | Initial liquidity added |
| `EpochSettled` | ContentPool::settle_epoch | Pool settlement based on BD score |
| `PoolCreated` | PoolFactory::create_pool | New pool initialized |
| `Deposit` | VeritasCustodian::deposit | USDC deposited to stake |
| `Withdrawal` | VeritasCustodian::withdraw | USDC withdrawn from stake |

### Data Flow

```
Solana Chain
    ↓
WebSocket (local/devnet) OR Helius Webhook (mainnet)
    ↓
Parse transaction logs → Extract Anchor events
    ↓
Generate event_signature: ${tx_signature}:${ix_index}:${event_index}
    ↓
Check deduplication (query DB for event_signature)
    ↓
Event Processor Service
    ↓
Parse event data → Transform to DB schema
    ↓
Database Write (trades, settlements, pool_deployments, etc.)
    ↓
Update derived state (balances, supplies)
```

### Deduplication Strategy

**Event Signature Format:**
```
${transaction_signature}:${instruction_index}:${event_index_within_instruction}
```

**Examples:**
- `5Kx...abc:0:0` - First event in first instruction
- `5Kx...abc:0:1` - Second event in first instruction
- `5Kx...abc:1:0` - First event in second instruction

**Database Enforcement:**
```sql
ALTER TABLE trades ADD COLUMN event_signature TEXT UNIQUE;
ALTER TABLE settlements ADD COLUMN event_signature TEXT UNIQUE;

-- Idempotent insert
INSERT INTO trades (..., event_signature)
VALUES (..., $event_signature)
ON CONFLICT (event_signature) DO NOTHING;
```

### Edge Cases

| Condition | Handling |
|-----------|----------|
| Duplicate event (same signature) | Skip (ON CONFLICT DO NOTHING) |
| Out-of-order events | Event signature ensures deduplication regardless of order |
| Missing pool in database | Log error, skip event (pool must exist from deployment) |
| WebSocket disconnection | Auto-reconnect with exponential backoff |
| Helius webhook retry | Idempotent processing handles duplicates |
| Indexer restart | Resume from last confirmed slot (no reprocessing needed) |
| Event parsing failure | Log error with tx signature, skip event, alert monitoring |
| Database write failure | Throw error, event will retry (webhook) or reprocess (WebSocket) |

### Errors

| Error Type | Condition | Action |
|------------|-----------|--------|
| `EventParseError` | Invalid Anchor log format | Log error, skip event |
| `DatabaseConstraintError` | Duplicate event_signature | Log warning, continue (expected on retries) |
| `MissingPoolError` | Event references non-existent pool | Log error, skip event |
| `NetworkError` | WebSocket disconnect or webhook timeout | Reconnect/retry with backoff |
| `ValidationError` | Invalid event data (negative amounts, etc.) | Log error, skip event |

---

## Integration

### WebSocket Indexer

**Setup:**
```typescript
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
const programId = new PublicKey(PROGRAM_ID);

connection.onLogs(
  programId,
  async (logs) => {
    await processLogs(logs);
  },
  'confirmed'
);
```

**Subscription:**
- Subscribes to all logs for VeritasCuration program
- Commitment level: `confirmed` (balance of speed and finality)
- Processes logs in real-time as they arrive

**Reconnection:**
- On disconnect: Exponential backoff (1s, 2s, 4s, 8s, max 30s)
- On reconnect: Resume subscription (no backfill needed due to deduplication)

### Helius Webhook

**Endpoint:** `POST /api/webhooks/helius`

**Authentication:**
```typescript
const signature = req.headers['x-helius-signature'];
const expectedSig = hmac(HELIUS_SECRET, req.body);
if (signature !== expectedSig) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

**Payload:**
```typescript
interface HeliusWebhook {
  transaction: {
    signature: string;
    slot: number;
    blockTime: number;
    meta: {...};
    // ...
  };
  instructions: Instruction[];
  events: AnchorEvent[];
}
```

**Processing:**
1. Validate webhook signature (TODO: implement)
2. Extract transaction signature
3. Parse Anchor events from logs
4. Call event processor service
5. Return 200 OK (Helius will retry on non-200)

**Retry Behavior:**
- Helius retries failed webhooks (5xx, timeout)
- Idempotent processing ensures safety

### Database Schema

**Event Indexer Fields (Added to Multiple Tables):**
```sql
-- trades table
event_signature TEXT UNIQUE,
indexed_at TIMESTAMPTZ DEFAULT NOW(),
confirmed BOOLEAN DEFAULT true

-- settlements table
event_signature TEXT UNIQUE NOT NULL,
indexed_at TIMESTAMPTZ DEFAULT NOW(),
confirmed BOOLEAN DEFAULT true

-- custodian_deposits table
event_signature TEXT UNIQUE,
indexed_at TIMESTAMPTZ,
confirmed BOOLEAN

-- custodian_withdrawals table
event_signature TEXT UNIQUE,
indexed_at TIMESTAMPTZ,
confirmed BOOLEAN
```

---

## Testing

### Critical Paths
1. Trade event emitted → Correctly recorded in trades table with event_signature
2. Duplicate event (same tx+ix+event) → Skipped, no duplicate DB entry
3. Settlement event → Updates pool reserves and creates settlement record
4. WebSocket disconnect → Reconnects and continues processing
5. Helius webhook retry → Idempotent, no duplicate records

### Test Implementation
- **Test Spec:** `specs/test-specs/architecture/event-indexing.test.md`
- **Test Code:** `tests/services/event-processor.test.ts`, `tests/integration/indexer.test.ts`

### Validation
- Event count on chain matches DB row count (accounting for deduplication)
- Pool reserves in DB match on-chain ContentPool account state
- No duplicate event signatures in any table
- Indexer lag < 5 seconds under normal load
- Recovery after indexer downtime: no missed events

---

## References
- WebSocket Indexer: `src/services/websocket-indexer.service.ts`
- Helius Webhook: `app/api/webhooks/helius/route.ts`
- Event Processor: `src/services/event-processor.service.ts`
- Related: `specs/services/event-processor-service.md`
- Database: `specs/data-structures/03-trading-history-tables.md`

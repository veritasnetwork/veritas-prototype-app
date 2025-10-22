# Event Processor Service

## Overview
Centralized service for processing blockchain events from both WebSocket subscriptions (local/devnet) and Helius webhooks (mainnet). Implements idempotent deduplication between server-side optimistic recording and on-chain event indexing.

## Context
- **Layer:** Infrastructure / Services
- **Location:** `src/services/event-processor.service.ts`
- **Used By:** WebSocket indexer, Helius webhook handler, pool settlement processor
- **Dependencies:** @supabase/supabase-js, @solana/web3.js, fetch-pool-data
- **Status:** Implemented

---

## High-Level Design

### Flow
1. Event received from blockchain (WebSocket or webhook)
2. Parse event data based on event type
3. Check if event already processed (deduplication via tx_signature)
4. Compare server-recorded data with on-chain event data
5. Insert, update, or correct database record
6. Update related state (pool reserves, agent stakes, etc.)
7. Log processing result

### State Changes
- **trades:** Insert new trades or update server-recorded trades with on-chain confirmation
- **custodian_deposits:** Record direct deposits and trade skims
- **custodian_withdrawals:** Record withdrawals
- **agents:** Create agents as needed, update total_stake
- **pool_deployments:** Update pool state (reserves, token supply, last_synced_at)
- **bd_scores:** Record BD scores from settlement events

### Key Decisions
- **Idempotent processing:** Use tx_signature as unique key to prevent duplicates
- **Server vs Indexer:** Track who recorded each event (`recorded_by` field)
- **Validation on correction:** Compare server-recorded amounts with on-chain truth
- **Automatic agent creation:** Create agent records on-the-fly if not exists
- **Non-blocking pool sync:** Fire-and-forget pool state updates
- **Skim tracking:** Trade skims automatically recorded as custodian deposits

---

## Implementation

### Event Types

| Event | Source | Purpose |
|-------|--------|---------|
| `TradeEvent` | ContentPool program | Record trades (buy/sell LONG/SHORT) |
| `SettlementEvent` | ContentPool program | Record epoch settlements and BD scores |
| `MarketDeployedEvent` | ContentPool program | Record initial market deployment |
| `DepositEvent` | VeritasCustodian program | Record direct USDC deposits |
| `WithdrawEvent` | VeritasCustodian program | Record USDC withdrawals |
| `LiquidityAddedEvent` | ContentPool program | Record bilateral liquidity provisions |

### EventProcessor Class

**Constructor:**
```typescript
constructor()
```

**Flow:**
1. Read Supabase URL from environment (`NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`)
2. Read service role key from environment (`SUPABASE_SERVICE_ROLE_KEY`)
3. Validate credentials exist → throw if missing
4. Create Supabase client instance
5. Store as private member

**Error Handling:**
- Throws Error if credentials missing: "Missing Supabase credentials for EventProcessor"

---

## Event Handlers

### handleTradeEvent

**Signature:**
```typescript
async handleTradeEvent(
  event: TradeEventData,
  signature: string,
  blockTime?: number,
  slot?: number
): Promise<void>
```

**TradeEventData Interface:**
```typescript
interface TradeEventData {
  pool: PublicKey;
  trader: PublicKey;
  side: { long?: object } | { short?: object };
  tradeType: { buy?: object } | { sell?: object };
  usdcAmount: bigint;         // Total USDC
  usdcToTrade: bigint;        // After skim
  usdcToStake: bigint;        // Skim amount
  tokensOut: bigint;
  newPrice: bigint;           // Q64.64 fixed point
  tokenSupplyAfter: bigint;
  reserveAfter: bigint;
  timestamp: bigint;
}
```

**Flow:**

1. **Extract event data:**
   - Convert pool and trader PublicKeys to strings
   - Determine side: 'LONG' or 'SHORT' from `event.side`
   - Determine trade type: 'buy' or 'sell' from `event.tradeType`
   - Convert USDC amounts from lamports to decimals (÷ 1,000,000)
   - Convert token amounts from lamports to decimals (÷ 1,000,000)
   - Extract skim amount (`usdcToStake`)

2. **Check for existing record:**
   - Query `trades` table by `tx_signature`
   - If found → proceed to validation
   - If not found → proceed to indexer recording

3. **Path A: Server already recorded (existing record found):**

   a. **Validate server data:**
   - Compare `existing.usdc_amount` with `usdcToTrade` (allow 0.01 tolerance)
   - Compare `existing.token_amount` with `tokensAmount` (allow 0.01 tolerance)

   b. **If amounts match:**
   - Update `confirmed = true`
   - Update `confirmed_at = now()`
   - Update `block_time` and `slot` if provided
   - Log: "✅ Validated server record: {signature}"

   c. **If amounts DO NOT match:**
   - Log warning with mismatched values
   - Update record with on-chain truth:
     - `usdc_amount = usdcToTrade` (on-chain value)
     - `token_amount = tokensAmount` (on-chain value)
     - `server_amount = existing.usdc_amount` (preserve server's value)
     - `indexer_corrected = true`
     - `confirmed = true`
     - `confirmed_at = now()`
     - `block_time` and `slot`
   - Log: "🔧 Corrected server record with on-chain data: {signature}"

   d. **Record skim deposit:**
   - If `skimAmount > 0` → call `recordSkimDeposit()`

4. **Path B: Server didn't record (no existing record):**

   a. **Fetch pool deployment:**
   - Query `pool_deployments` by `pool_address`
   - Extract `post_id`, `f`, `beta_num`, `beta_den`
   - If pool not found → log error and return

   b. **Fetch user:**
   - Query `users` by `wallet_address`
   - Extract `user_id`
   - If user not found → log error and return

   c. **Fetch current pool state:**
   - Call `fetchPoolData(poolAddress)`
   - Extract sqrt prices and decimal prices
   - If fetch fails → log warning, continue with null prices

   d. **Insert trade record:**
   - `tx_signature`, `pool_address`, `post_id`, `user_id`, `wallet_address`
   - `trade_type`, `token_amount`, `usdc_amount`
   - `token_supply_after`, `reserve_after`
   - `sqrt_price_long_x96`, `sqrt_price_short_x96`, `price_long`, `price_short`
   - `f`, `beta_num`, `beta_den` (ICBS params at time of trade)
   - `recorded_by = 'indexer'`
   - `confirmed = true`, `confirmed_at = now()`
   - `block_time`, `slot`, `indexed_at = now()`
   - Log: "✅ Indexer recorded trade: {signature}"

   e. **Record skim deposit:**
   - If `skimAmount > 0` → call `recordSkimDeposit()`

5. **Update pool state:**
   - Update `pool_deployments`:
     - `token_supply = tokenSupplyAfter`
     - `reserve = reserveAfter`
     - `last_synced_at = now()`
   - Log: "📊 Updated pool state"

**Error Handling:**
- Database errors bubble up (no catch)
- Missing pool or user → log error and return (don't throw)
- Fetch pool data errors → log warning, continue with null prices

---

### recordSkimDeposit (private)

**Signature:**
```typescript
private async recordSkimDeposit(
  walletAddress: string,
  skimAmount: number,
  signature: string,
  blockTime: number | undefined,
  slot: number | undefined,
  timestamp: number
): Promise<void>
```

**Flow:**

1. **Check for duplicate:**
   - Query `custodian_deposits` by `tx_signature` and `deposit_type = 'trade_skim'`
   - If found → log and return (already recorded)

2. **Ensure agent exists:**
   - Query `agents` by `solana_address = walletAddress`
   - If not found:
     - Insert new agent with `solana_address` and `created_at = timestamp`
     - Get new `agent_id`
   - If found:
     - Get `agent_id`

3. **Insert skim deposit:**
   - `tx_signature`, `depositor_address = walletAddress`
   - `amount_usdc = skimAmount`
   - `deposit_type = 'trade_skim'`
   - `recorded_by = 'indexer'`
   - `confirmed = true`
   - `slot`, `block_time`, `indexed_at = now()`
   - `timestamp = new Date(timestamp * 1000)`
   - Throw if insert fails

4. **Update agent total_stake:**
   - Call RPC function: `add_agent_stake(p_agent_id, p_amount)`
   - This atomically increments agent's `total_stake`
   - Throw if RPC fails

5. **Log success:**
   - "💰 Recorded trade skim deposit: {amount} USDC from {wallet}, updated total_stake"

**Error Handling:**
- All database errors throw (caller must handle)
- Agent creation failure throws
- Stake update failure throws

---

### handleSettlementEvent

**Signature:**
```typescript
async handleSettlementEvent(
  event: SettlementEventData,
  signature: string,
  blockTime?: number,
  slot?: number
): Promise<void>
```

**SettlementEventData Interface:**
```typescript
interface SettlementEventData {
  pool: PublicKey;
  settler: PublicKey;
  bdScore: number;             // Q32.32 fixed point
  marketPredictionQ: bigint;
  fLong: bigint;
  fShort: bigint;
  rLongBefore: bigint;
  rShortBefore: bigint;
  rLongAfter: bigint;
  rShortAfter: bigint;
  timestamp: bigint;
}
```

**Flow:**

1. **Extract data:**
   - Convert `pool` to string
   - Convert `bdScore` from Q32.32 to decimal: `bdScore / 2^32`

2. **Store BD score:**
   - Upsert into `bd_scores` table:
     - `pool_address`, `score = bdScore`, `triggered_by = settler`
     - `tx_signature`, `block_time`, `slot`
   - Conflict resolution: on `tx_signature` (prevents duplicates)

3. **Log result:**
   - Success: "✅ Stored BD score {score} for pool {address}"
   - Error: Log error but don't throw (non-critical)

**Error Handling:**
- Database errors logged but not thrown (non-blocking)

---

### handleMarketDeployedEvent

**Signature:**
```typescript
async handleMarketDeployedEvent(
  event: MarketDeployedEventData,
  signature: string,
  blockTime?: number,
  slot?: number
): Promise<void>
```

**MarketDeployedEventData Interface:**
```typescript
interface MarketDeployedEventData {
  pool: PublicKey;
  deployer: PublicKey;
  initialDeposit: bigint;
  longAllocation: bigint;
  shortAllocation: bigint;
  initialQ: number;
  longTokens: bigint;
  shortTokens: bigint;
  timestamp: bigint;
}
```

**Flow:**

1. **Extract data:**
   - Convert `pool` to string
   - Calculate initial token supply: `longTokens + shortTokens`
   - Convert initial deposit to decimal

2. **Update pool deployment:**
   - Update `pool_deployments` by `pool_address`:
     - `token_supply = longTokens + shortTokens`
     - `reserve = initialDeposit`
     - `last_synced_at = now()`
     - `deployment_tx_signature = signature`
   - Log error if update fails (but don't throw)

3. **Log result:**
   - Success: "✅ Updated pool {address} with initial market state"
   - Error: Log error message

**Error Handling:**
- Database errors logged but not thrown (non-critical)

---

### handleDepositEvent

**Signature:**
```typescript
async handleDepositEvent(
  event: DepositEventData,
  txSignature: string,
  slot: number,
  blockTime: number | null
): Promise<void>
```

**DepositEventData Interface:**
```typescript
interface DepositEventData {
  depositor: PublicKey;
  amount: bigint;
  timestamp: bigint;
}
```

**Flow:**

1. **Extract data:**
   - Convert depositor to string
   - Convert amount from lamports to USDC (÷ 1,000,000)

2. **Ensure agent exists:**
   - Query `agents` by `solana_address`
   - If not found → create agent with `created_at = timestamp`
   - Get `agent_id`

3. **Check for existing record:**
   - Query `custodian_deposits` by `tx_signature`

4. **Path A: Record exists (server recorded):**
   - Update with blockchain data:
     - `confirmed = true`
     - `slot`, `block_time`, `indexed_at = now()`

5. **Path B: No record (indexer recording):**
   - Insert new deposit:
     - `tx_signature`, `depositor_address`, `amount_usdc`
     - `deposit_type = 'direct'`
     - `recorded_by = 'indexer'`
     - `confirmed = true`
     - `slot`, `block_time`, `indexed_at = now()`
     - `timestamp`
   - Call `add_agent_stake()` RPC to update agent's total_stake

6. **Log success:**
   - "✅ Recorded direct custodian deposit: {amount} USDC, updated total_stake"

**Error Handling:**
- All database errors throw
- Agent creation failure throws
- Stake update failure throws

---

### handleWithdrawEvent

**Signature:**
```typescript
async handleWithdrawEvent(
  event: WithdrawEventData,
  txSignature: string,
  slot: number,
  blockTime: number | null
): Promise<void>
```

**WithdrawEventData Interface:**
```typescript
interface WithdrawEventData {
  recipient: PublicKey;
  amount: bigint;
  authority: PublicKey;
  timestamp: bigint;
}
```

**Flow:**

1. **Extract data:**
   - Convert recipient and authority to strings
   - Convert amount from lamports to USDC (÷ 1,000,000)

2. **Ensure agent exists:**
   - Query `agents` by `solana_address = recipient`
   - If not found → create agent
   - Get `agent_id`

3. **Check for existing record:**
   - Query `custodian_withdrawals` by `tx_signature`

4. **Path A: Record exists:**
   - Update with blockchain data:
     - `confirmed = true`
     - `slot`, `block_time`, `indexed_at = now()`

5. **Path B: No record:**
   - Insert new withdrawal:
     - `tx_signature`, `recipient_address`, `authority_address`, `amount_usdc`
     - `recorded_by = 'indexer'`
     - `confirmed = true`
     - `slot`, `block_time`, `indexed_at = now()`
     - `timestamp`
   - Call `add_agent_stake(agent_id, -amount)` with **negative** amount to subtract

6. **Log success:**
   - "✅ Recorded custodian withdrawal: {amount} USDC, updated total_stake"

**Error Handling:**
- All database errors throw
- Agent creation failure throws
- Stake update failure throws (negative amount subtracts)

---

### handleLiquidityAddedEvent

**Signature:**
```typescript
async handleLiquidityAddedEvent(
  event: LiquidityAddedEventData,
  signature: string,
  blockTime?: number,
  slot?: number
): Promise<void>
```

**LiquidityAddedEventData Interface:**
```typescript
interface LiquidityAddedEventData {
  pool: PublicKey;
  user: PublicKey;
  usdcAmount: bigint;
  longTokensOut: bigint;
  shortTokensOut: bigint;
  newRLong: bigint;
  newRShort: bigint;
  newSLong: bigint;
  newSShort: bigint;
}
```

**Flow:**

1. **Extract data:**
   - Convert pool and user to strings
   - Convert amounts from lamports to decimals

2. **Fetch pool and user:**
   - Query `pool_deployments` for `post_id`
   - Query `users` for `user_id`
   - If either not found → log error and return

3. **Check for duplicate:**
   - Query `trades` by `tx_signature`
   - If found → log and return (already recorded)

4. **Create TWO position records:**

   a. **Long position:**
   - `tx_signature` (as-is)
   - `trade_type = 'liquidity_provision'`
   - `side = 'LONG'`
   - `token_amount = longTokens`
   - `usdc_amount = (totalUsdc * longTokens) / (longTokens + shortTokens)`
   - `recorded_by = 'indexer'`
   - `confirmed = true`
   - No `belief_id` (not a predictive trade)

   b. **Short position:**
   - `tx_signature = '{signature}-short'` (append "-short" for uniqueness)
   - `trade_type = 'liquidity_provision'`
   - `side = 'SHORT'`
   - `token_amount = shortTokens`
   - `usdc_amount = (totalUsdc * shortTokens) / (longTokens + shortTokens)`
   - `recorded_by = 'indexer'`
   - `confirmed = true`
   - No `belief_id`

5. **Update pool state:**
   - Update `pool_deployments`:
     - `token_supply = newSLong + newSShort`
     - `reserve = newRLong + newRShort`
     - `last_synced_at = now()`

6. **Log success:**
   - "✅ Recorded bilateral liquidity provision: {longTokens} LONG + {shortTokens} SHORT"
   - "📊 Updated pool state: supply={total}, reserve={total}"

**Error Handling:**
- Database errors throw
- Missing pool/user → log error and return (don't throw)

---

## Database Schema Integration

### Tables Modified

| Table | Operation | Columns Updated |
|-------|-----------|----------------|
| `trades` | INSERT/UPDATE | All trade columns, `confirmed`, `confirmed_at`, `indexed_at` |
| `custodian_deposits` | INSERT/UPDATE | All deposit columns, `confirmed`, `indexed_at` |
| `custodian_withdrawals` | INSERT/UPDATE | All withdrawal columns, `confirmed`, `indexed_at` |
| `agents` | INSERT/UPDATE | `solana_address`, `total_stake` (via RPC) |
| `pool_deployments` | UPDATE | `token_supply`, `reserve`, `last_synced_at` |
| `bd_scores` | UPSERT | All columns |

### RPC Functions Used

| Function | Purpose | Parameters |
|----------|---------|------------|
| `add_agent_stake` | Atomically update agent total_stake | `p_agent_id: uuid`, `p_amount: numeric` |

---

## Idempotency & Deduplication

### Strategy

**Primary Key:** `tx_signature` (unique blockchain transaction signature)

**Conflict Resolution:**
1. **Server recorded first:**
   - Indexer validates server data
   - If match → mark confirmed
   - If mismatch → overwrite with on-chain truth
2. **Indexer recorded first:**
   - Insert with `recorded_by = 'indexer'`
   - Server won't try to record again (already exists)

**Tracking Fields:**
- `recorded_by`: 'server' | 'indexer' (who created the record)
- `confirmed`: true when on-chain event confirms
- `confirmed_at`: timestamp of on-chain confirmation
- `indexed_at`: timestamp of indexer processing
- `server_amount`: original server amount (preserved if corrected)
- `indexer_corrected`: flag if indexer overwrote server data

### Race Conditions

**Scenario:** Server and indexer both try to record same transaction

**Handling:**
1. Database constraint on `tx_signature` prevents duplicates
2. Second insert fails with unique violation
3. Code checks for existing record before insert
4. Update path used instead of insert

**Result:** One record always wins, the other validates or corrects it

---

## Error Handling

### Critical Errors (Throw)
- Missing Supabase credentials
- Agent creation failure
- Stake update failure (RPC)
- Deposit/withdrawal insert failure

### Non-Critical Errors (Log & Continue)
- BD score storage failure
- Market deployed update failure
- Pool state fetch failure (use null prices)
- Missing pool/user for trade (skip that trade)

### Error Messages

| Error | Message | Action |
|-------|---------|--------|
| Missing credentials | "Missing Supabase credentials for EventProcessor" | Throw on construction |
| Pool not found | "❌ Pool not found for address: {address}" | Log and return |
| User not found | "❌ User not found for wallet: {address}" | Log and return |
| Agent creation failed | "Failed to create agent: {error}" | Log and throw |
| Stake update failed | "Failed to update agent stake: {error}" | Log and throw |
| Pool fetch failed | "⚠️ Could not fetch sqrt prices for pool {address}" | Log warning, continue |

---

## Monitoring & Logging

### Log Levels

**Info (console.log):**
- "📥 Processing trade event: {signature}"
- "✅ Validated server record: {signature}"
- "✅ Indexer recorded trade: {signature}"
- "💰 Recorded trade skim deposit: {amount} USDC"
- "📊 Updated pool state"

**Warning (console.warn):**
- "⚠️ Server data mismatch for {signature}"
- "⚠️ Could not fetch sqrt prices"

**Error (console.error):**
- "❌ Pool not found for address: {address}"
- "❌ User not found for wallet: {address}"
- "Failed to create agent: {error}"
- "Failed to update agent stake: {error}"

### Metrics to Track

- **Events processed:** Count per event type
- **Server corrections:** Count of `indexer_corrected = true`
- **Indexer-first recordings:** Count of `recorded_by = 'indexer'`
- **Skim deposits:** Total USDC skimmed
- **Processing latency:** Time from event emission to DB write

---

## Edge Cases

| Condition | Handling |
|-----------|----------|
| Trade for non-existent pool | Log error, skip processing |
| Trade for non-existent user | Log error, skip processing |
| Skim deposit duplicate | Check by tx_signature + deposit_type, skip if exists |
| Agent doesn't exist | Auto-create agent on-the-fly |
| Negative skim amount | Should never happen, but would insert negative deposit |
| Withdrawal exceeds balance | Database constraint prevents, throws error |
| Liquidity provision signature collision | Append "-short" to Short side signature |
| Settlement with invalid BD score | Store as-is, validation happens in protocol layer |

---

## Testing

### Critical Paths

1. **Trade Event - Server recorded first:**
   - Server inserts optimistic trade
   - Indexer validates and confirms
   - Result: `confirmed = true`, `recorded_by = 'server'`

2. **Trade Event - Server data wrong:**
   - Server inserts with incorrect amount
   - Indexer detects mismatch
   - Result: Overwrite with on-chain truth, `indexer_corrected = true`

3. **Trade Event - Indexer first:**
   - Server never recorded (or failed)
   - Indexer inserts complete record
   - Result: `recorded_by = 'indexer'`, `confirmed = true`

4. **Skim Deposit:**
   - Trade has `usdcToStake > 0`
   - Skim recorded as custodian deposit
   - Agent total_stake incremented

5. **Liquidity Provision:**
   - Create two positions (Long + Short)
   - No belief_id
   - Update pool state correctly

6. **Settlement Event:**
   - BD score stored
   - Pool state updated via separate pool sync

7. **Agent Creation:**
   - First event for new wallet
   - Agent created automatically
   - total_stake initialized to 0

### Test Implementation
- **Test Spec:** `specs/test-specs/services/event-processor.test.md`
- **Test Code:** `tests/services/event-processor.test.ts`

### Validation
- Unit tests with mock Supabase client
- Integration tests with test database
- Idempotency: Process same event twice, verify single record
- Correction: Mock server record with wrong amount, verify correction
- Skim tracking: Verify deposit and stake update

---

## Performance Considerations

### Optimization Strategies

**Batch processing:**
- Process multiple events in parallel when possible
- Use Promise.all() for independent operations

**Database efficiency:**
- Single query to check existing record
- Single insert/update per event
- RPC function for atomic stake updates

**Non-blocking:**
- Pool state fetch non-critical (use null if fails)
- BD score storage non-critical (log error, don't throw)

**Caching:**
- No caching (events are one-time, idempotent)

### Scalability

**Current capacity:** ~100 events/second per instance

**Bottlenecks:**
- Database writes (especially stake updates)
- Pool data fetches (RPC calls)

**Scaling strategy:**
- Horizontal scaling (multiple processor instances)
- Database connection pooling
- Consider queue (SQS, Redis) for very high throughput

---

## References
- Code: `src/services/event-processor.service.ts`
- Used by: `src/services/websocket-indexer.service.ts`
- Related: `specs/services/pool-sync.md`, `specs/architecture/event-indexing.md`
- Smart contracts: `specs/solana-specs/smart-contracts/ContentPool.md`, `specs/solana-specs/smart-contracts/VeritasCustodian.md`

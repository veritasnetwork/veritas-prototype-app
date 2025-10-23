# Trading Flow Architecture

## Overview
End-to-end flow for executing trades using prepare-sign-record pattern. Backend calculates stake skim and builds partially-signed transaction, user adds signature, transaction sent to chain, trade recorded in database.

## Context
- **Layer:** App + Solana
- **Dependencies:** calculate-skim, load-authority, ContentPool contract, event indexer
- **Used By:** UnifiedSwapComponent, trading UI
- **Status:** Implemented

---

## High-Level Design

### Flow
1. User enters trade params in UI (buy/sell, LONG/SHORT, amount)
2. Frontend calls POST /api/trades/prepare
3. Backend calculates stake skim (if buy trade)
4. Backend builds transaction with trade + skim instructions
5. Backend signs with protocol authority (for stake skim)
6. Backend returns partially-signed transaction + metadata
7. Frontend deserializes transaction
8. User signs transaction with wallet
9. Frontend sends signed transaction to Solana
10. Frontend calls POST /api/trades/record with tx signature
11. Backend records trade in database
12. Event indexer confirms and updates balances

### State Changes
- **On prepare:** None (read-only)
- **On transaction confirm:** Pool reserves and supplies change on-chain
- **On record:** trades table INSERT, pool_deployments UPDATE
- **On event index:** Confirmed state, balance updates

### Key Decisions
- **Prepare-sign-record pattern:** Separation allows backend signing while maintaining user control
- **Backend authority signing:** Required for stake skim (protocol owns custodian authority)
- **Optimistic UI:** Can show pending state before confirmation
- **Event indexer for truth:** Database eventually consistent with chain via events

---

## Implementation

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trades/prepare` | POST | Build partially-signed transaction |
| `/api/trades/record` | POST | Record trade in database |

### Data Flow

```
User UI
    ↓
POST /api/trades/prepare
    ↓
Calculate Stake Skim
    ↓
Build Transaction:
  [If skim > 0] Ix 0: VeritasCustodian::deposit(skim)
  Ix 1 (or 0): ContentPool::trade(side, direction, amount)
    ↓
Sign with Protocol Authority (for skim instruction)
    ↓
Return: { transaction: base64, metadata: {...} }
    ↓
Frontend: Deserialize transaction
    ↓
User: Sign with wallet
    ↓
Send to Solana RPC
    ↓
Wait for confirmation
    ↓
POST /api/trades/record { tx_signature, ... }
    ↓
Database: INSERT INTO trades (...)
    ↓
[Background] Event Indexer:
  Parse logs → Extract Trade event → UPDATE pool state
```

---

## API Specifications

### POST /api/trades/prepare

**Request:**
```typescript
{
  pool_address: string,
  side: 'long' | 'short',
  direction: 'buy' | 'sell',
  amount_usdc_lamports: number,  // For buy trades
  amount_tokens: number,          // For sell trades
  slippage_bps: number            // e.g., 100 = 1%
}
```

**Response:**
```typescript
{
  transaction: string,              // base64 encoded partially-signed tx
  stake_skim_lamports: number,      // Amount skimmed for stake
  expected_tokens: number,          // Estimated tokens out (buy) or USDC out (sell)
  price_impact: number,             // Percentage price impact
  metadata: {
    pool_address: string,
    trade_type: string,             // "buy_long", "sell_short", etc.
    user_address: string,
    timestamp: number
  }
}
```

**Flow:**
1. Authenticate user (Privy JWT)
2. Fetch pool data from chain
3. Calculate stake skim (for buys)
4. Build ContentPool::trade instruction
5. If skim > 0: Build VeritasCustodian::deposit instruction
6. Create transaction with instructions
7. Sign with protocol authority
8. Serialize to base64
9. Calculate expected output using ICBS pricing
10. Return response

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid params | `{error: "Invalid trade parameters"}` |
| 401 | No auth | `{error: "Unauthorized"}` |
| 404 | Pool not found | `{error: "Pool not found"}` |
| 500 | Transaction build failed | `{error: "Failed to build transaction"}` |

### POST /api/trades/record

**Request:**
```typescript
{
  tx_signature: string,
  pool_address: string,
  trade_type: 'buy' | 'sell',
  side: 'long' | 'short',
  amount_usdc: number,
  amount_tokens: number
}
```

**Response:**
```typescript
{
  trade_id: string,
  status: 'pending' | 'confirmed',
  timestamp: string
}
```

**Flow:**
1. Authenticate user
2. Validate tx_signature format
3. INSERT INTO trades table
4. Return trade_id
5. Event indexer will later confirm and update

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid signature | `{error: "Invalid transaction signature"}` |
| 401 | No auth | `{error: "Unauthorized"}` |
| 409 | Duplicate tx | `{error: "Trade already recorded"}` |
| 500 | Database error | `{error: "Failed to record trade"}` |

---

## Transaction Structure

### Buy Trade (with stake skim)

```typescript
Transaction {
  recentBlockhash: string,
  feePayer: user.publicKey,
  instructions: [
    // Instruction 0: Stake skim (if needed)
    {
      programId: VeritasCustodian,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: custodianVault, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        // ...
      ],
      data: [deposit, skim_amount]
    },
    // Instruction 1: Trade
    {
      programId: VeritasCuration,
      keys: [
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: usdcVault, isSigner: false, isWritable: true },
        { pubkey: longMint, isSigner: false, isWritable: true },
        { pubkey: shortMint, isSigner: false, isWritable: true },
        // ...
      ],
      data: [trade, side, direction, amount, min_output]
    }
  ],
  signatures: [
    authority_signature,  // Added by backend
    null                  // User signature placeholder
  ]
}
```

### Sell Trade (no skim)

```typescript
Transaction {
  instructions: [
    // Only trade instruction (no skim)
    { programId: VeritasCuration, ... }
  ],
  signatures: [
    null  // User signature only
  ]
}
```

---

## Implementation Details

### Stake Skim Calculation

**Located in:** `src/lib/stake/calculate-skim.ts`

**Process:**
1. Query agents.total_stake for user
2. required_stake = trade_amount × 0.10
3. skim = max(0, required_stake - current_stake)
4. Return skim

**Reference:** `specs/architecture/stake-system.md`

### Authority Signing

**Located in:** `src/lib/solana/load-authority.ts`

**Process:**
1. Load protocol authority keypair from file
2. Add authority as signer to skim instruction
3. Sign transaction with authority
4. Return partially-signed transaction

**Security:** Authority key only used server-side, never exposed to client

**Reference:** `specs/security/authority-signing.md`

### ICBS Pricing

**Located in:** `src/lib/solana/icbs-pricing.ts`

**Used for:**
- Estimate tokens received for USDC (buy)
- Estimate USDC received for tokens (sell)
- Calculate price impact
- Display expected output to user

**Reference:** `specs/libraries/icbs-pricing.md`

---

## Edge Cases

| Condition | Handling |
|-----------|----------|
| User has sufficient stake | No skim instruction, single trade instruction |
| User cancels transaction | No on-chain state change, no database record |
| Transaction fails on-chain | Database record shows pending, no event indexed |
| User submits wrong tx_signature | Database record exists but won't be confirmed |
| Slippage exceeded | On-chain trade reverts, user notified |
| Concurrent trades on same pool | On-chain atomic execution ensures consistency |
| Event indexer lag | Database temporarily inconsistent, eventually syncs |
| Pool state changes between prepare and execute | Slippage protection prevents excessive loss |

---

## Error Handling

### Prepare Endpoint

**Invalid pool_address:**
- Fetch from chain fails
- Return 404 Pool not found

**Insufficient balance for skim:**
- Not detected in prepare (read-only)
- Transaction fails on-chain
- User sees error from wallet

**Transaction build failure:**
- Log error with details
- Return 500 Internal error
- Alert monitoring

### Record Endpoint

**Duplicate transaction:**
- ON CONFLICT (tx_signature) DO NOTHING
- Return existing trade_id
- 409 Conflict status

**Invalid signature format:**
- Validate base58 encoding
- Return 400 Bad request

### On-Chain Execution

**Slippage exceeded:**
- ContentPool::trade reverts
- User sees transaction failed
- No database record (user won't call /record)

**Insufficient balance:**
- Transaction fails before execution
- Wallet shows insufficient funds error

**Wrong signer:**
- Transaction signature verification fails
- Transaction rejected by RPC

---

## Testing

### Critical Paths
1. Buy with skim → Prepare builds 2-instruction tx, user signs, executes, records
2. Buy without skim → Prepare builds 1-instruction tx
3. Sell trade → No skim, single instruction
4. Slippage protection → Trade reverts if min_output not met
5. Event indexer → Confirms trade and updates pool state
6. Concurrent trades → No race conditions, atomic execution

### Test Implementation
- **Test Spec:** `specs/test-specs/architecture/trading-flow.test.md`
- **Test Code:** `tests/api/trades.test.ts`, `tests/integration/trade-flow.test.ts`

### Validation
- Prepare endpoint returns valid transaction
- Transaction signatures verify correctly
- On-chain execution succeeds
- Database record created
- Event indexer confirms
- Pool balances match chain state

---

## References
- Prepare API: `app/api/trades/prepare/route.ts`
- Record API: `app/api/trades/record/route.ts`
- Stake Skim: `src/lib/stake/calculate-skim.ts`
- Authority: `src/lib/solana/load-authority.ts`
- ICBS Pricing: `src/lib/solana/icbs-pricing.ts`
- Swap Component: `src/components/post/PostDetailPanel/UnifiedSwapComponent.tsx`
- Related: `specs/architecture/stake-system.md`, `specs/security/authority-signing.md`

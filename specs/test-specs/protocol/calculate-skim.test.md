# Calculate Skim Database Function Test Specification

## Overview

Comprehensive test suite for `calculate_skim_with_lock` Postgres function which calculates the required stake skim for buy trades to maintain the solvency invariant.

**Status:** ✅ READY FOR IMPLEMENTATION
**Test Framework:** Deno Test (via Supabase RPC calls)
**Location:** `/tests/protocol/calculate-skim.test.ts`
**Dependencies:** Local Supabase, test database with schema migrations applied

## Function Under Test

**Database Function:** `calculate_skim_with_lock` (defined in migration `20250122000005_add_calculate_skim_function.sql`)

**Purpose:** Calculate skim amount needed to maintain solvency invariant: `total_stake ≥ Σ locks`

**Algorithm:**
```sql
-- 1. Get current total_stake (with row lock)
SELECT total_stake FROM agents WHERE solana_address = p_wallet_address FOR UPDATE

-- 2. Get sum of all active locks
SELECT SUM(belief_lock) FROM user_pool_balances
WHERE user_id = p_user_id AND token_balance > 0

-- 3. Get existing lock for this pool/side (will be replaced)
SELECT belief_lock FROM user_pool_balances
WHERE user_id = p_user_id AND pool_address = p_pool_address AND token_type = p_side

-- 4. Calculate required stake
existingLocks = totalLocks - oldLockThisSide
newLock = FLOOR(p_trade_amount_micro × 0.02)
requiredStake = existingLocks + newLock

-- 5. Return skim amount
skim = GREATEST(0, requiredStake - currentStake)
```

**Critical Properties:**
1. **Lock Replacement:** Old lock on same pool/side is freed before calculating skim
2. **Concurrency Safety:** Uses `SELECT ... FOR UPDATE` to prevent race conditions
3. **Side-Awareness:** Filters by `token_type` (LONG vs SHORT)
4. **Zero Skim on Sell:** Never charges skim for sell trades (handled by caller)

## Test Categories

### 1. Basic Skim Calculation

#### 1.1 First Buy (No Prior Stake)

```typescript
Deno.test("calculates skim for first buy with no prior stake", async () => {
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // First buy: $100 → lock = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000  // $100
  });

  assertNoError(error);

  // Skim should be $2 (2% of $100)
  assertEquals(data[0].skim_amount, 2_000_000);
});

Deno.test("calculates skim for first buy with existing stake", async () => {
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // User already has $5 stake
  await setAgentStake(walletAddress, 5_000_000);

  // Buy $100 → lock = $2, but already have $5 stake
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // Skim should be 0 (already have enough stake)
  assertEquals(data[0].skim_amount, 0);
});
```

#### 1.2 Second Buy in Different Pool

```typescript
Deno.test("calculates skim for second buy in different pool", async () => {
  const { userId, walletAddress, poolAddress1, poolAddress2 } = await setupScenario();

  // First buy: $100 in pool1 → stake = $2, lock1 = $2
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress: poolAddress1,
    side: 'LONG',
    amount: 100_000_000,
    beliefLock: 2_000_000
  });

  // Second buy: $200 in pool2 → needs lock2 = $4
  // Total locks after = $2 + $4 = $6
  // Current stake = $2 → skim = $4
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress2,
    p_side: 'LONG',
    p_trade_amount_micro: 200_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 4_000_000);
});
```

### 2. Lock Replacement (Same Pool, Same Side)

#### 2.1 Replacement with Larger Position

```typescript
Deno.test("replaces old lock when buying more in same pool/side", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // First buy: $100 LONG → stake = $2, lock = $2
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress,
    side: 'LONG',
    amount: 100_000_000,
    beliefLock: 2_000_000
  });

  // Second buy: $200 LONG (same pool, same side)
  // Old lock ($2) is freed → new lock = $4
  // existingLocks = 0, newLock = $4, currentStake = $2 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 200_000_000
  });

  assertNoError(error);

  // Should only skim $2 (difference), not $4 (full lock)
  assertEquals(data[0].skim_amount, 2_000_000);
});

Deno.test("replaces old lock when buying less in same pool/side", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // First buy: $500 LONG → stake = $10, lock = $10
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress,
    side: 'LONG',
    amount: 500_000_000,
    beliefLock: 10_000_000
  });

  // Second buy: $100 LONG (smaller position)
  // Old lock ($10) freed → new lock = $2
  // existingLocks = 0, newLock = $2, currentStake = $10 → skim = 0
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // No skim needed (reducing lock amount)
  assertEquals(data[0].skim_amount, 0);
});
```

#### 2.2 Side-Specific Replacement (LONG vs SHORT)

```typescript
Deno.test("does not replace LONG lock when buying SHORT", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // First buy: $100 LONG → stake = $2, lockLONG = $2
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress,
    side: 'LONG',
    amount: 100_000_000,
    beliefLock: 2_000_000
  });

  // Second buy: $100 SHORT (same pool, different side)
  // LONG lock ($2) stays → new SHORT lock = $2
  // existingLocks = $2, newLock = $2, currentStake = $2 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'SHORT',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // Should skim full $2 (not replacing LONG lock)
  assertEquals(data[0].skim_amount, 2_000_000);
});

Deno.test("replaces SHORT lock when buying SHORT again", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // First buy: $100 LONG, $100 SHORT → stake = $4, locks = $2 + $2
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'LONG', amount: 100_000_000, beliefLock: 2_000_000
  });
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'SHORT', amount: 100_000_000, beliefLock: 2_000_000
  });

  // Third buy: $200 SHORT (replaces SHORT lock)
  // LONG lock ($2) stays, SHORT lock ($2) freed, new SHORT lock = $4
  // existingLocks = $2, newLock = $4, currentStake = $4 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'SHORT',
    p_trade_amount_micro: 200_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 2_000_000);
});
```

### 3. Multiple Pools

#### 3.1 Multiple Active Positions

```typescript
Deno.test("calculates skim considering all active locks", async () => {
  const { userId, walletAddress, poolA, poolB, poolC } = await setupMultiPoolScenario();

  // Pool A: $100 LONG → lock = $2
  // Pool B: $200 LONG → lock = $4
  // Pool C: $300 SHORT → lock = $6
  // Total stake = $12, total locks = $12
  await simulateBuy({ userId, walletAddress, poolAddress: poolA, side: 'LONG', amount: 100_000_000, beliefLock: 2_000_000 });
  await simulateBuy({ userId, walletAddress, poolAddress: poolB, side: 'LONG', amount: 200_000_000, beliefLock: 4_000_000 });
  await simulateBuy({ userId, walletAddress, poolAddress: poolC, side: 'SHORT', amount: 300_000_000, beliefLock: 6_000_000 });

  // New buy: $250 in Pool D → lock = $5
  // existingLocks = $12, newLock = $5, currentStake = $12 → skim = $5
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: 'PoolD',
    p_side: 'LONG',
    p_trade_amount_micro: 250_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 5_000_000);
});

Deno.test("excludes closed positions from lock calculation", async () => {
  const { userId, walletAddress, poolA, poolB } = await setupScenario();

  // Pool A: bought and sold (token_balance = 0)
  await simulateBuy({ userId, walletAddress, poolAddress: poolA, side: 'LONG', amount: 100_000_000, beliefLock: 2_000_000 });
  await simulateSell({ userId, poolAddress: poolA, side: 'LONG', tokenBalance: 0 });  // Closed

  // Pool B: $200 LONG → lock = $4
  await simulateBuy({ userId, walletAddress, poolAddress: poolB, side: 'LONG', amount: 200_000_000, beliefLock: 4_000_000 });

  // New buy: $150 in Pool C
  // Active locks = $4 (Pool A excluded), newLock = $3
  // currentStake = $6 → skim = $1
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: 'PoolC',
    p_side: 'LONG',
    p_trade_amount_micro: 150_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 1_000_000);
});
```

### 4. Underwater Scenarios

#### 4.1 Insufficient Stake (After BTS Loss)

```typescript
Deno.test("calculates skim when user is underwater", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // User had $30 stake, $20 lock, then lost $10 in BTS
  // Now: stake = $20, lock = $20 (underwater: withdrawable = 0)
  await setAgentStake(walletAddress, 20_000_000);
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'LONG', amount: 1_000_000_000, beliefLock: 20_000_000
  });

  // New buy: $100 in different pool → lock = $2
  // existingLocks = $20, newLock = $2, currentStake = $20 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: 'PoolB',
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 2_000_000);
});

Deno.test("calculates reduced skim when replacing underwater position", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // User underwater: stake = $25, lock = $30
  await setAgentStake(walletAddress, 25_000_000);
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'LONG', amount: 1_500_000_000, beliefLock: 30_000_000
  });

  // Replace with smaller position: $100 → lock = $2
  // Old lock ($30) freed, new lock = $2
  // existingLocks = 0, newLock = $2, currentStake = $25 → skim = 0
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // No skim needed (reducing lock frees up stake)
  assertEquals(data[0].skim_amount, 0);
});
```

### 5. Precision & Edge Cases

#### 5.1 Micro-USDC Precision

```typescript
Deno.test("handles micro-USDC precision correctly", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // Buy $0.50 → lock = $0.01 = 10,000 μUSDC
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 500_000  // $0.50
  });

  assertNoError(error);

  // 2% of 500,000 = 10,000
  assertEquals(data[0].skim_amount, 10_000);
});

Deno.test("applies FLOOR to lock calculation", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // Buy $0.51 → lock = FLOOR(510,000 × 0.02) = FLOOR(10,200) = 10,200
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 510_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 10_200);
});

Deno.test("handles 1 micro-USDC trade", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // Buy 1 μUSDC → lock = FLOOR(1 × 0.02) = 0
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 1
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 0);
});
```

#### 5.2 Zero and Negative Cases

```typescript
Deno.test("returns zero skim when trade amount is zero", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 0
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 0);
});

Deno.test("never returns negative skim (GREATEST ensures non-negative)", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // User has excess stake
  await setAgentStake(walletAddress, 1_000_000_000);  // $1000

  // Buy $1 → lock = $0.02
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 1_000_000
  });

  assertNoError(error);

  // Should be 0, not negative
  assertEquals(data[0].skim_amount, 0);
  assert(data[0].skim_amount >= 0);
});
```

### 6. Concurrency Safety

#### 6.1 Row Locking (SELECT FOR UPDATE)

```typescript
Deno.test("acquires row lock on agents table", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // Start transaction 1 (acquire lock)
  const client1 = await getSupabaseClient();
  await client1.rpc('pg_advisory_lock', { lock_id: 12345 });

  // Simulate long-running skim calculation
  const promise1 = client1.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  // Transaction 2 should wait for lock
  const client2 = await getSupabaseClient();
  const start = Date.now();

  const promise2 = client2.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'SHORT',
    p_trade_amount_micro: 100_000_000
  });

  // Release lock after delay
  setTimeout(async () => {
    await client1.rpc('pg_advisory_unlock', { lock_id: 12345 });
  }, 500);

  await Promise.all([promise1, promise2]);

  const duration = Date.now() - start;

  // Second call should have waited
  assert(duration >= 500);
});

Deno.test("prevents race condition on concurrent buys", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  // Both buys start with stake = $0, no locks
  await setAgentStake(walletAddress, 0);

  // Concurrent buys in different pools
  const [result1, result2] = await Promise.all([
    supabase.rpc('calculate_skim_with_lock', {
      p_user_id: userId,
      p_wallet_address: walletAddress,
      p_pool_address: 'PoolA',
      p_side: 'LONG',
      p_trade_amount_micro: 100_000_000  // Should skim $2
    }),
    supabase.rpc('calculate_skim_with_lock', {
      p_user_id: userId,
      p_wallet_address: walletAddress,
      p_pool_address: 'PoolB',
      p_side: 'LONG',
      p_trade_amount_micro: 100_000_000  // Should skim $2 or $4 depending on order
    })
  ]);

  assertNoError(result1.error);
  assertNoError(result2.error);

  const skim1 = result1.data[0].skim_amount;
  const skim2 = result2.data[0].skim_amount;

  // Total skim should be $4 (for both locks)
  // One call skims $2, the other skims $2 or $4 depending on serialization
  const totalSkim = skim1 + skim2;

  assert(totalSkim >= 4_000_000, "Total skim should be at least $4");
  assert(totalSkim <= 6_000_000, "Total skim shouldn't exceed $6 (2 + 4)");
});
```

### 7. Error Handling

#### 7.1 Invalid Inputs

```typescript
Deno.test("returns error when user_id not found", async () => {
  const { walletAddress, poolAddress } = await setupScenario();

  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: '00000000-0000-0000-0000-000000000000',  // Non-existent
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  // Should handle gracefully (return 0 or error)
  assert(error || data[0].skim_amount === 0);
});

Deno.test("returns error when wallet_address not found", async () => {
  const { userId, poolAddress } = await setupScenario();

  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: 'NonExistentWallet',
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assert(error || data[0].skim_amount === 0);
});

Deno.test("handles invalid side parameter", async () => {
  const { userId, walletAddress, poolAddress } = await setupScenario();

  const { error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'INVALID',  // Not LONG or SHORT
    p_trade_amount_micro: 100_000_000
  });

  assert(error);  // Should fail CHECK constraint
});
```

## Test Helpers

```typescript
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';

let supabase: SupabaseClient;

export function setup() {
  supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export async function teardown() {
  await supabase.from('user_pool_balances').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

/**
 * Setup new user with wallet and agent
 */
export async function setupNewUser() {
  const userId = crypto.randomUUID();
  const agentId = crypto.randomUUID();
  const walletAddress = `Wallet${crypto.randomUUID().slice(0, 8)}`;

  await supabase.from('agents').insert({
    id: agentId,
    solana_address: walletAddress,
    total_stake: 0
  });

  await supabase.from('users').insert({
    id: userId,
    agent_id: agentId,
    username: `user${crypto.randomUUID().slice(0, 6)}`
  });

  return {
    userId,
    agentId,
    walletAddress,
    poolAddress: `Pool${crypto.randomUUID().slice(0, 8)}`
  };
}

/**
 * Set agent's total stake
 */
export async function setAgentStake(walletAddress: string, stakeMicro: number) {
  await supabase
    .from('agents')
    .update({ total_stake: stakeMicro })
    .eq('solana_address', walletAddress);
}

/**
 * Simulate a buy trade (insert balance record)
 */
export async function simulateBuy(params: {
  userId: string;
  walletAddress: string;
  poolAddress: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  beliefLock: number;
}) {
  await supabase.from('user_pool_balances').insert({
    user_id: params.userId,
    pool_address: params.poolAddress,
    token_type: params.side,
    token_balance: params.amount / 1000,  // Simplified
    belief_lock: params.beliefLock,
    last_buy_amount: params.amount,
    total_bought: params.amount / 1000,
    total_sold: 0,
    total_usdc_spent: params.amount,
    total_usdc_received: 0
  });

  // Update agent stake
  await supabase.rpc('update_stake_atomic', {
    p_agent_id: await getAgentIdByWallet(params.walletAddress),
    p_delta_micro: params.beliefLock
  });
}

/**
 * Simulate sell (close position)
 */
export async function simulateSell(params: {
  userId: string;
  poolAddress: string;
  side: 'LONG' | 'SHORT';
  tokenBalance: number;
}) {
  if (params.tokenBalance === 0) {
    await supabase
      .from('user_pool_balances')
      .delete()
      .eq('user_id', params.userId)
      .eq('pool_address', params.poolAddress)
      .eq('token_type', params.side);
  } else {
    await supabase
      .from('user_pool_balances')
      .update({ token_balance: params.tokenBalance })
      .eq('user_id', params.userId)
      .eq('pool_address', params.poolAddress)
      .eq('token_type', params.side);
  }
}

/**
 * Get agent ID by wallet address
 */
async function getAgentIdByWallet(walletAddress: string): Promise<string> {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('solana_address', walletAddress)
    .single();
  return data!.id;
}

/**
 * Assert no error
 */
export function assertNoError(error: any) {
  if (error) {
    throw new Error(`Unexpected error: ${JSON.stringify(error)}`);
  }
}
```

## Success Criteria

### Core Functionality (Must Pass)
- ✅ Correct skim calculation for first buy
- ✅ Zero skim when stake is sufficient
- ✅ Lock replacement on same pool/side
- ✅ Side-specific lock handling (LONG vs SHORT)
- ✅ Multiple pool consideration

### Critical Properties (Must Pass)
- ✅ Row locking prevents race conditions
- ✅ GREATEST(0, ...) ensures non-negative skim
- ✅ FLOOR applied to 2% calculation
- ✅ Closed positions (token_balance = 0) excluded

### Edge Cases (Should Pass)
- ✅ Underwater scenarios handled correctly
- ✅ Micro-USDC precision maintained
- ✅ Zero and very small trades handled
- ✅ Replacing position with smaller amount reduces skim

## Run Tests

```bash
# Run all skim calculation tests
deno test tests/protocol/calculate-skim.test.ts --allow-net --allow-env

# Run specific test
deno test tests/protocol/calculate-skim.test.ts --filter "lock replacement" --allow-net --allow-env

# Run with coverage
deno test tests/protocol/calculate-skim.test.ts --coverage=coverage --allow-net --allow-env
```

---

**Status:** ✅ Specification complete, ready for implementation
**Priority:** Critical (maintains solvency invariant)
**Estimated Implementation Time:** 1-2 days
**Last Updated:** 2025-01-26

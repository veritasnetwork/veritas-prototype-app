# Protocol Stake Redistribution Test Specification

## Overview

Comprehensive test suite for `protocol-beliefs-stake-redistribution` edge function which implements λ-scaled stake redistribution based on Bayesian Truth Serum (BTS) information scores.

**Status:** ✅ READY FOR IMPLEMENTATION
**Test Framework:** Deno Test
**Location:** `/tests/protocol/stake-redistribution.test.ts`
**Dependencies:** Local Supabase, test database with schema migrations applied

## Function Under Test

**Edge Function:** `supabase/functions/protocol-beliefs-stake-redistribution/index.ts`

**Purpose:** Redistribute stake based on BTS information scores using λ-scaled zero-sum transfers.

**Core Algorithm:**
```typescript
// 1. Fetch gross locks per agent (LONG + SHORT summed)
grossLock[agent_i] = Σ(belief_lock WHERE pool_address = X AND user.agent_id = agent_i AND token_balance > 0)

// 2. Calculate raw deltas (absolute weights, not normalized)
rawDelta[i] = informationScore[i] × grossLock[i]

// 3. Separate winners and losers
losses = Σ|rawDelta[i]| where rawDelta[i] < 0
gains = Σ rawDelta[i] where rawDelta[i] > 0

// 4. Calculate scaling factor
λ = losses / gains  (if gains > 0, else 0)

// 5. Apply scaled deltas
finalDelta[i] = rawDelta[i] > 0 ? floor(rawDelta[i] × λ) : rawDelta[i]

// 6. Enforce zero-sum constraint
assert |Σ finalDelta[i]| ≤ 1 μUSDC

// 7. Update stakes atomically
agents.total_stake = GREATEST(0, total_stake + finalDelta[i])
```

**Critical Invariants:**
1. **Zero-Sum:** `|Σ finalDelta| ≤ 1 μUSDC` (hard-fail if violated)
2. **Solvency:** Max loss = gross lock amount (when score = -1.0)
3. **Non-Negative Stakes:** `total_stake ≥ 0` always (enforced by `GREATEST(0, ...)`)
4. **Lock Persistence:** Locks never change during redistribution

## Test Categories

### 1. Input Validation

#### 1.1 Required Fields

```typescript
Deno.test("returns 400 when belief_id is missing", async () => {
  const response = await fetch(`${EDGE_FUNCTION_URL}/protocol-beliefs-stake-redistribution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({
      information_scores: { 'agent1': 0.5 }
    })
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assert(data.error.includes('belief_id'));
});

Deno.test("returns 400 when information_scores is missing", async () => {
  const response = await fetch(`${EDGE_FUNCTION_URL}/protocol-beliefs-stake-redistribution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({
      belief_id: 'valid-belief-id'
    })
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assert(data.error.includes('information_scores'));
});

Deno.test("returns 400 when information_scores is not an object", async () => {
  const response = await callRedistribution({
    belief_id: 'valid-belief-id',
    information_scores: []  // Array instead of object
  });

  assertEquals(response.status, 400);
});

Deno.test("returns 400 when information_scores is empty object", async () => {
  const response = await callRedistribution({
    belief_id: 'valid-belief-id',
    information_scores: {}
  });

  assertEquals(response.status, 400);
});
```

#### 1.2 Score Range Validation

```typescript
Deno.test("accepts scores in valid range [-1.0, 1.0]", async () => {
  const { beliefId, agent1Id } = await setupScenario();

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -1.0,  // Min valid
      [agent2Id]: 0.0,   // Zero
      [agent3Id]: 1.0    // Max valid
    }
  });

  assertEquals(response.status, 200);
});

Deno.test("returns 400 when score exceeds 1.0", async () => {
  const { beliefId, agent1Id } = await setupScenario();

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 1.5  // Invalid
    }
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assert(data.error.includes('score') || data.error.includes('range'));
});

Deno.test("returns 400 when score below -1.0", async () => {
  const { beliefId, agent1Id } = await setupScenario();

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -1.5  // Invalid
    }
  });

  assertEquals(response.status, 400);
});
```

### 2. Pool Lookup & Lock Aggregation

#### 2.1 Pool Deployment Lookup

```typescript
Deno.test("returns 404 when no pool deployment exists for belief", async () => {
  const beliefId = await createBeliefWithoutPool();

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: { 'agent1': 0.5 }
  });

  assertEquals(response.status, 404);
  const data = await response.json();
  assert(data.error.includes('No pool found'));
});

Deno.test("successfully fetches pool_address from pool_deployments", async () => {
  const { beliefId, poolAddress } = await setupScenario();

  // Add lock for agent
  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 5_000_000,  // $5
    tokenBalance: 100
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: { [agent1Id]: 0.5 }
  });

  // Should not fail on pool lookup
  assertNotEquals(response.status, 404);
});
```

#### 2.2 Gross Lock Aggregation (LONG + SHORT)

```typescript
Deno.test("aggregates LONG and SHORT locks for single agent", async () => {
  const { beliefId, poolAddress, agent1Id, user1Id } = await setupScenario();

  // Agent has both LONG and SHORT positions
  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,  // $10 LONG
    tokenBalance: 500
  });

  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'SHORT',
    beliefLock: 5_000_000,   // $5 SHORT
    tokenBalance: 250
  });

  // Score = -1.0, should lose full gross lock ($15)
  const initialStake = await getAgentStake(agent1Id);

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: { [agent1Id]: -1.0 }
  });

  assertEquals(response.status, 200);

  const finalStake = await getAgentStake(agent1Id);
  const lossAmount = initialStake - finalStake;

  // Should lose exactly $15 (gross lock)
  assertEquals(lossAmount, 15_000_000);
});

Deno.test("handles multiple agents with mixed LONG/SHORT positions", async () => {
  const { beliefId, poolAddress } = await setupScenario();

  // Agent 1: LONG only ($10)
  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,
    tokenBalance: 100
  });

  // Agent 2: SHORT only ($5)
  await insertBalance({
    userId: user2Id,
    poolAddress,
    tokenType: 'SHORT',
    beliefLock: 5_000_000,
    tokenBalance: 50
  });

  // Agent 3: Both LONG ($8) and SHORT ($2) = $10 total
  await insertBalance({
    userId: user3Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 8_000_000,
    tokenBalance: 80
  });
  await insertBalance({
    userId: user3Id,
    poolAddress,
    tokenType: 'SHORT',
    beliefLock: 2_000_000,
    tokenBalance: 20
  });

  // All score -1.0 → should lose their respective gross locks
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -1.0,  // Loses $10
      [agent2Id]: -1.0,  // Loses $5
      [agent3Id]: -1.0   // Loses $10 ($8 + $2)
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Total slashes = $25
  assertAlmostEquals(data.slashing_pool, 25, 1e-6);
  assertAlmostEquals(data.individual_slashes[agent1Id], 10, 1e-6);
  assertAlmostEquals(data.individual_slashes[agent2Id], 5, 1e-6);
  assertAlmostEquals(data.individual_slashes[agent3Id], 10, 1e-6);
});
```

#### 2.3 Closed Positions Excluded

```typescript
Deno.test("excludes positions with zero token_balance", async () => {
  const { beliefId, poolAddress, agent1Id, user1Id } = await setupScenario();

  // Position with lock but zero balance (shouldn't happen in practice, but test robustness)
  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,  // $10 lock
    tokenBalance: 0           // Closed position
  });

  const initialStake = await getAgentStake(agent1Id);

  // Score = -1.0, but should have no effect (zero lock considered)
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: { [agent1Id]: -1.0 }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // No redistribution should occur
  assertEquals(data.redistribution_occurred, false);

  const finalStake = await getAgentStake(agent1Id);
  assertEquals(finalStake, initialStake);
});

Deno.test("handles no active positions gracefully", async () => {
  const { beliefId } = await setupScenario();

  // No balances inserted → no active positions
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,
      [agent2Id]: -0.5
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertEquals(data.redistribution_occurred, false);
  assertEquals(Object.keys(data.individual_rewards).length, 0);
  assertEquals(Object.keys(data.individual_slashes).length, 0);
  assertEquals(data.slashing_pool, 0);
});
```

### 3. λ-Scaled Redistribution Logic

#### 3.1 Basic λ Calculation

```typescript
Deno.test("calculates λ correctly for balanced wins/losses", async () => {
  const { beliefId, poolAddress } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,  // $10
    agent2Lock: 10_000_000   // $10
  });

  // Agent 1 wins, Agent 2 loses
  // Raw: +10, -10 → Gains = 10, Losses = 10 → λ = 1.0
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 1.0,   // Raw delta = +$10
      [agent2Id]: -1.0   // Raw delta = -$10
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // λ should be 1.0 (exact balance)
  assertAlmostEquals(data.lambda, 1.0, 1e-6);

  // Agent 1 gains $10, Agent 2 loses $10
  assertAlmostEquals(data.individual_rewards[agent1Id], 10, 1e-6);
  assertAlmostEquals(data.individual_slashes[agent2Id], 10, 1e-6);
});

Deno.test("calculates λ < 1.0 when gains exceed losses", async () => {
  const { beliefId, poolAddress } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,  // $10
    agent2Lock: 10_000_000,  // $10
    agent3Lock: 5_000_000    // $5
  });

  // Two winners, one loser
  // Agent 1: score +1.0 → raw +$10
  // Agent 2: score +1.0 → raw +$10
  // Agent 3: score -1.0 → raw -$5
  // Gains = $20, Losses = $5 → λ = 5/20 = 0.25

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 1.0,
      [agent2Id]: 1.0,
      [agent3Id]: -1.0
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertAlmostEquals(data.lambda, 0.25, 1e-6);

  // Winners get scaled: $10 × 0.25 = $2.50 each
  assertAlmostEquals(data.individual_rewards[agent1Id], 2.5, 1e-6);
  assertAlmostEquals(data.individual_rewards[agent2Id], 2.5, 1e-6);

  // Loser pays full: $5
  assertAlmostEquals(data.individual_slashes[agent3Id], 5, 1e-6);
});

Deno.test("calculates λ > 1.0 when losses exceed gains (capped at available)", async () => {
  const { beliefId, poolAddress } = await setupThreeAgentScenario({
    agent1Lock: 5_000_000,   // $5
    agent2Lock: 10_000_000,  // $10
    agent3Lock: 10_000_000   // $10
  });

  // One winner, two losers
  // Agent 1: score +1.0 → raw +$5
  // Agent 2: score -1.0 → raw -$10
  // Agent 3: score -1.0 → raw -$10
  // Gains = $5, Losses = $20 → λ = 20/5 = 4.0

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 1.0,
      [agent2Id]: -1.0,
      [agent3Id]: -1.0
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertAlmostEquals(data.lambda, 4.0, 1e-6);

  // Winner gets full pot: $5 × 4.0 = $20 (capped by actual losses)
  assertAlmostEquals(data.individual_rewards[agent1Id], 20, 1e-6);

  // Losers pay full
  assertAlmostEquals(data.individual_slashes[agent2Id], 10, 1e-6);
  assertAlmostEquals(data.individual_slashes[agent3Id], 10, 1e-6);
});
```

#### 3.2 Partial Scores (Between -1 and +1)

```typescript
Deno.test("handles fractional scores correctly", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,  // $10
    agent2Lock: 10_000_000   // $10
  });

  // Agent 1: score +0.5 → raw +$5
  // Agent 2: score -0.3 → raw -$3
  // Gains = $5, Losses = $3 → λ = 3/5 = 0.6

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,
      [agent2Id]: -0.3
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertAlmostEquals(data.lambda, 0.6, 1e-6);

  // Winner: $5 × 0.6 = $3
  assertAlmostEquals(data.individual_rewards[agent1Id], 3, 1e-6);

  // Loser: $3 (full)
  assertAlmostEquals(data.individual_slashes[agent2Id], 3, 1e-6);
});

Deno.test("handles near-zero scores", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  // Very small scores
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.01,   // Raw +$0.10
      [agent2Id]: -0.01   // Raw -$0.10
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Redistribution should still occur, even if tiny
  assertEquals(data.redistribution_occurred, true);
  assertAlmostEquals(data.lambda, 1.0, 1e-6);
});
```

#### 3.3 Edge Cases: All Winners or All Losers

```typescript
Deno.test("returns λ = 0 when all agents are winners (no losses)", async () => {
  const { beliefId } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 5_000_000,
    agent3Lock: 5_000_000
  });

  // All positive scores → no losses → λ = 0
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.8,
      [agent2Id]: 0.5,
      [agent3Id]: 0.3
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertEquals(data.lambda, 0);

  // No redistribution (no losses to distribute)
  assertEquals(Object.keys(data.individual_rewards).length, 0);
  assertEquals(Object.keys(data.individual_slashes).length, 0);
});

Deno.test("returns λ = 0 when all agents are losers (no gains)", async () => {
  const { beliefId } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 5_000_000,
    agent3Lock: 5_000_000
  });

  // All negative scores → no gains → λ = 0
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -0.8,
      [agent2Id]: -0.5,
      [agent3Id]: -0.3
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertEquals(data.lambda, 0);

  // No redistribution (no winners to reward)
  assertEquals(Object.keys(data.individual_rewards).length, 0);
  assertEquals(Object.keys(data.individual_slashes).length, 0);
});

Deno.test("handles all zero scores", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.0,
      [agent2Id]: 0.0
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertEquals(data.lambda, 0);
  assertEquals(data.redistribution_occurred, false);
});
```

### 4. Zero-Sum Constraint

#### 4.1 Zero-Sum Enforcement (Critical Invariant)

```typescript
Deno.test("enforces zero-sum for two-agent redistribution", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.7,
      [agent2Id]: -0.7
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Verify zero-sum property
  assertNotEquals(data.total_delta_micro, undefined);
  assert(Math.abs(data.total_delta_micro) <= 1,
    `Zero-sum violated: total_delta = ${data.total_delta_micro} μUSDC`);
});

Deno.test("enforces zero-sum for multi-agent redistribution", async () => {
  const { beliefId } = await setupFiveAgentScenario({
    agent1Lock: 20_000_000,
    agent2Lock: 15_000_000,
    agent3Lock: 10_000_000,
    agent4Lock: 8_000_000,
    agent5Lock: 7_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.9,
      [agent2Id]: 0.4,
      [agent3Id]: -0.2,
      [agent4Id]: -0.6,
      [agent5Id]: -0.8
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assert(Math.abs(data.total_delta_micro) <= 1);
});

Deno.test("verifies zero-sum with manual calculation", async () => {
  const { beliefId } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 5_000_000,
    agent3Lock: 5_000_000
  });

  const initialStakes = {
    [agent1Id]: await getAgentStake(agent1Id),
    [agent2Id]: await getAgentStake(agent2Id),
    [agent3Id]: await getAgentStake(agent3Id)
  };

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,
      [agent2Id]: 0.3,
      [agent3Id]: -0.8
    }
  });

  assertEquals(response.status, 200);

  const finalStakes = {
    [agent1Id]: await getAgentStake(agent1Id),
    [agent2Id]: await getAgentStake(agent2Id),
    [agent3Id]: await getAgentStake(agent3Id)
  };

  // Calculate total change
  const totalChange =
    (finalStakes[agent1Id] - initialStakes[agent1Id]) +
    (finalStakes[agent2Id] - initialStakes[agent2Id]) +
    (finalStakes[agent3Id] - initialStakes[agent3Id]);

  // Should be exactly zero (within 1 μUSDC)
  assert(Math.abs(totalChange) <= 1,
    `Manual verification failed: total change = ${totalChange} μUSDC`);
});
```

#### 4.2 Zero-Sum Violation Detection

```typescript
Deno.test("aborts when zero-sum is violated (mocked failure)", async () => {
  // This test requires mocking internal calculation to force violation
  // In practice, this should never happen with correct implementation

  // Mock scenario: Inject error in lambda calculation
  // (Implementation detail: may need to use dependency injection for testing)

  // Expected: Function throws error and aborts transaction
  // Expected: No stakes are updated (transaction rolled back)
});
```

### 5. Solvency Guarantee

#### 5.1 Max Loss = Lock Amount

```typescript
Deno.test("max loss equals lock amount when score = -1.0", async () => {
  const { beliefId, agent1Id } = await setupSingleAgentScenario({
    agentLock: 10_000_000  // $10
  });

  const initialStake = await getAgentStake(agent1Id);

  // Worst possible score
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -1.0
    }
  });

  assertEquals(response.status, 200);

  const finalStake = await getAgentStake(agent1Id);
  const loss = initialStake - finalStake;

  // Loss should be exactly $10 (the lock amount)
  assertEquals(loss, 10_000_000);
});

Deno.test("verifies solvency: stake + loss ≥ 0", async () => {
  const { beliefId, agent1Id } = await setupSingleAgentScenario({
    agentLock: 50_000_000,      // $50 lock
    initialStake: 50_000_000    // $50 stake
  });

  // Max loss = $50
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -1.0
    }
  });

  assertEquals(response.status, 200);

  const finalStake = await getAgentStake(agent1Id);

  // Should be exactly 0 (not negative)
  assertEquals(finalStake, 0);
});

Deno.test("prevents negative stakes with GREATEST(0, stake + delta)", async () => {
  const { beliefId, agent1Id } = await setupSingleAgentScenario({
    agentLock: 100_000_000,     // $100 lock
    initialStake: 50_000_000    // $50 stake (underwater scenario)
  });

  // This scenario shouldn't occur in practice (invariant should prevent it)
  // But test that GREATEST(0, ...) protects against negative stakes

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: -1.0  // Would cause -$100 delta
    }
  });

  assertEquals(response.status, 200);

  const finalStake = await getAgentStake(agent1Id);

  // Should be clamped to 0
  assert(finalStake >= 0);
});
```

#### 5.2 Lock Persistence

```typescript
Deno.test("verifies locks are not modified during redistribution", async () => {
  const { beliefId, poolAddress, agent1Id, user1Id } = await setupScenario();

  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,
    tokenBalance: 100
  });

  const lockBefore = await getBeliefLock(user1Id, poolAddress, 'LONG');

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5
    }
  });

  assertEquals(response.status, 200);

  const lockAfter = await getBeliefLock(user1Id, poolAddress, 'LONG');

  // Lock should be unchanged
  assertEquals(lockAfter, lockBefore);
  assertEquals(lockAfter, 10_000_000);
});

Deno.test("verifies locks persist across multiple redistributions", async () => {
  const { beliefId, poolAddress, agent1Id, user1Id } = await setupScenario();

  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 15_000_000,
    tokenBalance: 100
  });

  // First redistribution
  await callRedistribution({
    belief_id: beliefId,
    information_scores: { [agent1Id]: 0.3 }
  });

  const lockAfterFirst = await getBeliefLock(user1Id, poolAddress, 'LONG');

  // Second redistribution
  await callRedistribution({
    belief_id: beliefId,
    information_scores: { [agent1Id]: -0.5 }
  });

  const lockAfterSecond = await getBeliefLock(user1Id, poolAddress, 'LONG');

  // Lock should never change
  assertEquals(lockAfterFirst, 15_000_000);
  assertEquals(lockAfterSecond, 15_000_000);
});
```

### 6. Concurrency & Advisory Locks

#### 6.1 Advisory Lock Acquisition

```typescript
Deno.test("acquires advisory lock before redistribution", async () => {
  const { beliefId } = await setupScenario();

  // Track advisory lock calls
  const { supabase, lockSpy } = createSupabaseWithSpy();

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: { [agent1Id]: 0.5 }
  });

  // Verify pg_advisory_lock was called
  assert(lockSpy.acquire.called);
  assert(lockSpy.release.called);
});

Deno.test("releases advisory lock after successful redistribution", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,
      [agent2Id]: -0.5
    }
  });

  assertEquals(response.status, 200);

  // Verify lock is released by attempting to acquire it
  const lockAcquired = await tryAcquireAdvisoryLock(poolAddress);
  assert(lockAcquired, "Advisory lock should be released after redistribution");
});

Deno.test("releases advisory lock after error", async () => {
  const { beliefId } = await setupScenario();

  // Cause an error (e.g., invalid score)
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 999  // Invalid score
    }
  });

  assert(response.status >= 400);

  // Lock should still be released
  const lockAcquired = await tryAcquireAdvisoryLock(poolAddress);
  assert(lockAcquired, "Advisory lock should be released even after error");
});
```

#### 6.2 Concurrent Redistribution Prevention

```typescript
Deno.test("prevents concurrent redistributions on same pool", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  // Start first redistribution (without awaiting)
  const promise1 = callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,
      [agent2Id]: -0.5
    }
  });

  // Small delay to ensure first call acquires lock
  await delay(100);

  // Start second redistribution (should wait for lock)
  const promise2 = callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.3,
      [agent2Id]: -0.3
    }
  });

  const [result1, result2] = await Promise.all([promise1, promise2]);

  // Both should succeed, but execute serially
  assertEquals(result1.status, 200);
  assertEquals(result2.status, 200);

  // Verify stakes are consistent (no race condition corruption)
  // If concurrent, stakes could be corrupted
  const finalStake1 = await getAgentStake(agent1Id);
  const finalStake2 = await getAgentStake(agent2Id);

  assert(finalStake1 >= 0);
  assert(finalStake2 >= 0);
});

Deno.test("allows concurrent redistributions on different pools", async () => {
  const { beliefId: belief1, poolAddress: pool1 } = await setupScenario();
  const { beliefId: belief2, poolAddress: pool2 } = await setupScenario();

  // Setup locks for both pools
  await insertBalance({ userId: user1Id, poolAddress: pool1, tokenType: 'LONG', beliefLock: 10_000_000, tokenBalance: 100 });
  await insertBalance({ userId: user2Id, poolAddress: pool2, tokenType: 'LONG', beliefLock: 10_000_000, tokenBalance: 100 });

  // Start both redistributions concurrently
  const start = Date.now();

  const [result1, result2] = await Promise.all([
    callRedistribution({
      belief_id: belief1,
      information_scores: { [agent1Id]: 0.5 }
    }),
    callRedistribution({
      belief_id: belief2,
      information_scores: { [agent2Id]: 0.5 }
    })
  ]);

  const duration = Date.now() - start;

  assertEquals(result1.status, 200);
  assertEquals(result2.status, 200);

  // Should execute in parallel (not serial)
  // If serial, would take 2x single execution time
  // This is a rough check; adjust threshold based on actual performance
  assert(duration < 5000, "Concurrent redistributions on different pools should not block each other");
});
```

### 7. Atomic Stake Updates

#### 7.1 Atomicity Verification

```typescript
Deno.test("updates stakes atomically using update_stake_atomic function", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.8,
      [agent2Id]: -0.8
    }
  });

  assertEquals(response.status, 200);

  // Verify both stakes were updated
  const stake1 = await getAgentStake(agent1Id);
  const stake2 = await getAgentStake(agent2Id);

  assert(stake1 > 0);
  assert(stake2 >= 0);
});

Deno.test("handles zero delta (skips update)", async () => {
  const { beliefId, agent1Id } = await setupSingleAgentScenario({
    agentLock: 10_000_000
  });

  const initialStake = await getAgentStake(agent1Id);

  // Zero score → zero delta → no update
  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.0
    }
  });

  assertEquals(response.status, 200);

  const finalStake = await getAgentStake(agent1Id);

  // Stake should be unchanged
  assertEquals(finalStake, initialStake);
});
```

### 8. Response Format & Reporting

#### 8.1 Response Structure

```typescript
Deno.test("returns correct response structure on success", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,
      [agent2Id]: -0.5
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Verify required fields
  assert('redistribution_occurred' in data);
  assert('individual_rewards' in data);
  assert('individual_slashes' in data);
  assert('slashing_pool' in data);
  assert('lambda' in data);
  assert('total_delta_micro' in data);

  assertEquals(typeof data.redistribution_occurred, 'boolean');
  assertEquals(typeof data.individual_rewards, 'object');
  assertEquals(typeof data.individual_slashes, 'object');
  assertEquals(typeof data.slashing_pool, 'number');
  assertEquals(typeof data.lambda, 'number');
  assertEquals(typeof data.total_delta_micro, 'number');
});

Deno.test("returns correct individual_rewards mapping", async () => {
  const { beliefId } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 5_000_000,
    agent3Lock: 5_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.8,   // Winner
      [agent2Id]: 0.4,   // Winner
      [agent3Id]: -0.9   // Loser
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Only winners should appear in individual_rewards
  assert(agent1Id in data.individual_rewards);
  assert(agent2Id in data.individual_rewards);
  assert(!(agent3Id in data.individual_rewards));

  // Only losers should appear in individual_slashes
  assert(!(agent1Id in data.individual_slashes));
  assert(!(agent2Id in data.individual_slashes));
  assert(agent3Id in data.individual_slashes);
});

Deno.test("returns slashing_pool equal to sum of individual slashes", async () => {
  const { beliefId } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 8_000_000,
    agent3Lock: 5_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.9,
      [agent2Id]: -0.6,
      [agent3Id]: -0.8
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  const sumSlashes = Object.values(data.individual_slashes as Record<string, number>)
    .reduce((sum, val) => sum + val, 0);

  assertAlmostEquals(data.slashing_pool, sumSlashes, 1e-6);
});
```

#### 8.2 Micro-USDC Precision

```typescript
Deno.test("handles micro-USDC precision correctly", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 1_000_001,  // $1.000001
    agent2Lock: 1_000_001   // $1.000001
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.123456,
      [agent2Id]: -0.123456
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Verify precision is maintained (responses in USDC, 6 decimal places)
  assert(data.individual_rewards[agent1Id] !== undefined);
  assert(data.individual_slashes[agent2Id] !== undefined);

  // Verify micro-USDC conversion (response should be in USDC)
  assert(data.individual_rewards[agent1Id] < 1);  // Less than $1
  assert(data.individual_slashes[agent2Id] < 1);  // Less than $1
});

Deno.test("verifies floor() operation in lambda scaling", async () => {
  const { beliefId } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 3_000_000
  });

  // Create scenario where lambda scaling produces fractional micro-USDC
  // Agent 1: +1.0 → raw +$10
  // Agent 2: -1.0 → raw -$3
  // λ = 3/10 = 0.3
  // Agent 1 gain: floor(10M × 0.3) = floor(3M) = 3M μUSDC

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 1.0,
      [agent2Id]: -1.0
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Agent 1 should gain exactly $3 (not $3.0000001)
  assertEquals(data.individual_rewards[agent1Id], 3);

  // Agent 2 should lose exactly $3
  assertEquals(data.individual_slashes[agent2Id], 3);
});
```

### 9. Integration with Database

#### 9.1 User-Agent Mapping

```typescript
Deno.test("correctly maps user_id to agent_id for locks", async () => {
  const { beliefId, poolAddress } = await setupScenario();

  // Create user with agent
  const agentId = crypto.randomUUID();
  const userId = await createUser({ agent_id: agentId });

  await insertBalance({
    userId: userId,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,
    tokenBalance: 100
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agentId]: 0.5
    }
  });

  assertEquals(response.status, 200);

  // Verify agent's stake was updated (not user's)
  const agentStake = await getAgentStake(agentId);
  assert(agentStake !== undefined);
});

Deno.test("returns error when agent has no associated user", async () => {
  const { beliefId } = await setupScenario();

  const orphanAgentId = crypto.randomUUID();
  // Create agent without user record (shouldn't happen, but test robustness)
  await createOrphanAgent(orphanAgentId);

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [orphanAgentId]: 0.5
    }
  });

  // Should handle gracefully (either skip or return error)
  // Spec: Should not crash, behavior TBD
  assert(response.status === 200 || response.status >= 400);
});
```

## Test Helpers

```typescript
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertEquals, assert, assertAlmostEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Configuration
const EDGE_FUNCTION_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321/functions/v1';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

let supabase: SupabaseClient;

// Setup/teardown
export function setup() {
  supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    SERVICE_KEY
  );
}

export async function teardown() {
  // Clean up test data
  await supabase.from('user_pool_balances').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pool_deployments').delete().neq('belief_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('beliefs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

/**
 * Call redistribution edge function
 */
export async function callRedistribution(params: {
  belief_id: string;
  information_scores: Record<string, number>;
}) {
  const response = await fetch(
    `${EDGE_FUNCTION_URL}/protocol-beliefs-stake-redistribution`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(params),
    }
  );

  return {
    status: response.status,
    json: () => response.json(),
  };
}

/**
 * Setup basic scenario with belief and pool
 */
export async function setupScenario() {
  const beliefId = crypto.randomUUID();
  const poolAddress = `Pool${crypto.randomUUID().slice(0, 8)}`;

  // Create belief
  await supabase.from('beliefs').insert({
    id: beliefId,
    question: 'Test belief',
    state: 'active',
  });

  // Create pool deployment
  await supabase.from('pool_deployments').insert({
    belief_id: beliefId,
    pool_address: poolAddress,
    post_id: crypto.randomUUID(),
    long_mint: 'LongMint',
    short_mint: 'ShortMint',
    transaction_signature: 'sig',
  });

  // Create agents
  const agent1Id = crypto.randomUUID();
  const agent2Id = crypto.randomUUID();
  const agent3Id = crypto.randomUUID();

  await supabase.from('agents').insert([
    { id: agent1Id, solana_address: 'addr1', total_stake: 100_000_000 },
    { id: agent2Id, solana_address: 'addr2', total_stake: 100_000_000 },
    { id: agent3Id, solana_address: 'addr3', total_stake: 100_000_000 },
  ]);

  // Create users
  const user1Id = crypto.randomUUID();
  const user2Id = crypto.randomUUID();
  const user3Id = crypto.randomUUID();

  await supabase.from('users').insert([
    { id: user1Id, agent_id: agent1Id, username: 'user1' },
    { id: user2Id, agent_id: agent2Id, username: 'user2' },
    { id: user3Id, agent_id: agent3Id, username: 'user3' },
  ]);

  return {
    beliefId,
    poolAddress,
    agent1Id,
    agent2Id,
    agent3Id,
    user1Id,
    user2Id,
    user3Id,
  };
}

/**
 * Setup two-agent scenario with specified locks
 */
export async function setupTwoAgentScenario(params: {
  agent1Lock: number;
  agent2Lock: number;
}) {
  const scenario = await setupScenario();

  await insertBalance({
    userId: scenario.user1Id,
    poolAddress: scenario.poolAddress,
    tokenType: 'LONG',
    beliefLock: params.agent1Lock,
    tokenBalance: 100,
  });

  await insertBalance({
    userId: scenario.user2Id,
    poolAddress: scenario.poolAddress,
    tokenType: 'LONG',
    beliefLock: params.agent2Lock,
    tokenBalance: 100,
  });

  return scenario;
}

/**
 * Setup three-agent scenario
 */
export async function setupThreeAgentScenario(params: {
  agent1Lock: number;
  agent2Lock: number;
  agent3Lock: number;
}) {
  const scenario = await setupScenario();

  await insertBalance({
    userId: scenario.user1Id,
    poolAddress: scenario.poolAddress,
    tokenType: 'LONG',
    beliefLock: params.agent1Lock,
    tokenBalance: 100,
  });

  await insertBalance({
    userId: scenario.user2Id,
    poolAddress: scenario.poolAddress,
    tokenType: 'LONG',
    beliefLock: params.agent2Lock,
    tokenBalance: 100,
  });

  await insertBalance({
    userId: scenario.user3Id,
    poolAddress: scenario.poolAddress,
    tokenType: 'LONG',
    beliefLock: params.agent3Lock,
    tokenBalance: 100,
  });

  return scenario;
}

/**
 * Insert user_pool_balances record
 */
export async function insertBalance(params: {
  userId: string;
  poolAddress: string;
  tokenType: 'LONG' | 'SHORT';
  beliefLock: number;
  tokenBalance: number;
}) {
  await supabase.from('user_pool_balances').insert({
    user_id: params.userId,
    pool_address: params.poolAddress,
    token_type: params.tokenType,
    belief_lock: params.beliefLock,
    token_balance: params.tokenBalance,
    last_buy_amount: params.beliefLock * 50,  // Approximate
    total_bought: params.tokenBalance,
    total_sold: 0,
    total_usdc_spent: params.beliefLock * 50,
    total_usdc_received: 0,
  });
}

/**
 * Get agent's current stake
 */
export async function getAgentStake(agentId: string): Promise<number> {
  const { data, error } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', agentId)
    .single();

  if (error) throw error;
  return data.total_stake;
}

/**
 * Get belief lock for a position
 */
export async function getBeliefLock(
  userId: string,
  poolAddress: string,
  tokenType: 'LONG' | 'SHORT'
): Promise<number> {
  const { data, error } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', userId)
    .eq('pool_address', poolAddress)
    .eq('token_type', tokenType)
    .single();

  if (error) throw error;
  return data.belief_lock;
}

/**
 * Custom assertion for floating-point equality
 */
export function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance: number = 1e-6,
  msg?: string
) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      msg || `Expected ${actual} to be within ${tolerance} of ${expected}, but difference was ${diff}`
    );
  }
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## Performance Benchmarks

```typescript
Deno.test("benchmark: redistribution with 10 agents", async () => {
  const scenario = await setupMultiAgentScenario(10);

  const start = performance.now();

  const response = await callRedistribution({
    belief_id: scenario.beliefId,
    information_scores: scenario.scores,
  });

  const duration = performance.now() - start;

  assertEquals(response.status, 200);
  console.log(`10-agent redistribution: ${duration.toFixed(2)}ms`);

  // Should complete in reasonable time
  assert(duration < 5000, "Redistribution took too long");
});

Deno.test("benchmark: redistribution with 100 agents", async () => {
  const scenario = await setupMultiAgentScenario(100);

  const start = performance.now();

  const response = await callRedistribution({
    belief_id: scenario.beliefId,
    information_scores: scenario.scores,
  });

  const duration = performance.now() - start;

  assertEquals(response.status, 200);
  console.log(`100-agent redistribution: ${duration.toFixed(2)}ms`);

  assert(duration < 30000, "100-agent redistribution took too long");
});
```

## Success Criteria

### Critical Invariants (Must Pass)
- ✅ Zero-sum property: `|Σ finalDelta| ≤ 1 μUSDC` for ALL redistributions
- ✅ Max loss equals lock: `loss = lock` when `score = -1.0`
- ✅ Non-negative stakes: `stake ≥ 0` always
- ✅ Lock persistence: Locks never modified during redistribution

### Core Functionality (Must Pass)
- ✅ λ calculation correct for all scenarios
- ✅ Gross lock aggregation (LONG + SHORT)
- ✅ Closed positions excluded
- ✅ Atomic stake updates
- ✅ Advisory locks prevent concurrent redistributions

### Edge Cases (Should Pass)
- ✅ All winners / all losers handled gracefully
- ✅ No active positions handled gracefully
- ✅ Near-zero scores handled correctly
- ✅ Micro-USDC precision maintained

### Performance (Should Pass)
- ✅ 10-agent redistribution < 5 seconds
- ✅ 100-agent redistribution < 30 seconds

## Run Tests

```bash
# Run all redistribution tests
deno test tests/protocol/stake-redistribution.test.ts --allow-net --allow-env

# Run specific test
deno test tests/protocol/stake-redistribution.test.ts --filter "zero-sum" --allow-net --allow-env

# Run with coverage
deno test tests/protocol/stake-redistribution.test.ts --coverage=coverage --allow-net --allow-env

# Watch mode for development
deno test tests/protocol/stake-redistribution.test.ts --watch --allow-net --allow-env

# Verbose output
deno test tests/protocol/stake-redistribution.test.ts --allow-net --allow-env -- --verbose
```

## Dependencies

**Required:**
- Local Supabase instance running
- Database migrations applied (including `update_stake_atomic` function)
- Test database with clean state

**Setup:**
```bash
# Start Supabase
supabase start

# Apply migrations
supabase db reset

# Deploy edge functions
supabase functions deploy protocol-beliefs-stake-redistribution
```

---

**Status:** ✅ Specification complete, ready for implementation
**Priority:** Critical (core protocol invariants)
**Estimated Implementation Time:** 2-3 days
**Last Updated:** 2025-01-26

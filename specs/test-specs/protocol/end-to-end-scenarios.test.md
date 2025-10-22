# End-to-End Protocol Scenarios Test Specification

## Overview

Comprehensive end-to-end tests that simulate real-world user journeys through the complete Veritas stack: post creation → pool deployment → trading → belief submission → epoch processing → stake redistribution → pool settlement.

**Status:** ✅ READY FOR IMPLEMENTATION
**Test Framework:** Deno Test (protocol layer) + Playwright (UI layer for full E2E)
**Location:** `/tests/protocol/end-to-end-scenarios.test.ts`
**Dependencies:** Local Solana devnet, Supabase, deployed Solana programs

## Purpose

Validate that the complete system works together correctly by simulating realistic user behavior patterns from your [STAKE-MECHANICS.md](../../specs/architecture/STAKE-MECHANICS.md) scenarios.

## Test Categories

### 1. Scenario: Profitable Trading Journey

**User Story:** Alice trades successfully, earns BTS rewards, and expands to multiple pools.

```typescript
Deno.test("Scenario 1: Profitable trader earns rewards and expands positions", async () => {
  // ===== SETUP =====
  const alice = await createUser({ initialUsdc: 1000_000_000 }); // $1000 USDC
  const postA = await createPost({ authorId: alice.userId, title: "AI will replace developers" });
  const postB = await createPost({ authorId: alice.userId, title: "Bitcoin to $100k" });

  const poolA = await deployPool({ postId: postA.id, beliefId: postA.beliefId });
  const poolB = await deployPool({ postId: postB.id, beliefId: postB.beliefId });

  // ===== T0: First Trade =====
  console.log("T0: Alice buys $500 LONG in Pool A");

  const trade1 = await executeTrade({
    userId: alice.userId,
    poolAddress: poolA.address,
    side: 'LONG',
    amount: 500_000_000,  // $500
    tradeType: 'buy'
  });

  // Verify state after first trade
  const aliceStakeT0 = await getAgentStake(alice.agentId);
  const aliceLocksT0 = await getUserLocks(alice.userId);

  assertEquals(aliceStakeT0, 10_000_000);  // $10 stake (2% of $500)
  assertEquals(aliceLocksT0.total, 10_000_000);  // $10 locked
  assertEquals(aliceLocksT0.withdrawable, 0);  // Can't withdraw (all locked)

  console.log("✓ T0 Complete:", {
    stake: formatUsdc(aliceStakeT0),
    locks: formatUsdc(aliceLocksT0.total),
    withdrawable: formatUsdc(aliceLocksT0.withdrawable)
  });

  // ===== T1: Epoch Processing (Alice Wins) =====
  console.log("T1: Process epoch - Alice makes accurate prediction");

  // Submit beliefs for Pool A
  await submitBelief({
    agentId: alice.agentId,
    beliefId: poolA.beliefId,
    prediction: 0.75,
    confidence: 0.8
  });

  // Create opposing agent for contrast
  const bob = await createUser({ initialUsdc: 1000_000_000 });
  await executeTrade({
    userId: bob.userId,
    poolAddress: poolA.address,
    side: 'SHORT',
    amount: 500_000_000
  });

  await submitBelief({
    agentId: bob.agentId,
    beliefId: poolA.beliefId,
    prediction: 0.25,  // Opposite prediction
    confidence: 0.8
  });

  // Process epoch (Alice was more accurate)
  const epochResult = await processEpoch({
    beliefId: poolA.beliefId,
    revealValue: 0.8  // Alice's prediction was closer
  });

  // Verify BTS reward
  const aliceStakeT1 = await getAgentStake(alice.agentId);
  const reward = aliceStakeT1 - aliceStakeT0;

  assert(reward > 0, "Alice should have earned a reward");
  assert(reward <= 10_000_000, "Reward should not exceed Bob's lock");

  const aliceLocksT1 = await getUserLocks(alice.userId);
  assertEquals(aliceLocksT1.total, 10_000_000);  // Locks unchanged
  assert(aliceLocksT1.withdrawable > 0, "Should have withdrawable balance");

  console.log("✓ T1 Complete:", {
    stake: formatUsdc(aliceStakeT1),
    reward: formatUsdc(reward),
    withdrawable: formatUsdc(aliceLocksT1.withdrawable)
  });

  // ===== T2: Expand to Second Pool =====
  console.log("T2: Alice buys $500 in Pool B using partial skim");

  const trade2 = await executeTrade({
    userId: alice.userId,
    poolAddress: poolB.address,
    side: 'LONG',
    amount: 500_000_000
  });

  const aliceStakeT2 = await getAgentStake(alice.agentId);
  const aliceLocksT2 = await getUserLocks(alice.userId);

  // Skim should only cover difference (already have some stake from reward)
  const skimAmount = trade2.skimAmount;
  assert(skimAmount < 10_000_000, "Should only skim difference, not full 2%");

  assertEquals(aliceLocksT2.total, 20_000_000);  // $20 total locks (Pool A + Pool B)
  assertEquals(aliceLocksT2.withdrawable, 0);  // Fully deployed again

  console.log("✓ T2 Complete:", {
    stake: formatUsdc(aliceStakeT2),
    skim: formatUsdc(skimAmount),
    totalLocks: formatUsdc(aliceLocksT2.total),
    poolALock: formatUsdc(aliceLocksT2.byPool[poolA.address]),
    poolBLock: formatUsdc(aliceLocksT2.byPool[poolB.address])
  });

  // ===== VERIFICATION =====
  // Zero-sum check across all agents
  const totalStakesT2 = await getTotalSystemStake();
  const initialSystemStake = 20_000_000;  // Alice $10 + Bob $10
  assertEquals(
    Math.abs(totalStakesT2 - initialSystemStake),
    0,
    "System stake should be conserved (zero-sum)"
  );

  console.log("✅ Scenario 1 Complete: Profitable trading journey validated");
});
```

### 2. Scenario: Underwater Recovery

**User Story:** Charlie suffers a BTS loss, becomes underwater, and recovers by adjusting positions.

```typescript
Deno.test("Scenario 2: Underwater trader recovers by closing positions", async () => {
  // ===== SETUP =====
  const charlie = await createUser({ initialUsdc: 1000_000_000 });

  const poolA = await deployPoolWithBelief({ question: "Market prediction A" });
  const poolB = await deployPoolWithBelief({ question: "Market prediction B" });

  // ===== T0: Open Two Positions =====
  console.log("T0: Charlie opens positions in Pool A ($1000) and Pool B ($500)");

  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolA.address,
    side: 'LONG',
    amount: 1_000_000_000  // $1000
  });

  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolB.address,
    side: 'LONG',
    amount: 500_000_000  // $500
  });

  const charlieStakeT0 = await getAgentStake(charlie.agentId);
  const charlieLocksT0 = await getUserLocks(charlie.userId);

  assertEquals(charlieStakeT0, 30_000_000);  // $30 stake (2% of $1500)
  assertEquals(charlieLocksT0.total, 30_000_000);  // $30 locked
  assertEquals(charlieLocksT0.byPool[poolA.address], 20_000_000);  // $20 Pool A
  assertEquals(charlieLocksT0.byPool[poolB.address], 10_000_000);  // $10 Pool B
  assertEquals(charlieLocksT0.withdrawable, 0);

  console.log("✓ T0 Complete:", charlieLocksT0);

  // ===== T1: BTS Loss (Underwater) =====
  console.log("T1: Charlie makes bad predictions and loses stake");

  // Charlie predicts badly
  await submitBelief({
    agentId: charlie.agentId,
    beliefId: poolA.beliefId,
    prediction: 0.1,
    confidence: 0.9
  });

  // Accurate agent for contrast
  const diana = await createUser({ initialUsdc: 1000_000_000 });
  await executeTrade({
    userId: diana.userId,
    poolAddress: poolA.address,
    side: 'SHORT',
    amount: 500_000_000
  });
  await submitBelief({
    agentId: diana.agentId,
    beliefId: poolA.beliefId,
    prediction: 0.9,
    confidence: 0.9
  });

  // Process epoch (Charlie was very wrong)
  await processEpoch({
    beliefId: poolA.beliefId,
    revealValue: 0.9
  });

  const charlieStakeT1 = await getAgentStake(charlie.agentId);
  const loss = charlieStakeT0 - charlieStakeT1;

  assert(loss > 0, "Charlie should have lost stake");
  assert(loss <= 20_000_000, "Max loss = Pool A lock");

  const charlieLocksT1 = await getUserLocks(charlie.userId);

  // Underwater check
  assert(charlieStakeT1 < charlieLocksT1.total, "Charlie is underwater");
  assert(charlieLocksT1.withdrawable < 0, "Negative withdrawable balance");

  console.log("✓ T1 Complete (Underwater):", {
    stake: formatUsdc(charlieStakeT1),
    loss: formatUsdc(loss),
    totalLocks: formatUsdc(charlieLocksT1.total),
    withdrawable: formatUsdc(charlieLocksT1.withdrawable),  // Negative!
    isUnderwater: true
  });

  // ===== T2: Recovery - Close Pool B =====
  console.log("T2: Charlie closes Pool B position to free up stake");

  const poolBBalance = await getTokenBalance(charlie.userId, poolB.address, 'LONG');

  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolB.address,
    side: 'LONG',
    amount: poolBBalance,
    tradeType: 'sell'
  });

  const charlieStakeT2 = await getAgentStake(charlie.agentId);
  const charlieLocksT2 = await getUserLocks(charlie.userId);

  // Verify lock freed
  assert(!(poolB.address in charlieLocksT2.byPool), "Pool B lock should be deleted");
  assertEquals(charlieLocksT2.total, 20_000_000);  // Only Pool A remains

  // Verify recovery
  assert(charlieStakeT2 >= charlieLocksT2.total, "Back to solvent");
  assert(charlieLocksT2.withdrawable >= 0, "Can withdraw again");

  console.log("✓ T2 Complete (Recovered):", {
    stake: formatUsdc(charlieStakeT2),
    totalLocks: formatUsdc(charlieLocksT2.total),
    withdrawable: formatUsdc(charlieLocksT2.withdrawable),
    isSolvent: true
  });

  console.log("✅ Scenario 2 Complete: Underwater recovery validated");
});
```

### 3. Scenario: Lock Replacement Strategy

**User Story:** Eve uses lock replacement to adjust position size and optimize stake usage.

```typescript
Deno.test("Scenario 3: Trader uses lock replacement to optimize positions", async () => {
  // ===== SETUP =====
  const eve = await createUser({ initialUsdc: 2000_000_000 });
  const pool = await deployPoolWithBelief({ question: "Crypto market prediction" });

  // ===== T0: Large Initial Position =====
  console.log("T0: Eve buys $2000 LONG");

  await executeTrade({
    userId: eve.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: 2_000_000_000  // $2000
  });

  const eveStakeT0 = await getAgentStake(eve.agentId);
  const eveLocksT0 = await getUserLocks(eve.userId);

  assertEquals(eveStakeT0, 40_000_000);  // $40 stake
  assertEquals(eveLocksT0.total, 40_000_000);  // $40 locked

  console.log("✓ T0 Complete:", eveLocksT0);

  // ===== T1: Replace with Smaller Position (Lock Reduction) =====
  console.log("T1: Eve replaces with smaller $500 LONG position");

  const trade1 = await executeTrade({
    userId: eve.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: 500_000_000,  // $500 (smaller)
    tradeType: 'buy'
  });

  const eveStakeT1 = await getAgentStake(eve.agentId);
  const eveLocksT1 = await getUserLocks(eve.userId);

  // Verify lock replaced (not added)
  assertEquals(eveLocksT1.total, 10_000_000);  // $10 (2% of $500), not $50
  assertEquals(trade1.skimAmount, 0);  // No skim needed (reducing lock)

  // Verify withdrawable increased
  assertEquals(eveLocksT1.withdrawable, 30_000_000);  // $30 freed up

  console.log("✓ T1 Complete:", {
    oldLock: formatUsdc(40_000_000),
    newLock: formatUsdc(eveLocksT1.total),
    skim: formatUsdc(0),
    withdrawable: formatUsdc(eveLocksT1.withdrawable)
  });

  // ===== T2: Replace with Larger Position (Skim Needed) =====
  console.log("T2: Eve replaces with larger $1500 LONG position");

  const trade2 = await executeTrade({
    userId: eve.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: 1_500_000_000,  // $1500 (larger)
    tradeType: 'buy'
  });

  const eveStakeT2 = await getAgentStake(eve.agentId);
  const eveLocksT2 = await getUserLocks(eve.userId);

  // Verify lock replaced
  assertEquals(eveLocksT2.total, 30_000_000);  // $30 (2% of $1500)

  // Skim should be difference: $30 - $10 = $20
  assertEquals(trade2.skimAmount, 20_000_000);

  assertEquals(eveLocksT2.withdrawable, 0);  // Fully deployed again

  console.log("✓ T2 Complete:", {
    oldLock: formatUsdc(10_000_000),
    newLock: formatUsdc(eveLocksT2.total),
    skim: formatUsdc(trade2.skimAmount),
    withdrawable: formatUsdc(eveLocksT2.withdrawable)
  });

  console.log("✅ Scenario 3 Complete: Lock replacement validated");
});
```

### 4. Scenario: LONG + SHORT Dual Positions

**User Story:** Frank hedges by holding both LONG and SHORT in the same pool, with gross lock aggregation.

```typescript
Deno.test("Scenario 4: Trader holds LONG and SHORT simultaneously with gross locks", async () => {
  // ===== SETUP =====
  const frank = await createUser({ initialUsdc: 2000_000_000 });
  const pool = await deployPoolWithBelief({ question: "Uncertain market event" });

  // ===== T0: Buy LONG =====
  console.log("T0: Frank buys $600 LONG");

  await executeTrade({
    userId: frank.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: 600_000_000
  });

  const frankStakeT0 = await getAgentStake(frank.agentId);
  const frankLocksT0 = await getUserLocks(frank.userId);

  assertEquals(frankStakeT0, 12_000_000);  // $12 stake
  assertEquals(frankLocksT0.total, 12_000_000);  // $12 locked (LONG only)

  // ===== T1: Add SHORT (Hedge) =====
  console.log("T1: Frank buys $400 SHORT (hedge)");

  await executeTrade({
    userId: frank.userId,
    poolAddress: pool.address,
    side: 'SHORT',
    amount: 400_000_000
  });

  const frankStakeT1 = await getAgentStake(frank.agentId);
  const frankLocksT1 = await getUserLocks(frank.userId);

  // Verify gross aggregation (LONG + SHORT, not net)
  assertEquals(frankLocksT1.total, 20_000_000);  // $12 LONG + $8 SHORT = $20
  assertEquals(frankLocksT1.byPoolSide[pool.address].LONG, 12_000_000);
  assertEquals(frankLocksT1.byPoolSide[pool.address].SHORT, 8_000_000);

  assertEquals(frankStakeT1, 20_000_000);  // Added $8 skim

  console.log("✓ T1 Complete:", {
    longLock: formatUsdc(12_000_000),
    shortLock: formatUsdc(8_000_000),
    totalLock: formatUsdc(frankLocksT1.total),
    stake: formatUsdc(frankStakeT1)
  });

  // ===== T2: BTS Epoch with Gross Lock Loss =====
  console.log("T2: Process epoch - Frank makes bad prediction");

  await submitBelief({
    agentId: frank.agentId,
    beliefId: pool.beliefId,
    prediction: 0.5,
    confidence: 0.9
  });

  // Accurate agent
  const grace = await createUser({ initialUsdc: 1000_000_000 });
  await executeTrade({
    userId: grace.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: 1_000_000_000
  });
  await submitBelief({
    agentId: grace.agentId,
    beliefId: pool.beliefId,
    prediction: 0.9,
    confidence: 0.9
  });

  // Process epoch (Frank was wrong)
  await processEpoch({
    beliefId: pool.beliefId,
    revealValue: 0.9
  });

  const frankStakeT2 = await getAgentStake(frank.agentId);
  const loss = frankStakeT1 - frankStakeT2;

  // Loss should be based on GROSS lock ($20), not net
  assert(loss > 0, "Frank should have lost stake");
  assert(loss <= 20_000_000, "Max loss = gross lock ($20)");

  console.log("✓ T2 Complete:", {
    initialStake: formatUsdc(frankStakeT1),
    finalStake: formatUsdc(frankStakeT2),
    loss: formatUsdc(loss),
    maxLoss: formatUsdc(20_000_000),
    lossBasedOnGross: true
  });

  console.log("✅ Scenario 4 Complete: LONG + SHORT gross lock validated");
});
```

### 5. Scenario: Maximum Loss Solvency Guarantee

**User Story:** Hank makes the worst possible prediction and verifies max loss equals lock amount.

```typescript
Deno.test("Scenario 5: Worst-case BTS loss equals lock amount (solvency guarantee)", async () => {
  // ===== SETUP =====
  const hank = await createUser({ initialUsdc: 1000_000_000 });
  const pool = await deployPoolWithBelief({ question: "Extreme prediction test" });

  // ===== T0: Open Position =====
  console.log("T0: Hank buys $500 LONG");

  await executeTrade({
    userId: hank.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: 500_000_000
  });

  const hankStakeT0 = await getAgentStake(hank.agentId);
  const hankLocksT0 = await getUserLocks(hank.userId);
  const lockAmount = hankLocksT0.total;

  assertEquals(hankStakeT0, 10_000_000);  // $10
  assertEquals(lockAmount, 10_000_000);  // $10

  // ===== T1: Worst-Case BTS Score (-1.0) =====
  console.log("T1: Hank makes terrible prediction (score = -1.0)");

  await submitBelief({
    agentId: hank.agentId,
    beliefId: pool.beliefId,
    prediction: 0.01,  // Extremely wrong
    confidence: 0.99
  });

  // Perfect predictor
  const ivan = await createUser({ initialUsdc: 1000_000_000 });
  await executeTrade({
    userId: ivan.userId,
    poolAddress: pool.address,
    side: 'SHORT',
    amount: 500_000_000
  });
  await submitBelief({
    agentId: ivan.agentId,
    beliefId: pool.beliefId,
    prediction: 0.99,
    confidence: 0.99
  });

  // Process epoch
  const epochResult = await processEpoch({
    beliefId: pool.beliefId,
    revealValue: 0.99
  });

  const hankStakeT1 = await getAgentStake(hank.agentId);
  const loss = hankStakeT0 - hankStakeT1;

  // CRITICAL: Verify max loss = lock amount
  assertEquals(loss, lockAmount, "Max loss should equal lock amount exactly");

  const hankLocksT1 = await getUserLocks(hank.userId);
  assertEquals(hankLocksT1.total, lockAmount);  // Locks unchanged

  // Verify still solvent
  assert(hankStakeT1 >= 0, "Stake should never go negative");
  assertEquals(hankStakeT1, 0);  // Lost exactly the lock amount

  console.log("✓ T1 Complete:", {
    initialStake: formatUsdc(hankStakeT0),
    finalStake: formatUsdc(hankStakeT1),
    loss: formatUsdc(loss),
    lockAmount: formatUsdc(lockAmount),
    lossEqualsLock: loss === lockAmount,
    stakeNonNegative: hankStakeT1 >= 0
  });

  // ===== T2: Close Position and Verify Final Solvency =====
  console.log("T2: Hank closes position");

  const balance = await getTokenBalance(hank.userId, pool.address, 'LONG');
  await executeTrade({
    userId: hank.userId,
    poolAddress: pool.address,
    side: 'LONG',
    amount: balance,
    tradeType: 'sell'
  });

  const hankStakeT2 = await getAgentStake(hank.agentId);
  const hankLocksT2 = await getUserLocks(hank.userId);

  assertEquals(hankLocksT2.total, 0);  // All locks cleared
  assertEquals(hankStakeT2, 0);  // No stake left (lost it all)
  assert(hankStakeT2 >= 0, "Final stake is non-negative (solvency guaranteed)");

  console.log("✓ T2 Complete:", {
    finalStake: formatUsdc(hankStakeT2),
    finalLocks: formatUsdc(hankLocksT2.total),
    solvencyGuaranteed: true
  });

  console.log("✅ Scenario 5 Complete: Max loss = lock amount validated");
});
```

### 6. Scenario: Multi-Pool Multi-Agent Complex Flow

**User Story:** Multiple agents trade across multiple pools, with epochs processing and settlements occurring.

```typescript
Deno.test("Scenario 6: Complex multi-pool multi-agent system test", async () => {
  // ===== SETUP: 3 Users, 3 Pools =====
  console.log("Setup: Creating 3 users and 3 pools");

  const users = await Promise.all([
    createUser({ username: 'alice', initialUsdc: 2000_000_000 }),
    createUser({ username: 'bob', initialUsdc: 2000_000_000 }),
    createUser({ username: 'charlie', initialUsdc: 2000_000_000 })
  ]);

  const [alice, bob, charlie] = users;

  const pools = await Promise.all([
    deployPoolWithBelief({ question: "AI will replace developers by 2030" }),
    deployPoolWithBelief({ question: "Bitcoin to $100k in 2025" }),
    deployPoolWithBelief({ question: "Fusion energy commercial by 2035" })
  ]);

  const [poolAI, poolBTC, poolFusion] = pools;

  // ===== ROUND 1: Initial Trading =====
  console.log("Round 1: All users trade in all pools");

  // Alice: Bullish on AI, Bearish on BTC, Neutral on Fusion
  await executeTrade({
    userId: alice.userId,
    poolAddress: poolAI.address,
    side: 'LONG',
    amount: 800_000_000  // $800
  });
  await executeTrade({
    userId: alice.userId,
    poolAddress: poolBTC.address,
    side: 'SHORT',
    amount: 400_000_000  // $400
  });
  await executeTrade({
    userId: alice.userId,
    poolAddress: poolFusion.address,
    side: 'LONG',
    amount: 300_000_000  // $300
  });

  // Bob: Bearish on AI, Bullish on BTC, Bullish on Fusion
  await executeTrade({
    userId: bob.userId,
    poolAddress: poolAI.address,
    side: 'SHORT',
    amount: 600_000_000  // $600
  });
  await executeTrade({
    userId: bob.userId,
    poolAddress: poolBTC.address,
    side: 'LONG',
    amount: 700_000_000  // $700
  });
  await executeTrade({
    userId: bob.userId,
    poolAddress: poolFusion.address,
    side: 'LONG',
    amount: 500_000_000  // $500
  });

  // Charlie: Moderate positions everywhere
  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolAI.address,
    side: 'LONG',
    amount: 500_000_000  // $500
  });
  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolBTC.address,
    side: 'LONG',
    amount: 500_000_000  // $500
  });
  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolFusion.address,
    side: 'SHORT',
    amount: 400_000_000  // $400
  });

  // Verify initial state
  const initialStakes = await Promise.all([
    getAgentStake(alice.agentId),
    getAgentStake(bob.agentId),
    getAgentStake(charlie.agentId)
  ]);

  const initialTotalStake = initialStakes.reduce((sum, stake) => sum + stake, 0);

  console.log("✓ Round 1 Complete:", {
    aliceStake: formatUsdc(initialStakes[0]),
    bobStake: formatUsdc(initialStakes[1]),
    charlieStake: formatUsdc(initialStakes[2]),
    totalSystemStake: formatUsdc(initialTotalStake)
  });

  // ===== ROUND 2: Belief Submissions =====
  console.log("Round 2: All users submit beliefs");

  // AI Pool beliefs
  await submitBelief({
    agentId: alice.agentId,
    beliefId: poolAI.beliefId,
    prediction: 0.8,
    confidence: 0.9
  });
  await submitBelief({
    agentId: bob.agentId,
    beliefId: poolAI.beliefId,
    prediction: 0.3,
    confidence: 0.8
  });
  await submitBelief({
    agentId: charlie.agentId,
    beliefId: poolAI.beliefId,
    prediction: 0.6,
    confidence: 0.7
  });

  // BTC Pool beliefs
  await submitBelief({
    agentId: alice.agentId,
    beliefId: poolBTC.beliefId,
    prediction: 0.4,
    confidence: 0.8
  });
  await submitBelief({
    agentId: bob.agentId,
    beliefId: poolBTC.beliefId,
    prediction: 0.7,
    confidence: 0.9
  });
  await submitBelief({
    agentId: charlie.agentId,
    beliefId: poolBTC.beliefId,
    prediction: 0.6,
    confidence: 0.8
  });

  // Fusion Pool beliefs
  await submitBelief({
    agentId: alice.agentId,
    beliefId: poolFusion.beliefId,
    prediction: 0.5,
    confidence: 0.6
  });
  await submitBelief({
    agentId: bob.agentId,
    beliefId: poolFusion.beliefId,
    prediction: 0.7,
    confidence: 0.8
  });
  await submitBelief({
    agentId: charlie.agentId,
    beliefId: poolFusion.beliefId,
    prediction: 0.3,
    confidence: 0.7
  });

  console.log("✓ Round 2 Complete: All beliefs submitted");

  // ===== ROUND 3: Process All Epochs =====
  console.log("Round 3: Process epochs for all pools");

  const epochResults = await Promise.all([
    processEpoch({
      beliefId: poolAI.beliefId,
      revealValue: 0.75  // Alice most accurate
    }),
    processEpoch({
      beliefId: poolBTC.beliefId,
      revealValue: 0.65  // Bob/Charlie close
    }),
    processEpoch({
      beliefId: poolFusion.beliefId,
      revealValue: 0.4  // Charlie most accurate
    })
  ]);

  // Verify zero-sum per pool
  for (const result of epochResults) {
    assert(Math.abs(result.redistribution_data.total_delta_micro) <= 1,
      "Each pool redistribution should be zero-sum");
  }

  const finalStakes = await Promise.all([
    getAgentStake(alice.agentId),
    getAgentStake(bob.agentId),
    getAgentStake(charlie.agentId)
  ]);

  const finalTotalStake = finalStakes.reduce((sum, stake) => sum + stake, 0);

  // Verify global zero-sum
  assertEquals(
    Math.abs(finalTotalStake - initialTotalStake),
    0,
    "Total system stake should be conserved across all epochs"
  );

  // Verify all stakes non-negative
  for (const stake of finalStakes) {
    assert(stake >= 0, "All stakes should remain non-negative");
  }

  console.log("✓ Round 3 Complete:", {
    aliceStakeDelta: formatUsdc(finalStakes[0] - initialStakes[0]),
    bobStakeDelta: formatUsdc(finalStakes[1] - initialStakes[1]),
    charlieStakeDelta: formatUsdc(finalStakes[2] - initialStakes[2]),
    systemStakeDelta: formatUsdc(finalTotalStake - initialTotalStake),
    zeroSumVerified: Math.abs(finalTotalStake - initialTotalStake) === 0
  });

  // ===== ROUND 4: Position Adjustments =====
  console.log("Round 4: Users adjust positions");

  // Alice increases AI position (lock replacement)
  await executeTrade({
    userId: alice.userId,
    poolAddress: poolAI.address,
    side: 'LONG',
    amount: 1_200_000_000  // Increase from $800 to $1200
  });

  // Bob closes BTC position
  const bobBtcBalance = await getTokenBalance(bob.userId, poolBTC.address, 'LONG');
  await executeTrade({
    userId: bob.userId,
    poolAddress: poolBTC.address,
    side: 'LONG',
    amount: bobBtcBalance,
    tradeType: 'sell'
  });

  // Charlie hedges AI with SHORT
  await executeTrade({
    userId: charlie.userId,
    poolAddress: poolAI.address,
    side: 'SHORT',
    amount: 300_000_000
  });

  // Verify lock changes
  const aliceLocks = await getUserLocks(alice.userId);
  const bobLocks = await getUserLocks(bob.userId);
  const charlieLocks = await getUserLocks(charlie.userId);

  // Alice: AI lock increased, others unchanged
  assertEquals(aliceLocks.byPool[poolAI.address], 24_000_000);  // 2% of $1200

  // Bob: BTC lock removed
  assert(!(poolBTC.address in bobLocks.byPool), "Bob's BTC lock should be cleared");

  // Charlie: Both LONG and SHORT in AI pool (gross aggregation)
  const charlieAILocks = aliceLocks.byPoolSide[poolAI.address];
  assert(charlieAILocks.LONG > 0 && charlieAILocks.SHORT > 0,
    "Charlie should have both LONG and SHORT locks in AI pool");

  console.log("✓ Round 4 Complete:", {
    aliceTotalLock: formatUsdc(aliceLocks.total),
    bobTotalLock: formatUsdc(bobLocks.total),
    charlieTotalLock: formatUsdc(charlieLocks.total)
  });

  console.log("✅ Scenario 6 Complete: Complex multi-pool multi-agent system validated");
});
```

## Helper Functions

```typescript
/**
 * Create user with initial USDC balance
 */
async function createUser(params: {
  username?: string;
  initialUsdc: number;
}) {
  const username = params.username || `user${crypto.randomUUID().slice(0, 6)}`;
  const agentId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const walletAddress = `Wallet${crypto.randomUUID().slice(0, 8)}`;

  await supabase.from('agents').insert({
    id: agentId,
    solana_address: walletAddress,
    total_stake: 0
  });

  await supabase.from('users').insert({
    id: userId,
    agent_id: agentId,
    username
  });

  // Fund user with USDC (simulate deposit)
  await fundUserWallet(walletAddress, params.initialUsdc);

  return { userId, agentId, walletAddress };
}

/**
 * Deploy pool with belief
 */
async function deployPoolWithBelief(params: {
  question: string;
}) {
  const beliefId = crypto.randomUUID();
  const poolAddress = `Pool${crypto.randomUUID().slice(0, 8)}`;
  const postId = crypto.randomUUID();

  await supabase.from('beliefs').insert({
    id: beliefId,
    question: params.question,
    state: 'active'
  });

  await supabase.from('posts').insert({
    id: postId,
    belief_id: beliefId,
    title: params.question,
    content: params.question
  });

  await supabase.from('pool_deployments').insert({
    belief_id: beliefId,
    pool_address: poolAddress,
    post_id: postId,
    long_mint: `Long${poolAddress}`,
    short_mint: `Short${poolAddress}`,
    transaction_signature: 'sig'
  });

  return { beliefId, poolAddress, postId };
}

/**
 * Execute trade (buy or sell)
 */
async function executeTrade(params: {
  userId: string;
  poolAddress: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  tradeType?: 'buy' | 'sell';
}) {
  // Calculate skim for buy trades
  let skimAmount = 0;
  if (params.tradeType !== 'sell') {
    const user = await supabase
      .from('users')
      .select('agent_id, agents!inner(solana_address)')
      .eq('id', params.userId)
      .single();

    const { data: skimData } = await supabase.rpc('calculate_skim_with_lock', {
      p_user_id: params.userId,
      p_wallet_address: (user.data as any).agents.solana_address,
      p_pool_address: params.poolAddress,
      p_side: params.side,
      p_trade_amount_micro: params.amount
    });

    skimAmount = skimData[0].skim_amount;
  }

  // Execute trade transaction (simplified)
  const tradeId = crypto.randomUUID();
  await supabase.from('trades').insert({
    id: tradeId,
    user_id: params.userId,
    pool_address: params.poolAddress,
    side: params.side,
    trade_type: params.tradeType || 'buy',
    token_amount: params.amount / 1000,  // Simplified
    usdc_amount: params.amount,
    transaction_signature: `sig${tradeId}`
  });

  // Update balances
  if (params.tradeType !== 'sell') {
    await upsertBalance({
      userId: params.userId,
      poolAddress: params.poolAddress,
      tokenType: params.side,
      beliefLock: Math.floor(params.amount * 0.02),
      tokenBalance: params.amount / 1000
    });
  }

  return { tradeId, skimAmount };
}

/**
 * Get user's locks breakdown
 */
async function getUserLocks(userId: string) {
  const { data: balances } = await supabase
    .from('user_pool_balances')
    .select('pool_address, token_type, belief_lock')
    .eq('user_id', userId)
    .gt('token_balance', 0);

  const byPool: Record<string, number> = {};
  const byPoolSide: Record<string, { LONG: number; SHORT: number }> = {};
  let total = 0;

  for (const balance of balances || []) {
    total += balance.belief_lock;
    byPool[balance.pool_address] = (byPool[balance.pool_address] || 0) + balance.belief_lock;

    if (!byPoolSide[balance.pool_address]) {
      byPoolSide[balance.pool_address] = { LONG: 0, SHORT: 0 };
    }
    byPoolSide[balance.pool_address][balance.token_type as 'LONG' | 'SHORT'] = balance.belief_lock;
  }

  const { data: agent } = await supabase
    .from('users')
    .select('agents!inner(total_stake)')
    .eq('id', userId)
    .single();

  const stake = (agent as any).agents.total_stake;
  const withdrawable = stake - total;

  return { total, byPool, byPoolSide, withdrawable };
}

/**
 * Format micro-USDC to USDC string
 */
function formatUsdc(microUsdc: number): string {
  return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}

/**
 * Get total system stake
 */
async function getTotalSystemStake(): Promise<number> {
  const { data } = await supabase
    .from('agents')
    .select('total_stake');

  return (data || []).reduce((sum, agent) => sum + agent.total_stake, 0);
}
```

## Success Criteria

### Critical Invariants (Must Hold Across All Scenarios)
- ✅ Zero-sum property: Total system stake conserved across all operations
- ✅ Solvency guarantee: All stakes ≥ 0 at all times
- ✅ Max loss = gross lock amount (when BTS score = -1.0)
- ✅ Lock persistence: Locks only change on trades, never on epochs

### Scenario-Specific Validations
- ✅ Lock replacement correctly reduces/increases skim amount
- ✅ LONG + SHORT gross aggregation for BTS loss calculation
- ✅ Underwater recovery possible by closing positions
- ✅ Withdrawable balance correctly reflects stake - locks

## Run Tests

```bash
# Run all end-to-end scenarios
deno test tests/protocol/end-to-end-scenarios.test.ts --allow-net --allow-env

# Run specific scenario
deno test tests/protocol/end-to-end-scenarios.test.ts --filter "Scenario 1" --allow-net --allow-env

# Run with verbose output
deno test tests/protocol/end-to-end-scenarios.test.ts --allow-net --allow-env -- --verbose
```

---

**Status:** ✅ Specification complete, ready for implementation
**Priority:** High (validates complete system integration)
**Estimated Implementation Time:** 3-4 days
**Last Updated:** 2025-01-26

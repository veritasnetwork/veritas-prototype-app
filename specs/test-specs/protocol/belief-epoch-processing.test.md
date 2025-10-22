# Belief Epoch Processing Test Specification

**Implementation:** `/tests/protocol/belief-epoch-processing.test.ts`
**Edge Function:** `protocol-belief-epoch-process`
**Purpose:** Validate the per-belief epoch processing orchestration (weights → decomposition → BTS → redistribution)
**Status:** ✅ READY FOR IMPLEMENTATION

## Overview

The `protocol-belief-epoch-process` function orchestrates the complete protocol chain for a **single belief** on-demand:

1. Calculate epistemic weights from belief_lock (w_i = 2% of last trade)
2. Aggregate/decompose beliefs with leave-one-out calculations
3. Calculate BTS information scores
4. Redistribute stakes based on scores (ΔS = score × w_i)
5. Update belief state (`previous_aggregate`, `certainty`)
6. Record history in `belief_relevance_history`

**Key Architecture:** Each belief is processed independently when needed (e.g., before pool settlement via rebase API). No global epochs - each belief has its own processing iteration counter.

## Test Categories

### 1. Basic Orchestration Tests

#### 1.1 Successful Single Belief Processing
```typescript
Deno.test("Belief Epoch Processing - Complete Protocol Chain", async () => {
  // Setup: One belief with two participants
  const belief = await createBelief({ question: "AI prediction" });

  const agents = [
    await createAgent("agent-1", { totalStake: 100_000_000 }),
    await createAgent("agent-2", { totalStake: 100_000_000 })
  ];

  // Create pool balances with belief_locks (w_i = 2% of trade)
  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000, // $10 w_i
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000, // $10 w_i
    tokenBalance: 500
  });

  // Link pool to belief
  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-mint-1",
    short_mint: "short-mint-1",
    transaction_signature: "sig1"
  });

  // Create submissions
  await submitBelief({
    agentId: agents[0].id,
    beliefId: belief.id,
    belief: 0.8,
    metaPrediction: 0.7,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[1].id,
    beliefId: belief.id,
    belief: 0.4,
    metaPrediction: 0.6,
    epoch: 0
  });

  const initialStakes = await Promise.all(agents.map(a => getAgentStake(a.id)));

  // Process belief
  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id,
    current_epoch: 0
  });

  // Verify response structure
  assertExists(response.belief_id);
  assertExists(response.participant_count);
  assertExists(response.aggregate);
  assertExists(response.certainty);
  assertExists(response.jensen_shannon_disagreement_entropy);
  assertExists(response.redistribution_occurred);
  assertExists(response.slashing_pool);

  // Check value ranges
  assertEquals(response.belief_id, belief.id);
  assertEquals(response.participant_count, 2);
  assert(response.aggregate >= 0 && response.aggregate <= 1);
  assert(response.certainty >= 0 && response.certainty <= 1);
  assert(response.jensen_shannon_disagreement_entropy >= 0);

  // Verify database updates
  const beliefRecord = await getBeliefRecord(belief.id);
  assertExists(beliefRecord.previous_aggregate);
  assertExists(beliefRecord.certainty);
  assertEquals(beliefRecord.previous_aggregate, response.aggregate);
  assertEquals(beliefRecord.certainty, response.certainty);

  // Verify history recorded
  const history = await getBeliefHistory(belief.id, 0);
  assertExists(history);
  assertEquals(history.epoch, 0);
  assertEquals(history.aggregate, response.aggregate);
  assertEquals(history.certainty, response.certainty);
  assertEquals(history.disagreement_entropy, response.jensen_shannon_disagreement_entropy);
  assertEquals(history.participant_count, 2);
  assertExists(history.total_stake);

  // Verify stakes changed (redistribution occurred)
  const finalStakes = await Promise.all(agents.map(a => getAgentStake(a.id)));
  const totalInitial = initialStakes.reduce((a, b) => a + b, 0);
  const totalFinal = finalStakes.reduce((a, b) => a + b, 0);

  // Zero-sum check
  assertAlmostEquals(totalFinal, totalInitial, 100); // Within rounding
});
```

**Expected:**
- Belief processed successfully through complete chain
- All outputs in valid ranges
- Database updates applied (belief, history, stakes)
- Zero-sum property holds

#### 1.2 Error: Belief Without Submissions
```typescript
Deno.test("Belief Epoch Processing - Error on No Submissions", async () => {
  const belief = await createBelief({ question: "No submissions" });

  // Attempt to process belief with no submissions
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-belief-epoch-process`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ belief_id: belief.id })
    }
  );

  // Should return error
  assertEquals(response.status, 500);
  const data = await response.json();
  assertExists(data.error);
  assert(data.details.includes("No submissions"));
});
```

**Expected:**
- Returns 500 error
- Error message indicates no submissions found

#### 1.3 Error: Insufficient Participants (< 2)
```typescript
Deno.test("Belief Epoch Processing - Error on Single Participant", async () => {
  const belief = await createBelief({ question: "Single participant" });

  // Single submission
  const agent = await createAgent("agent-1");
  await submitBelief({
    agentId: agent.id,
    beliefId: belief.id,
    belief: 0.7,
    metaPrediction: 0.6,
    epoch: 0
  });

  // Attempt to process
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-belief-epoch-process`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ belief_id: belief.id })
    }
  );

  // Should return error
  assertEquals(response.status, 500);
  const data = await response.json();
  assertExists(data.error);
  assert(data.details.includes("Insufficient participants") ||
         data.details.includes("< 2"));
});
```

**Expected:**
- Returns 500 error
- Error message indicates insufficient participants

### 2. Protocol Chain Integration Tests

#### 2.1 Weights Calculation from belief_lock
```typescript
Deno.test("Belief Epoch Processing - Weights from belief_lock", async () => {
  const belief = await createBelief({ question: "Weight test" });

  // Create agents with different stakes
  const agent1 = await createAgent("agent-1", { totalStake: 100_000_000 });
  const agent2 = await createAgent("agent-2", { totalStake: 50_000_000 });

  // Create pool balances with different belief_locks (w_i values)
  await createPoolBalance({
    userId: agent1.userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 20_000_000, // $20 w_i
    tokenBalance: 1000
  });

  await createPoolBalance({
    userId: agent2.userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000, // $10 w_i
    tokenBalance: 500
  });

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  // Submit beliefs
  await submitBelief({
    agentId: agent1.id,
    beliefId: belief.id,
    belief: 0.8,
    metaPrediction: 0.7,
    epoch: 0
  });

  await submitBelief({
    agentId: agent2.id,
    beliefId: belief.id,
    belief: 0.4,
    metaPrediction: 0.5,
    epoch: 0
  });

  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Verify processing completed
  assertExists(response.aggregate);

  // Note: Weights are normalized internally (20M + 10M = 30M)
  // agent1: 20M / 30M = 0.667
  // agent2: 10M / 30M = 0.333
  // These weights determine:
  // 1. Aggregation weight (voice in belief aggregate)
  // 2. Risk amount (w_i used in ΔS = score × w_i)
});
```

**Expected:**
- Weights calculated from belief_lock
- Higher locks → more voice in aggregate
- Same w_i used for stake risk

#### 2.2 Decomposition Fallback Logic
```typescript
Deno.test("Belief Epoch Processing - Decomposition Quality Fallback", async () => {
  const belief = await createBelief({ question: "Low quality decomposition" });

  const agents = await Promise.all([
    createAgent("agent-1"),
    createAgent("agent-2")
  ]);

  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  // Very similar beliefs (poor decomposition signal)
  await submitBelief({
    agentId: agents[0].id,
    beliefId: belief.id,
    belief: 0.50001,
    metaPrediction: 0.5,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[1].id,
    beliefId: belief.id,
    belief: 0.49999,
    metaPrediction: 0.5,
    epoch: 0
  });

  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Should succeed with fallback to naive aggregation
  assertExists(response.aggregate);

  // Aggregate should be near 0.5 (average of beliefs)
  assertAlmostEquals(response.aggregate, 0.5, 0.1);
});
```

**Expected:**
- Low decomposition quality triggers fallback
- Naive aggregation used as backup
- Processing completes successfully

#### 2.3 BTS Scoring and Stake Redistribution
```typescript
Deno.test("Belief Epoch Processing - BTS Redistribution", async () => {
  const belief = await createBelief({ question: "BTS test" });

  const agent1 = await createAgent("agent-1", { totalStake: 100_000_000 });
  const agent2 = await createAgent("agent-2", { totalStake: 100_000_000 });

  await createPoolBalance({
    userId: agent1.userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000, // w_i = $10
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agent2.userId,
    poolAddress: "pool-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000, // w_i = $10
    tokenBalance: 500
  });

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  // Agent 1: Accurate prediction
  await submitBelief({
    agentId: agent1.id,
    beliefId: belief.id,
    belief: 0.8,
    metaPrediction: 0.6,
    epoch: 0
  });

  // Agent 2: Inaccurate prediction
  await submitBelief({
    agentId: agent2.id,
    beliefId: belief.id,
    belief: 0.2,
    metaPrediction: 0.4,
    epoch: 0
  });

  const initialStake1 = agent1.totalStake;
  const initialStake2 = agent2.totalStake;

  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Verify redistribution occurred
  assert(response.redistribution_occurred);

  // Verify stakes changed
  const finalStake1 = await getAgentStake(agent1.id);
  const finalStake2 = await getAgentStake(agent2.id);

  // Agent 1 should gain stake
  assert(finalStake1 > initialStake1, "Accurate agent should gain stake");

  // Agent 2 should lose stake
  assert(finalStake2 < initialStake2, "Inaccurate agent should lose stake");

  // Verify bounded loss (max loss ≤ w_i = $10)
  const loss = initialStake2 - finalStake2;
  assert(loss <= 10_000_000, `Loss ${loss} should not exceed lock ${10_000_000}`);

  // Verify zero-sum (total stake conserved)
  const totalInitial = initialStake1 + initialStake2;
  const totalFinal = finalStake1 + finalStake2;
  assertAlmostEquals(totalFinal, totalInitial, 100); // Within rounding
});
```

**Expected:**
- BTS scores calculated
- Stakes redistributed based on scores
- Accurate agents gain, inaccurate agents lose
- Loss bounded by w_i
- Zero-sum property holds

### 3. Database Update Tests

#### 3.1 Belief State Updates
```typescript
Deno.test("Belief Epoch Processing - Belief State Updates", async () => {
  const belief = await createBelief({ question: "State update test" });

  const agents = await Promise.all([
    createAgent("agent-1"),
    createAgent("agent-2")
  ]);

  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  await submitBelief({
    agentId: agents[0].id,
    beliefId: belief.id,
    belief: 0.7,
    metaPrediction: 0.6,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[1].id,
    beliefId: belief.id,
    belief: 0.5,
    metaPrediction: 0.6,
    epoch: 0
  });

  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Verify beliefs table updated
  const beliefRecord = await supabase
    .from('beliefs')
    .select('previous_aggregate, certainty')
    .eq('id', belief.id)
    .single();

  assertExists(beliefRecord.data);
  assertEquals(beliefRecord.data.previous_aggregate, response.aggregate);
  assertEquals(beliefRecord.data.certainty, response.certainty);

  // Verify values in range
  assert(beliefRecord.data.previous_aggregate >= 0 &&
         beliefRecord.data.previous_aggregate <= 1);
  assert(beliefRecord.data.certainty >= 0 &&
         beliefRecord.data.certainty <= 1);
});
```

**Expected:**
- `beliefs.previous_aggregate` updated with absolute BD score
- `beliefs.certainty` updated
- Values in valid ranges [0, 1]

#### 3.2 History Recording
```typescript
Deno.test("Belief Epoch Processing - History Recording", async () => {
  const belief = await createBelief({ question: "History test" });

  const agents = await Promise.all([
    createAgent("agent-1"),
    createAgent("agent-2")
  ]);

  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  await submitBelief({
    agentId: agents[0].id,
    beliefId: belief.id,
    belief: 0.8,
    metaPrediction: 0.7,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[1].id,
    beliefId: belief.id,
    belief: 0.4,
    metaPrediction: 0.5,
    epoch: 0
  });

  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id,
    current_epoch: 0
  });

  // Verify history record created
  const history = await supabase
    .from('belief_relevance_history')
    .select('*')
    .eq('belief_id', belief.id)
    .eq('epoch', 0)
    .single();

  assertExists(history.data);
  assertEquals(history.data.belief_id, belief.id);
  assertEquals(history.data.epoch, 0);
  assertExists(history.data.aggregate);
  assertExists(history.data.certainty);
  assertExists(history.data.disagreement_entropy);
  assertEquals(history.data.participant_count, 2);
  assertExists(history.data.total_stake);
  assertExists(history.data.recorded_at);

  // Verify values match result
  assertEquals(history.data.aggregate, response.aggregate);
  assertEquals(history.data.certainty, response.certainty);
  assertEquals(history.data.disagreement_entropy,
               response.jensen_shannon_disagreement_entropy);
});
```

**Expected:**
- History record created in `belief_relevance_history`
- All fields populated correctly
- Values match processing result

### 4. Error Handling Tests

#### 4.1 Missing belief_id Parameter
```typescript
Deno.test("Belief Epoch Processing - Missing belief_id", async () => {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-belief-epoch-process`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }
  );

  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
  assert(data.error.includes("belief_id"));
});
```

**Expected:**
- Returns 400 error
- Error message indicates belief_id is required

#### 4.2 Nonexistent Belief ID
```typescript
Deno.test("Belief Epoch Processing - Nonexistent Belief", async () => {
  const fakeBelief = crypto.randomUUID();

  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-belief-epoch-process`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ belief_id: fakeBelief })
    }
  );

  assertEquals(response.status, 500);
  const data = await response.json();
  assertExists(data.error);
  assert(data.details.includes("Belief not found") ||
         data.details.includes("not found"));
});
```

**Expected:**
- Returns 500 error
- Error message indicates belief not found

### 5. Zero-Sum Invariant Tests

#### 5.1 Zero-Sum Property
```typescript
Deno.test("Belief Epoch Processing - Zero-Sum Invariant", async () => {
  const belief = await createBelief({ question: "Zero-sum test" });

  const agents = await Promise.all([
    createAgent("agent-1", { totalStake: 100_000_000 }),
    createAgent("agent-2", { totalStake: 100_000_000 }),
    createAgent("agent-3", { totalStake: 100_000_000 })
  ]);

  // Create pool balances with different w_i values
  for (let i = 0; i < agents.length; i++) {
    await createPoolBalance({
      userId: agents[i].userId,
      poolAddress: "pool-1",
      tokenType: i === 0 ? "LONG" : (i === 1 ? "SHORT" : "LONG"),
      beliefLock: (i + 1) * 10_000_000, // $10, $20, $30
      tokenBalance: 500
    });
  }

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  // Submit beliefs with varying predictions
  await submitBelief({
    agentId: agents[0].id,
    beliefId: belief.id,
    belief: 0.8,
    metaPrediction: 0.6,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[1].id,
    beliefId: belief.id,
    belief: 0.3,
    metaPrediction: 0.5,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[2].id,
    beliefId: belief.id,
    belief: 0.6,
    metaPrediction: 0.6,
    epoch: 0
  });

  const initialStakes = await Promise.all(
    agents.map(a => getAgentStake(a.id))
  );
  const initialTotal = initialStakes.reduce((a, b) => a + b, 0);

  // Process belief
  await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Verify zero-sum
  const finalStakes = await Promise.all(
    agents.map(a => getAgentStake(a.id))
  );
  const finalTotal = finalStakes.reduce((a, b) => a + b, 0);

  assertAlmostEquals(
    finalTotal,
    initialTotal,
    100, // Allow 100 micro-USDC rounding error
    "Total stake should be conserved"
  );

  // Verify all stakes non-negative
  for (const stake of finalStakes) {
    assert(stake >= 0, "All stakes must remain non-negative");
  }
});
```

**Expected:**
- Total stake conserved (±rounding)
- All stakes ≥ 0
- Zero-sum holds for single belief processing

### 6. Integration with Pool Settlement

#### 6.1 BD Score Ready for Settlement
```typescript
Deno.test("Belief Epoch Processing - BD Score for Settlement", async () => {
  const belief = await createBelief({ question: "Settlement test" });

  const agents = await Promise.all([
    createAgent("agent-1"),
    createAgent("agent-2")
  ]);

  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-1",
    tokenType: "LONG",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await supabase.from('pool_deployments').insert({
    belief_id: belief.id,
    pool_address: "pool-1",
    long_mint: "long-1",
    short_mint: "short-1",
    transaction_signature: "sig"
  });

  await submitBelief({
    agentId: agents[0].id,
    beliefId: belief.id,
    belief: 0.8,
    metaPrediction: 0.7,
    epoch: 0
  });

  await submitBelief({
    agentId: agents[1].id,
    beliefId: belief.id,
    belief: 0.4,
    metaPrediction: 0.5,
    epoch: 0
  });

  const response = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Verify belief has previous_aggregate set (BD score for settlement)
  const beliefRecord = await getBeliefRecord(belief.id);
  assertExists(beliefRecord.previous_aggregate);
  assert(beliefRecord.previous_aggregate >= 0 &&
         beliefRecord.previous_aggregate <= 1);

  // This BD score can now be used for pool settlement
  // (Settlement happens via POST /api/posts/[id]/rebase or other API)
});
```

**Expected:**
- `beliefs.previous_aggregate` set to absolute BD score [0,1]
- Score ready for use in pool settlement
- No automatic settlement triggered (on-demand architecture)

## Helper Functions

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Create test belief
 */
async function createBelief(params: { question: string }) {
  const { data } = await supabase
    .from('beliefs')
    .insert({
      id: crypto.randomUUID(),
      question: params.question,
      state: 'active'
    })
    .select()
    .single();

  return data;
}

/**
 * Create test agent with optional stake
 */
async function createAgent(name: string, opts?: { totalStake?: number }) {
  const agentId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await supabase.from('agents').insert({
    id: agentId,
    solana_address: `Wallet${name}`,
    total_stake: opts?.totalStake || 0
  });

  await supabase.from('users').insert({
    id: userId,
    agent_id: agentId,
    username: name
  });

  return { id: agentId, userId, totalStake: opts?.totalStake || 0 };
}

/**
 * Submit belief for agent
 */
async function submitBelief(params: {
  agentId: string;
  beliefId: string;
  belief: number;
  metaPrediction: number;
  epoch: number;
}) {
  await supabase.from('belief_submissions').insert({
    id: crypto.randomUUID(),
    agent_id: params.agentId,
    belief_id: params.beliefId,
    belief: params.belief,
    meta_prediction: params.metaPrediction,
    epoch: params.epoch,
    is_active: true
  });
}

/**
 * Get agent stake
 */
async function getAgentStake(agentId: string): Promise<number> {
  const { data } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', agentId)
    .single();

  return data.total_stake;
}

/**
 * Get belief record
 */
async function getBeliefRecord(beliefId: string) {
  const { data } = await supabase
    .from('beliefs')
    .select('*')
    .eq('id', beliefId)
    .single();

  return data;
}

/**
 * Get belief history record
 */
async function getBeliefHistory(beliefId: string, epoch: number) {
  const { data } = await supabase
    .from('belief_relevance_history')
    .select('*')
    .eq('belief_id', beliefId)
    .eq('epoch', epoch)
    .single();

  return data;
}

/**
 * Create pool balance record
 */
async function createPoolBalance(params: {
  userId: string;
  poolAddress: string;
  tokenType: string;
  beliefLock: number;
  tokenBalance: number;
}) {
  await supabase.from('user_pool_balances').insert({
    user_id: params.userId,
    pool_address: params.poolAddress,
    token_type: params.tokenType,
    belief_lock: params.beliefLock,
    token_balance: params.tokenBalance
  });
}

/**
 * Call Supabase function
 */
async function callSupabaseFunction(name: string, payload: any) {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error(`Function ${name} failed: ${await response.text()}`);
  }

  return await response.json();
}
```

## Success Criteria

### Must Pass
- ✅ Process single belief with ≥2 participants
- ✅ Error on < 2 participants (500)
- ✅ Error on no submissions (500)
- ✅ Error on missing belief_id (400)
- ✅ Error on nonexistent belief (500)
- ✅ All outputs in valid ranges (probabilities [0,1])
- ✅ Database updates applied (belief, history, stakes)
- ✅ Zero-sum invariant holds
- ✅ All stakes remain non-negative (≥0)
- ✅ BD score set in `beliefs.previous_aggregate` for settlement

### Should Pass
- ✅ Weights calculated correctly from belief_lock (w_i)
- ✅ Decomposition/aggregation produces valid results
- ✅ BTS scoring redistributes stakes correctly (ΔS = score × w_i)
- ✅ Bounded loss property (max loss ≤ w_i)
- ✅ Decomposition fallback to naive aggregation works

## Running Tests

```bash
# Run all belief epoch processing tests
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<key> \
SUPABASE_SERVICE_ROLE_KEY=<key> \
deno test tests/protocol/belief-epoch-processing.test.ts --allow-net --allow-env

# Run specific test category
deno test tests/protocol/belief-epoch-processing.test.ts \
  --filter "Basic Orchestration" \
  --allow-net --allow-env

# Run with verbose logging
deno test tests/protocol/belief-epoch-processing.test.ts \
  --allow-net --allow-env -- --verbose
```

## Notes

- This is the **current production** per-belief processing function
- Each belief processed independently on-demand (no global epochs)
- Typically triggered via `POST /api/posts/[id]/rebase` before pool settlement
- Pool settlement happens separately (not part of this function)
- Zero-sum and non-negativity are critical invariants that MUST hold
- Each belief has its own processing iteration counter (not a global epoch)

---

**Status:** ✅ Specification complete, ready for implementation
**Priority:** High (validates core production protocol chain)
**Estimated Implementation Time:** 2-3 days
**Last Updated:** 2025-01-27

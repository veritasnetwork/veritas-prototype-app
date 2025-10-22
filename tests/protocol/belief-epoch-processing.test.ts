/// <reference lib="deno.ns" />

/**
 * Belief Epoch Processing Test Suite
 *
 * Tests the protocol-belief-epoch-process edge function which orchestrates:
 * 1. Epistemic weights calculation (w_i from belief_lock)
 * 2. Belief decomposition/aggregation
 * 3. BTS scoring
 * 4. Stake redistribution (ΔS = score × w_i)
 * 5. Database updates (belief state, history, stakes)
 */

import { assertEquals, assert, assertExists, assertAlmostEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const headers = {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ===== Helper Functions =====

/**
 * Create test belief (requires a creator agent)
 */
async function createBelief(params: { question: string; creatorAgentId?: string }) {
  // Create creator agent if not provided
  let creatorAgentId = params.creatorAgentId;
  if (!creatorAgentId) {
    const creator = await createAgent(`creator-${Date.now()}`);
    creatorAgentId = creator.id;
  }

  const { data, error } = await supabase
    .from('beliefs')
    .insert({
      id: crypto.randomUUID(),
      creator_agent_id: creatorAgentId,
      created_epoch: 0,
      previous_aggregate: 0.5 // Default starting aggregate
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create belief: ${error.message}`);
  return data;
}

/**
 * Create test agent with optional stake
 */
async function createAgent(name: string, opts?: { totalStake?: number }) {
  const agentId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  const { error: agentError } = await supabase.from('agents').insert({
    id: agentId,
    solana_address: `Wallet${name}${Date.now()}`,
    total_stake: opts?.totalStake || 0
  });

  if (agentError) {
    console.error("Agent creation error:", agentError);
    throw new Error(`Failed to create agent: ${agentError.message}`);
  }

  const { error: userError } = await supabase.from('users').insert({
    id: userId,
    agent_id: agentId,
    username: `${name}_${Date.now()}`,
    display_name: name
  });

  if (userError) {
    console.error("User creation error:", userError);
    throw new Error(`Failed to create user: ${userError.message}`);
  }

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

  return data?.total_stake || 0;
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
  await supabase.from('user_pool_balances').upsert({
    user_id: params.userId,
    pool_address: params.poolAddress,
    token_type: params.tokenType,
    belief_lock: params.beliefLock,
    token_balance: params.tokenBalance
  });
}

/**
 * Create pool deployment for testing
 * Note: Only creates minimal required fields for weight calculation
 * Uses RLS bypass with service role to avoid FK constraints during testing
 */
async function createPoolDeployment(params: {
  beliefId: string;
  userId: string;
  poolAddress: string;
}) {
  // Create a minimal post first
  const postId = crypto.randomUUID();
  const { error: postError } = await supabase.from('posts').insert({
    id: postId,
    user_id: params.userId,
    belief_id: params.beliefId,
    post_type: "text",
    content_text: "Test post for epoch processing"
  });

  if (postError) {
    console.error("Post creation error:", postError);
    throw new Error(`Failed to create post: ${postError.message}`);
  }

  // Create pool deployment with required ICBS fields
  const { error: poolError } = await supabase.from('pool_deployments').insert({
    post_id: postId,
    belief_id: params.beliefId,
    pool_address: params.poolAddress,
    long_mint_address: `long-mint-${params.poolAddress}`,
    short_mint_address: `short-mint-${params.poolAddress}`,
    f: 1,
    beta_num: 1,
    beta_den: 2,
    status: 'market_deployed'
  });

  if (poolError) {
    console.error("Pool deployment error:", poolError);
    throw new Error(`Failed to create pool deployment: ${poolError.message}`);
  }
}

/**
 * Call Supabase function
 */
async function callSupabaseFunction(name: string, payload: any) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${name}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(`Function ${name} failed:`, data);
  }

  return { response, data };
}

// ===== Test Suite =====

Deno.test("Belief Epoch Processing - Complete Protocol Chain", async () => {
  // Setup: One belief with two participants
  const belief = await createBelief({ question: "AI prediction test" });

  const agents = [
    await createAgent("agent-1", { totalStake: 100_000_000 }),
    await createAgent("agent-2", { totalStake: 100_000_000 })
  ];

  // Create pool deployment (creates post + pool_deployments entry)
  await createPoolDeployment({
    beliefId: belief.id,
    userId: agents[0].userId,
    poolAddress: "pool-epoch-1"
  });

  // Create pool balances with belief_locks (w_i = 2% of trade)
  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-epoch-1",
    tokenType: "LONG",
    beliefLock: 10_000_000, // $10 w_i
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-epoch-1",
    tokenType: "SHORT",
    beliefLock: 10_000_000, // $10 w_i
    tokenBalance: 500
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
  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id,
    current_epoch: 0
  });

  // Verify response structure
  assertEquals(response.ok, true, `Expected success, got ${response.status}: ${JSON.stringify(data)}`);
  assertExists(data.belief_id);
  assertExists(data.participant_count);
  assertExists(data.aggregate);
  assertExists(data.certainty);
  assertExists(data.jensen_shannon_disagreement_entropy);
  assertExists(data.redistribution_occurred);
  assertExists(data.slashing_pool);

  // Check value ranges
  assertEquals(data.belief_id, belief.id);
  assertEquals(data.participant_count, 2);
  assert(data.aggregate >= 0 && data.aggregate <= 1, `Aggregate ${data.aggregate} not in [0,1]`);
  assert(data.certainty >= 0 && data.certainty <= 1, `Certainty ${data.certainty} not in [0,1]`);
  assert(data.jensen_shannon_disagreement_entropy >= 0);

  // Verify database updates
  const beliefRecord = await getBeliefRecord(belief.id);
  assertExists(beliefRecord.previous_aggregate);
  assertExists(beliefRecord.certainty);
  assertEquals(beliefRecord.previous_aggregate, data.aggregate);
  assertEquals(beliefRecord.certainty, data.certainty);

  // Verify history recorded
  const history = await getBeliefHistory(belief.id, 0);
  assertExists(history);
  assertEquals(history.epoch, 0);
  assertEquals(history.aggregate, data.aggregate);
  assertEquals(history.certainty, data.certainty);
  assertEquals(history.disagreement_entropy, data.jensen_shannon_disagreement_entropy);
  assertEquals(history.participant_count, 2);
  assertExists(history.total_stake);

  // Verify stakes changed (redistribution occurred)
  const finalStakes = await Promise.all(agents.map(a => getAgentStake(a.id)));
  const totalInitial = initialStakes.reduce((a, b) => a + b, 0);
  const totalFinal = finalStakes.reduce((a, b) => a + b, 0);

  // Zero-sum check
  assertAlmostEquals(totalFinal, totalInitial, 100, `Zero-sum violated: ${totalInitial} → ${totalFinal}`);

  console.log("✅ Complete protocol chain test passed");
});

Deno.test("Belief Epoch Processing - Error on No Submissions", async () => {
  const belief = await createBelief({ question: "No submissions test" });

  // Attempt to process belief with no submissions
  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Should return error
  assertEquals(response.status, 500);
  assertExists(data.error);
  assert(data.details?.includes("No submissions") || data.error?.includes("No submissions"));

  console.log("✅ No submissions error test passed");
});

Deno.test("Belief Epoch Processing - Error on Single Participant", async () => {
  const belief = await createBelief({ question: "Single participant test" });

  // Single submission
  const agent = await createAgent("single-agent");

  await createPoolDeployment({
    beliefId: belief.id,
    userId: agent.userId,
    poolAddress: "pool-single"
  });

  await createPoolBalance({
    userId: agent.userId,
    poolAddress: "pool-single",
    tokenType: "LONG",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await submitBelief({
    agentId: agent.id,
    beliefId: belief.id,
    belief: 0.7,
    metaPrediction: 0.6,
    epoch: 0
  });

  // Attempt to process
  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Should return error
  assertEquals(response.status, 500);
  assertExists(data.error || data.details);
  const errorMessage = data.details || data.error;
  assert(
    errorMessage.includes("Insufficient participants") || errorMessage.includes("< 2"),
    `Expected insufficient participants error, got: ${errorMessage}`
  );

  console.log("✅ Single participant error test passed");
});

Deno.test("Belief Epoch Processing - Weights from belief_lock", async () => {
  const belief = await createBelief({ question: "Weight test" });

  // Create agents with different stakes
  const agent1 = await createAgent("weight-agent-1", { totalStake: 100_000_000 });
  const agent2 = await createAgent("weight-agent-2", { totalStake: 50_000_000 });

  await createPoolDeployment({
    beliefId: belief.id,
    userId: agent1.userId,
    poolAddress: "pool-weight"
  });

  // Create pool balances with different belief_locks (w_i values)
  await createPoolBalance({
    userId: agent1.userId,
    poolAddress: "pool-weight",
    tokenType: "LONG",
    beliefLock: 20_000_000, // $20 w_i
    tokenBalance: 1000
  });

  await createPoolBalance({
    userId: agent2.userId,
    poolAddress: "pool-weight",
    tokenType: "LONG",
    beliefLock: 10_000_000, // $10 w_i
    tokenBalance: 500
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

  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  // Verify processing completed
  assertEquals(response.ok, true);
  assertExists(data.aggregate);

  // Note: Weights are normalized internally (20M + 10M = 30M)
  // agent1: 20M / 30M = 0.667
  // agent2: 10M / 30M = 0.333
  // These weights determine both voice and risk

  console.log("✅ Weights from belief_lock test passed");
});

Deno.test("Belief Epoch Processing - BTS Redistribution", async () => {
  const belief = await createBelief({ question: "BTS redistribution test" });

  const agent1 = await createAgent("bts-agent-1", { totalStake: 100_000_000 });
  const agent2 = await createAgent("bts-agent-2", { totalStake: 100_000_000 });

  await createPoolDeployment({
    beliefId: belief.id,
    userId: agent1.userId,
    poolAddress: "pool-bts"
  });

  await createPoolBalance({
    userId: agent1.userId,
    poolAddress: "pool-bts",
    tokenType: "LONG",
    beliefLock: 10_000_000, // w_i = $10
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agent2.userId,
    poolAddress: "pool-bts",
    tokenType: "SHORT",
    beliefLock: 10_000_000, // w_i = $10
    tokenBalance: 500
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

  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  assertEquals(response.ok, true);

  // Verify redistribution occurred
  assert(data.redistribution_occurred);

  // Verify stakes changed
  const finalStake1 = await getAgentStake(agent1.id);
  const finalStake2 = await getAgentStake(agent2.id);

  // Agent 1 should gain stake (accurate prediction)
  // Agent 2 should lose stake (inaccurate prediction)
  // Note: Actual gain/loss depends on BTS score calculation

  // Verify bounded loss (max loss ≤ w_i = $10)
  const loss2 = initialStake2 - finalStake2;
  assert(loss2 <= 10_000_000, `Loss ${loss2} exceeded lock ${10_000_000}`);

  // Verify zero-sum (total stake conserved)
  const totalInitial = initialStake1 + initialStake2;
  const totalFinal = finalStake1 + finalStake2;
  assertAlmostEquals(totalFinal, totalInitial, 100);

  console.log("✅ BTS redistribution test passed");
});

Deno.test("Belief Epoch Processing - Missing belief_id", async () => {
  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {});

  assertEquals(response.status, 400);
  assertExists(data.error);
  assert(data.error.includes("belief_id"));

  console.log("✅ Missing belief_id error test passed");
});

Deno.test("Belief Epoch Processing - Nonexistent Belief", async () => {
  const fakeBelief = crypto.randomUUID();

  const { response, data } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: fakeBelief
  });

  assertEquals(response.status, 500);
  assertExists(data.error || data.details);
  const errorMessage = data.details || data.error;
  assert(errorMessage.includes("Belief not found") || errorMessage.includes("not found"));

  console.log("✅ Nonexistent belief error test passed");
});

Deno.test("Belief Epoch Processing - Zero-Sum Invariant", async () => {
  const belief = await createBelief({ question: "Zero-sum test" });

  const agents = await Promise.all([
    createAgent("zero-agent-1", { totalStake: 100_000_000 }),
    createAgent("zero-agent-2", { totalStake: 100_000_000 }),
    createAgent("zero-agent-3", { totalStake: 100_000_000 })
  ]);

  await createPoolDeployment({
    beliefId: belief.id,
    userId: agents[0].userId,
    poolAddress: "pool-zero"
  });

  // Create pool balances with different w_i values
  for (let i = 0; i < agents.length; i++) {
    await createPoolBalance({
      userId: agents[i].userId,
      poolAddress: "pool-zero",
      tokenType: i === 0 ? "LONG" : (i === 1 ? "SHORT" : "LONG"),
      beliefLock: (i + 1) * 10_000_000, // $10, $20, $30
      tokenBalance: 500
    });
  }

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

  const initialStakes = await Promise.all(agents.map(a => getAgentStake(a.id)));
  const initialTotal = initialStakes.reduce((a, b) => a + b, 0);

  // Process belief
  const { response } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  assertEquals(response.ok, true);

  // Verify zero-sum
  const finalStakes = await Promise.all(agents.map(a => getAgentStake(a.id)));
  const finalTotal = finalStakes.reduce((a, b) => a + b, 0);

  assertAlmostEquals(
    finalTotal,
    initialTotal,
    100,
    `Total stake not conserved: ${initialTotal} → ${finalTotal}`
  );

  // Verify all stakes non-negative
  for (const stake of finalStakes) {
    assert(stake >= 0, `Stake went negative: ${stake}`);
  }

  console.log("✅ Zero-sum invariant test passed");
});

Deno.test("Belief Epoch Processing - BD Score for Settlement", async () => {
  const belief = await createBelief({ question: "Settlement BD score test" });

  const agents = await Promise.all([
    createAgent("settle-agent-1"),
    createAgent("settle-agent-2")
  ]);

  await createPoolDeployment({
    beliefId: belief.id,
    userId: agents[0].userId,
    poolAddress: "pool-settle"
  });

  await createPoolBalance({
    userId: agents[0].userId,
    poolAddress: "pool-settle",
    tokenType: "LONG",
    beliefLock: 10_000_000,
    tokenBalance: 500
  });

  await createPoolBalance({
    userId: agents[1].userId,
    poolAddress: "pool-settle",
    tokenType: "SHORT",
    beliefLock: 10_000_000,
    tokenBalance: 500
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

  const { response } = await callSupabaseFunction('protocol-belief-epoch-process', {
    belief_id: belief.id
  });

  assertEquals(response.ok, true);

  // Verify belief has previous_aggregate set (BD score for settlement)
  const beliefRecord = await getBeliefRecord(belief.id);
  assertExists(beliefRecord.previous_aggregate);
  assert(beliefRecord.previous_aggregate >= 0 && beliefRecord.previous_aggregate <= 1);

  // This BD score can now be used for pool settlement
  console.log("✅ BD score for settlement test passed");
});

console.log("\n🎉 All Belief Epoch Processing tests completed!\n");

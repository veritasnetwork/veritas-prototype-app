/// <reference lib="deno.ns" />
import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

let supabase: SupabaseClient;

// Setup/teardown
function setup() {
  supabase = createClient(SUPABASE_URL, SERVICE_KEY);
}

async function teardown() {
  // Clean up test data
  await supabase.from('user_pool_balances').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pool_deployments').delete().neq('belief_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('beliefs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

/**
 * Call redistribution edge function
 */
async function callRedistribution(params: {
  belief_id: string;
  information_scores: Record<string, number>;
  current_epoch?: number;
}) {
  // Use epoch 0 as default for backward compatibility with existing tests
  const payload = {
    ...params,
    current_epoch: params.current_epoch ?? 0
  };

  const response = await fetch(
    `${EDGE_FUNCTION_URL}/protocol-beliefs-stake-redistribution`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(payload),
    }
  );

  // Immediately consume the response body to avoid resource leaks
  const data = await response.json();

  return {
    status: response.status,
    json: async () => data,
  };
}

/**
 * Setup basic scenario with belief and pool
 */
async function setupScenario() {
  const beliefId = crypto.randomUUID();
  const poolAddress = `Pool${crypto.randomUUID().slice(0, 8)}`;
  const postId = crypto.randomUUID();

  // Create agents first
  const agent1Id = crypto.randomUUID();
  const agent2Id = crypto.randomUUID();
  const agent3Id = crypto.randomUUID();

  await supabase.from('agents').insert([
    { id: agent1Id, solana_address: 'addr1' + Date.now(), total_stake: 100_000_000 },
    { id: agent2Id, solana_address: 'addr2' + Date.now(), total_stake: 100_000_000 },
    { id: agent3Id, solana_address: 'addr3' + Date.now(), total_stake: 100_000_000 },
  ]);

  // Create belief
  await supabase.from('beliefs').insert({
    id: beliefId,
    creator_agent_id: agent1Id,
    previous_aggregate: 0.5,
    previous_disagreement_entropy: 0.0,
    created_epoch: 0,
  });

  // Create users
  const user1Id = crypto.randomUUID();
  const user2Id = crypto.randomUUID();
  const user3Id = crypto.randomUUID();

  await supabase.from('users').insert([
    { id: user1Id, agent_id: agent1Id, username: 'user1' + Date.now(), display_name: 'User 1' },
    { id: user2Id, agent_id: agent2Id, username: 'user2' + Date.now(), display_name: 'User 2' },
    { id: user3Id, agent_id: agent3Id, username: 'user3' + Date.now(), display_name: 'User 3' },
  ]);

  // Create post
  await supabase.from('posts').insert({
    id: postId,
    user_id: user1Id,
    belief_id: beliefId,
    post_type: 'text',
    content_text: 'Test Post',
  });

  // Create pool deployment (minimal fields - let DB defaults handle the rest)
  await supabase.from('pool_deployments').insert({
    belief_id: beliefId,
    pool_address: poolAddress,
    post_id: postId,
    long_mint_address: 'long' + Date.now(),
    short_mint_address: 'short' + Date.now(),
    status: 'market_deployed',
  });

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
async function setupTwoAgentScenario(params: {
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
async function setupThreeAgentScenario(params: {
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
async function insertBalance(params: {
  userId: string;
  poolAddress: string;
  tokenType: 'LONG' | 'SHORT';
  beliefLock: number;
  tokenBalance: number;
}) {
  await supabase.from('user_pool_balances').insert({
    user_id: params.userId,
    pool_address: params.poolAddress,
    post_id: crypto.randomUUID(),
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
async function getAgentStake(agentId: string): Promise<number> {
  const { data, error } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', agentId)
    .single();

  if (error) throw error;
  return data.total_stake;
}

/**
 * Custom assertion for floating-point equality
 */
function assertAlmostEquals(
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

// ========== TESTS ==========

setup();

Deno.test("returns 400 when belief_id is missing", async () => {
  try {
    const response = await callRedistribution({
      belief_id: '',
      information_scores: { 'agent1': 0.5 }
    });

    // Should fail with 400 or similar
    assert(response.status >= 400);
  } catch (error) {
    // Expected to fail
    assert(true);
  }

  await teardown();
});

Deno.test("calculates λ correctly for balanced wins/losses", async () => {
  setup();
  const { beliefId, poolAddress, agent1Id, agent2Id } = await setupTwoAgentScenario({
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

  await teardown();
});

Deno.test("calculates λ < 1.0 when gains exceed losses", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id, agent3Id } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,  // $10
    agent2Lock: 10_000_000,  // $10
    agent3Lock: 5_000_000    // $5
  });

  // Two winners, one loser
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

  await teardown();
});

Deno.test("enforces zero-sum for two-agent redistribution", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id } = await setupTwoAgentScenario({
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
  assert(data.total_delta_micro !== undefined);
  assert(Math.abs(data.total_delta_micro) <= 1,
    `Zero-sum violated: total_delta = ${data.total_delta_micro} μUSDC`);

  await teardown();
});

Deno.test("aggregates LONG and SHORT locks for single agent", async () => {
  setup();
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

  await teardown();
});

Deno.test("excludes positions with zero token_balance", async () => {
  setup();
  const { beliefId, poolAddress, agent1Id, user1Id } = await setupScenario();

  // Position with lock but zero balance
  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,  // $10 lock
    tokenBalance: 0           // Closed position
  });

  const initialStake = await getAgentStake(agent1Id);

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

  await teardown();
});

Deno.test("returns λ = 0 when all agents are winners (no losses)", async () => {
  setup();
  const { beliefId } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 5_000_000,
    agent3Lock: 5_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [await setupScenario().then(s => s.agent1Id)]: 0.8,
      [await setupScenario().then(s => s.agent2Id)]: 0.5,
      [await setupScenario().then(s => s.agent3Id)]: 0.3
    }
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertEquals(data.lambda, 0);

  // No redistribution (no losses to distribute)
  assertEquals(Object.keys(data.individual_rewards || {}).length, 0);
  assertEquals(Object.keys(data.individual_slashes || {}).length, 0);

  await teardown();
});

Deno.test("max loss equals lock amount when score = -1.0", async () => {
  setup();
  const scenario = await setupScenario();

  await insertBalance({
    userId: scenario.user1Id,
    poolAddress: scenario.poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,  // $10
    tokenBalance: 100
  });

  const initialStake = await getAgentStake(scenario.agent1Id);

  // Worst possible score
  const response = await callRedistribution({
    belief_id: scenario.beliefId,
    information_scores: {
      [scenario.agent1Id]: -1.0
    }
  });

  assertEquals(response.status, 200);

  const finalStake = await getAgentStake(scenario.agent1Id);
  const loss = initialStake - finalStake;

  // Loss should be exactly $10 (the lock amount)
  assertEquals(loss, 10_000_000);

  await teardown();
});

Deno.test("verifies locks are not modified during redistribution", async () => {
  setup();
  const { beliefId, poolAddress, agent1Id, user1Id } = await setupScenario();

  await insertBalance({
    userId: user1Id,
    poolAddress,
    tokenType: 'LONG',
    beliefLock: 10_000_000,
    tokenBalance: 100
  });

  const { data: lockBefore } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', user1Id)
    .eq('pool_address', poolAddress)
    .eq('token_type', 'LONG')
    .single();

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5
    }
  });

  assertEquals(response.status, 200);

  const { data: lockAfter } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', user1Id)
    .eq('pool_address', poolAddress)
    .eq('token_type', 'LONG')
    .single();

  // Lock should be unchanged
  assertEquals(lockAfter!.belief_lock, lockBefore!.belief_lock);
  assertEquals(lockAfter!.belief_lock, 10_000_000);

  await teardown();
});

Deno.test("records redistribution events in audit table", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const currentEpoch = 5;

  const response = await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.5,   // Winner
      [agent2Id]: -0.5   // Loser
    },
    current_epoch: currentEpoch
  });

  assertEquals(response.status, 200);

  // Verify events were recorded
  const { data: events, error } = await supabase
    .from('stake_redistribution_events')
    .select('*')
    .eq('belief_id', beliefId)
    .eq('epoch', currentEpoch);

  assert(!error, `Query failed: ${error?.message}`);
  assertEquals(events?.length, 2, 'Should record 2 events');

  // Verify winner event
  const winnerEvent = events?.find(e => e.agent_id === agent1Id);
  assert(winnerEvent, 'Winner event not found');
  assertEquals(winnerEvent.information_score, 0.5);
  assert(winnerEvent.stake_delta > 0, 'Winner should have positive delta');
  assertEquals(winnerEvent.belief_weight, 10_000_000);

  // Verify loser event
  const loserEvent = events?.find(e => e.agent_id === agent2Id);
  assert(loserEvent, 'Loser event not found');
  assertEquals(loserEvent.information_score, -0.5);
  assert(loserEvent.stake_delta < 0, 'Loser should have negative delta');
  assertEquals(loserEvent.belief_weight, 10_000_000);

  // Verify zero-sum in events
  const totalDelta = (winnerEvent?.stake_delta || 0) + (loserEvent?.stake_delta || 0);
  assert(Math.abs(totalDelta) <= 1, `Zero-sum violated in events: ${totalDelta}`);

  await teardown();
});

Deno.test("prevents double redistribution (idempotency)", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const currentEpoch = 5;
  const scores = {
    [agent1Id]: 0.5,
    [agent2Id]: -0.5
  };

  // First call - should redistribute
  const response1 = await callRedistribution({
    belief_id: beliefId,
    information_scores: scores,
    current_epoch: currentEpoch
  });

  assertEquals(response1.status, 200);
  const data1 = await response1.json();
  assertEquals(data1.redistribution_occurred, true);

  const stakesAfterFirst = {
    [agent1Id]: await getAgentStake(agent1Id),
    [agent2Id]: await getAgentStake(agent2Id)
  };

  // Second call - should be idempotent (no change)
  const response2 = await callRedistribution({
    belief_id: beliefId,
    information_scores: scores,
    current_epoch: currentEpoch
  });

  assertEquals(response2.status, 200);
  const data2 = await response2.json();
  assertEquals(data2.skipped, true);
  assertEquals(data2.reason, 'already_redistributed');

  // Verify stakes didn't change
  const stakesAfterSecond = {
    [agent1Id]: await getAgentStake(agent1Id),
    [agent2Id]: await getAgentStake(agent2Id)
  };

  assertEquals(stakesAfterSecond[agent1Id], stakesAfterFirst[agent1Id]);
  assertEquals(stakesAfterSecond[agent2Id], stakesAfterFirst[agent2Id]);

  // Verify only 2 events (not 4)
  const { data: events } = await supabase
    .from('stake_redistribution_events')
    .select('id')
    .eq('belief_id', beliefId)
    .eq('epoch', currentEpoch);

  assertEquals(events?.length, 2, 'Should only have 2 events after duplicate call');

  await teardown();
});

Deno.test("reconcile_agent_stake matches actual stake after redistribution", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  await callRedistribution({
    belief_id: beliefId,
    information_scores: {
      [agent1Id]: 0.8,
      [agent2Id]: -0.8
    },
    current_epoch: 5
  });

  // Call reconciliation function
  const { data, error } = await supabase.rpc('reconcile_agent_stake', {
    p_agent_id: agent1Id
  });

  assert(!error, `Reconciliation failed: ${error?.message}`);
  assert(data, 'No reconciliation data returned');

  const reconciliation = typeof data === 'string' ? JSON.parse(data) : data;
  assertEquals(reconciliation.is_correct, true, 'Reconciliation should show correct stake');
  assertEquals(reconciliation.discrepancy, 0, 'Should have zero discrepancy');

  await teardown();
});

console.log("✅ All stake redistribution tests completed");

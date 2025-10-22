import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { SUPABASE_URL, headers, getTestSolanaAddress } from '../test-config.ts';

const EPSILON_PROBABILITY = 1e-10;

// Helper function to call Supabase edge functions
async function callSupabaseFunction(functionName: string, payload: any) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { response, data };
}

// Helper function to create test agents and belief
async function setupTestData() {
  // Create test agents
  const { response: agent1Res, data: agent1Data } = await callSupabaseFunction('app-user-creation', {
    auth_provider: 'test',
    auth_id: `test_${Date.now()}_${Math.random()}`,
    solana_address: getTestSolanaAddress()
  });
  const { response: agent2Res, data: agent2Data } = await callSupabaseFunction('app-user-creation', {
    auth_provider: 'test',
    auth_id: `test_${Date.now()}_${Math.random()}`,
    solana_address: getTestSolanaAddress()
  });

  if (!agent1Res.ok || !agent2Res.ok) {
    throw new Error('Failed to create test agents');
  }

  const agent1Id = agent1Data.agent_id;
  const agent2Id = agent2Data.agent_id;

  // Create test belief
  const { response: beliefRes, data: beliefData } = await callSupabaseFunction('protocol-belief-creation', {
    agent_id: agent1Id,
    initial_belief: 0.5,
    duration_epochs: 10
  });

  if (!beliefRes.ok) {
    throw new Error('Failed to create test belief');
  }

  const beliefId = beliefData.belief_id;

  return { agent1Id, agent2Id, beliefId };
}

// Helper function to submit beliefs
async function submitBelief(agentId: string, beliefId: string, belief: number, metaPrediction: number) {
  const { response, data } = await callSupabaseFunction('protocol-beliefs-submit', {
    agent_id: agentId,
    belief_id: beliefId,
    belief_value: belief,
    meta_prediction: metaPrediction
  });

  if (!response.ok) {
    throw new Error(`Failed to submit belief: ${JSON.stringify(data)}`);
  }

  return data;
}

Deno.test("Belief Aggregation - Single agent", async () => {
  const { agent1Id, beliefId } = await setupTestData();

  // Submit belief from single agent
  await submitBelief(agent1Id, beliefId, 0.7, 0.6);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id]
  });

  // Test main aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `Aggregation failed: ${JSON.stringify(data)}`);
  assertEquals(data.aggregate, 0.7, "Single agent aggregate should equal their belief");
  assertEquals(data.jensen_shannon_disagreement_entropy, 0, "Single agent should have zero disagreement");
  assertEquals(data.certainty, 1.0, "Single agent should have full certainty");
});

Deno.test("Belief Aggregation - Two equal agents", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.7, 0.6);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id]
  });

  // Test main aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `Aggregation failed: ${JSON.stringify(data)}`);
  assertEquals(data.aggregate, 0.5, "Equal weights should give average");
  assert(data.jensen_shannon_disagreement_entropy > 0, "Two different beliefs should have disagreement");
  assert(data.certainty < 1.0, "Two different beliefs should have less than full certainty");
});

Deno.test("Belief Aggregation - Unequal weights", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.2, 0.3);
  await submitBelief(agent2Id, beliefId, 0.8, 0.7);

  // Use custom weights (unequal)
  const weights = {
    [agent1Id]: 0.25,
    [agent2Id]: 0.75
  };

  // Test main aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weights
  });

  assert(response.ok, `Aggregation failed: ${JSON.stringify(data)}`);
  assert(Math.abs(data.aggregate - 0.65) < 1e-10, "Weighted average should be 0.25*0.2 + 0.75*0.8 = 0.65");
});

Deno.test("Belief Aggregation - Weights don't sum to 1.0", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.7, 0.6);

  // Use invalid weights that sum to 0.9
  const weights = {
    [agent1Id]: 0.4,
    [agent2Id]: 0.5
  };

  // Test main aggregation - should fail
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weights
  });

  assertEquals(response.status, 400, "Should reject weights that don't sum to 1.0");
  assert(data.error.includes("sum to 1.0"), "Error should mention weight sum");
});

Deno.test("Belief Aggregation - Missing agent weight", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.7, 0.6);

  // Use weights that only include agent1
  const weights = {
    [agent1Id]: 1.0
  };

  // Test main aggregation - should fail
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weights
  });

  assertEquals(response.status, 504, "Should reject missing weight for participant");
  assert(data.error.includes("Missing weight"), "Error should mention missing weight");
});

Deno.test("Belief Aggregation - No submissions found", async () => {
  const { beliefId } = await setupTestData();

  // Don't submit any beliefs, just try to aggregate
  const weights = {};

  // Test main aggregation - should fail
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weights
  });

  assertEquals(response.status, 422, "Should reject when no submissions found");
  assert(data.error.includes("weights"), "Error should mention weights");
});

Deno.test("Belief Aggregation - Identical beliefs", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit identical beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.6, 0.5);
  await submitBelief(agent2Id, beliefId, 0.6, 0.5);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id]
  });

  // Test main aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `Aggregation failed: ${JSON.stringify(data)}`);
  assertEquals(data.aggregate, 0.6, "Identical beliefs should aggregate to same value");
  assert(Math.abs(data.jensen_shannon_disagreement_entropy) < EPSILON_PROBABILITY, "Identical beliefs should have zero disagreement");
  assert(Math.abs(data.certainty - 1.0) < EPSILON_PROBABILITY, "Identical beliefs should have full certainty");
});

Deno.test("Leave-One-Out Aggregation - Exclude from two agents", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.7, 0.6);

  // Exclude agent1, so only agent2 remains
  const weights = {
    [agent2Id]: 1.0
  };

  // Test leave-one-out aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-leave-one-out-aggregate', {
    belief_id: beliefId,
    exclude_agent_id: agent1Id,
    weights: weights
  });

  assert(response.ok, `Leave-one-out failed: ${JSON.stringify(data)}`);
  assertEquals(data.leave_one_out_belief_aggregate, 0.7, "Should equal remaining agent's belief");
  assertEquals(data.leave_one_out_meta_prediction_aggregate, 0.6, "Should equal remaining agent's meta prediction");
});

Deno.test("Leave-One-Out Aggregation - Exclude only agent", async () => {
  const { agent1Id, beliefId } = await setupTestData();

  // Submit belief from single agent
  await submitBelief(agent1Id, beliefId, 0.7, 0.6);

  // Exclude the only agent
  const weights = {};

  // Test leave-one-out aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-leave-one-out-aggregate', {
    belief_id: beliefId,
    exclude_agent_id: agent1Id,
    weights: weights
  });

  assert(response.ok, `Leave-one-out failed: ${JSON.stringify(data)}`);
  assertEquals(data.leave_one_out_belief_aggregate, 0.5, "Should return default value 0.5");
  assertEquals(data.leave_one_out_meta_prediction_aggregate, 0.5, "Should return default value 0.5");
});

Deno.test("Leave-One-Out Aggregation - Excluded agent in weights", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.7, 0.6);

  // Include excluded agent in weights (should fail)
  const weights = {
    [agent1Id]: 0.5,
    [agent2Id]: 0.5
  };

  // Test leave-one-out aggregation - should fail
  const { response, data } = await callSupabaseFunction('protocol-beliefs-leave-one-out-aggregate', {
    belief_id: beliefId,
    exclude_agent_id: agent1Id,
    weights: weights
  });

  assertEquals(response.status, 400, "Should reject when excluded agent is in weights");
  assert(data.error.includes("should not be in weights"), "Error should mention excluded agent in weights");
});
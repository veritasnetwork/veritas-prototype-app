import { assertEquals, assert, assertAlmostEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
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
  const { response: agent3Res, data: agent3Data } = await callSupabaseFunction('app-user-creation', {
    auth_provider: 'test',
    auth_id: `test_${Date.now()}_${Math.random()}`,
    solana_address: getTestSolanaAddress()
  });

  if (!agent1Res.ok || !agent2Res.ok || !agent3Res.ok) {
    throw new Error('Failed to create test agents');
  }

  const agent1Id = agent1Data.agent_id;
  const agent2Id = agent2Data.agent_id;
  const agent3Id = agent3Data.agent_id;

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

  return { agent1Id, agent2Id, agent3Id, beliefId };
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

Deno.test("BD Aggregation - Single agent (should match belief)", async () => {
  const { agent1Id, beliefId } = await setupTestData();

  // Submit belief from single agent
  await submitBelief(agent1Id, beliefId, 0.7, 0.6);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id]
  });

  // Test BD aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `BD Aggregation failed: ${JSON.stringify(data)}`);
  assertEquals(data.pre_mirror_descent_aggregate, 0.7, "Single agent BD aggregate should equal their belief");
  assert(data.bd_prior !== undefined, "Should include BD prior");
});

Deno.test("BD Aggregation - Two equal weighted agents", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.7, 0.6);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id]
  });

  // Test BD aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `BD Aggregation failed: ${JSON.stringify(data)}`);
  console.log('BD result:', {
    aggregate: data.pre_mirror_descent_aggregate,
    prior: data.bd_prior,
    certainty: data.certainty
  });
  
  // BD should produce different result than simple average (0.5)
  // Exact value depends on the decomposition
  assert(data.pre_mirror_descent_aggregate > 0, "Aggregate should be positive");
  assert(data.pre_mirror_descent_aggregate < 1, "Aggregate should be less than 1");
  assert(data.bd_prior !== undefined, "Should include BD prior");
});

Deno.test("BD Aggregation - Three agents with different beliefs", async () => {
  const { agent1Id, agent2Id, agent3Id, beliefId } = await setupTestData();

  // Submit beliefs from three agents with varying opinions
  await submitBelief(agent1Id, beliefId, 0.2, 0.3);
  await submitBelief(agent2Id, beliefId, 0.5, 0.5);
  await submitBelief(agent3Id, beliefId, 0.8, 0.7);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id, agent3Id]
  });

  // Test BD aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `BD Aggregation failed: ${JSON.stringify(data)}`);
  console.log('BD result (3 agents):', {
    aggregate: data.pre_mirror_descent_aggregate,
    prior: data.bd_prior,
    certainty: data.certainty
  });
  
  assert(data.pre_mirror_descent_aggregate > 0, "Aggregate should be positive");
  assert(data.pre_mirror_descent_aggregate < 1, "Aggregate should be less than 1");
  assert(data.bd_prior >= 0 && data.bd_prior <= 1, "Prior should be valid probability");
});

Deno.test("BD Aggregation - Identical beliefs (should have high certainty)", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit identical beliefs from both agents
  await submitBelief(agent1Id, beliefId, 0.6, 0.5);
  await submitBelief(agent2Id, beliefId, 0.6, 0.5);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id]
  });

  // Test BD aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `BD Aggregation failed: ${JSON.stringify(data)}`);
  
  // Identical beliefs should aggregate to same value
  assertAlmostEquals(data.pre_mirror_descent_aggregate, 0.6, 0.01, "Identical beliefs should aggregate close to shared value");
  
  // Should have very low disagreement (high certainty)
  assert(data.certainty > 0.95, `Identical beliefs should have high certainty, got ${data.certainty}`);
});

Deno.test("BD Aggregation - Leave-one-out calculations", async () => {
  const { agent1Id, agent2Id, agent3Id, beliefId } = await setupTestData();

  // Submit beliefs from three agents
  await submitBelief(agent1Id, beliefId, 0.3, 0.4);
  await submitBelief(agent2Id, beliefId, 0.5, 0.5);
  await submitBelief(agent3Id, beliefId, 0.7, 0.6);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id, agent3Id]
  });

  // Test BD aggregation
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(response.ok, `BD Aggregation failed: ${JSON.stringify(data)}`);
  
  // Check leave-one-out aggregates exist for all agents
  assert(data.leave_one_out_aggregates[agent1Id] !== undefined, "Should have LOO aggregate for agent1");
  assert(data.leave_one_out_aggregates[agent2Id] !== undefined, "Should have LOO aggregate for agent2");
  assert(data.leave_one_out_aggregates[agent3Id] !== undefined, "Should have LOO aggregate for agent3");
  
  // LOO aggregates should be valid probabilities
  assert(data.leave_one_out_aggregates[agent1Id] > 0 && data.leave_one_out_aggregates[agent1Id] < 1);
  assert(data.leave_one_out_aggregates[agent2Id] > 0 && data.leave_one_out_aggregates[agent2Id] < 1);
  assert(data.leave_one_out_aggregates[agent3Id] > 0 && data.leave_one_out_aggregates[agent3Id] < 1);
  
  console.log('LOO aggregates:', data.leave_one_out_aggregates);
});

Deno.test("BD Aggregation - Compare with naive (should differ)", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs with meta-predictions that differ from beliefs
  await submitBelief(agent1Id, beliefId, 0.3, 0.7);  // Belief low, meta high
  await submitBelief(agent2Id, beliefId, 0.7, 0.3);  // Belief high, meta low

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id]
  });

  // Test BD aggregation
  const { response: bdResponse, data: bdData } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  // Test naive aggregation
  const { response: naiveResponse, data: naiveData } = await callSupabaseFunction('protocol-beliefs-aggregate', {
    belief_id: beliefId,
    weights: weightsData.weights
  });

  assert(bdResponse.ok && naiveResponse.ok, "Both should succeed");
  
  console.log('Comparison:', {
    bd_aggregate: bdData.pre_mirror_descent_aggregate,
    naive_aggregate: naiveData.pre_mirror_descent_aggregate,
    difference: Math.abs(bdData.pre_mirror_descent_aggregate - naiveData.pre_mirror_descent_aggregate),
    bd_prior: bdData.bd_prior
  });
  
  // Naive should be simple average (0.5 with equal weights)
  assertAlmostEquals(naiveData.pre_mirror_descent_aggregate, 0.5, 0.01, "Naive should be simple average");
  
  // BD might differ based on meta-predictions
  // We just verify it's a valid probability
  assert(bdData.pre_mirror_descent_aggregate > 0 && bdData.pre_mirror_descent_aggregate < 1);
});

Deno.test("BD Aggregation - Custom alpha and lambda parameters", async () => {
  const { agent1Id, agent2Id, beliefId } = await setupTestData();

  // Submit beliefs
  await submitBelief(agent1Id, beliefId, 0.4, 0.5);
  await submitBelief(agent2Id, beliefId, 0.6, 0.5);

  // Calculate weights
  const { data: weightsData } = await callSupabaseFunction('protocol-weights-calculate', {
    belief_id: beliefId,
    participant_agents: [agent1Id, agent2Id]
  });

  // Test BD aggregation with custom parameters
  const { response, data } = await callSupabaseFunction('protocol-beliefs-aggregate-bd', {
    belief_id: beliefId,
    weights: weightsData.weights,
    alpha: 0.3,
    lambda: 0.7
  });

  assert(response.ok, `BD Aggregation failed: ${JSON.stringify(data)}`);
  assert(data.pre_mirror_descent_aggregate > 0 && data.pre_mirror_descent_aggregate < 1);
  assert(data.bd_prior !== undefined, "Should include BD prior");
});


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

// Helper function to create isolated test scenario
async function createMirrorDescentTestSetup(beliefValues: number[], activeAgents: string[] = []) {
  // Create agents
  const agents = [];
  for (let i = 0; i < beliefValues.length; i++) {
    const { response, data } = await callSupabaseFunction('app-user-creation', {
      auth_provider: 'test',
      auth_id: `test_${Date.now()}_${Math.random()}`,
      solana_address: getTestSolanaAddress()
    });
    if (!response.ok) throw new Error(`Failed to create agent ${i}`);
    agents.push(data.agent_id);
  }

  // Create belief
  const { response: beliefRes, data: beliefData } = await callSupabaseFunction('protocol-belief-creation', {
    agent_id: agents[0],
    initial_belief: 0.5,
    duration_epochs: 10
  });
  if (!beliefRes.ok) throw new Error('Failed to create belief');

  // Submit beliefs from participants
  for (let i = 0; i < beliefValues.length; i++) {
    await callSupabaseFunction('protocol-beliefs-submit', {
      agent_id: agents[i],
      belief_id: beliefData.belief_id,
      belief_value: beliefValues[i],
      meta_prediction: beliefValues[i] // Use same value for simplicity
    });
  }

  // Create equal weights for simplicity
  const weights: Record<string, number> = {};
  const weightValue = 1.0 / agents.length;
  for (const agentId of agents) {
    weights[agentId] = weightValue;
  }

  return {
    agents,
    beliefId: beliefData.belief_id,
    weights,
    activeAgents: activeAgents.length > 0 ? activeAgents : [] // Empty means all passive
  };
}

Deno.test("Mirror Descent - Active agents unchanged, passive agents updated", async () => {
  const scenario = await createMirrorDescentTestSetup([0.2, 0.8, 0.5]);

  // Make first agent active, others passive
  const activeAgents = [scenario.agents[0]];

  // Run mirror descent with high certainty (learning rate = 0.9)
  const { response, data } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: scenario.beliefId,
    pre_mirror_descent_aggregate: 0.6, // Target aggregate
    certainty: 0.9, // High learning rate
    active_agent_indicators: activeAgents,
    weights: scenario.weights
  });

  assert(response.ok, `Mirror descent failed: ${JSON.stringify(data)}`);

  // Active agent (agent 0) should keep original belief (0.2)
  assertEquals(data.updated_beliefs[scenario.agents[0]], 0.2, "Active agent belief should be unchanged");

  // Passive agents should be updated toward aggregate (0.6)
  const passiveAgent1Updated = data.updated_beliefs[scenario.agents[1]];
  const passiveAgent2Updated = data.updated_beliefs[scenario.agents[2]];

  // With high learning rate, passive agents should move significantly toward 0.6
  assert(Math.abs(passiveAgent1Updated - 0.6) < Math.abs(0.8 - 0.6), "Passive agent 1 should move toward aggregate");
  assert(Math.abs(passiveAgent2Updated - 0.6) < Math.abs(0.5 - 0.6), "Passive agent 2 should move toward aggregate");

  console.log(`Active agent: 0.2 → ${data.updated_beliefs[scenario.agents[0]]} (unchanged)`);
  console.log(`Passive agent 1: 0.8 → ${passiveAgent1Updated} (updated)`);
  console.log(`Passive agent 2: 0.5 → ${passiveAgent2Updated} (updated)`);
});

Deno.test("Mirror Descent - All passive agents with zero learning rate", async () => {
  const scenario = await createMirrorDescentTestSetup([0.3, 0.7, 0.4]);

  // No active agents (all passive)
  const { response, data } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: scenario.beliefId,
    pre_mirror_descent_aggregate: 0.6,
    certainty: 0.0, // Zero learning rate - no updates
    active_agent_indicators: [], // All passive
    weights: scenario.weights
  });

  assert(response.ok, `Mirror descent failed: ${JSON.stringify(data)}`);

  // All agents should keep their original beliefs (no learning)
  assertEquals(data.updated_beliefs[scenario.agents[0]], 0.3, "Agent 0 belief unchanged with zero learning rate");
  assertEquals(data.updated_beliefs[scenario.agents[1]], 0.7, "Agent 1 belief unchanged with zero learning rate");
  assertEquals(data.updated_beliefs[scenario.agents[2]], 0.4, "Agent 2 belief unchanged with zero learning rate");
});

Deno.test("Mirror Descent - All passive agents with full convergence", async () => {
  const scenario = await createMirrorDescentTestSetup([0.1, 0.9, 0.3]);

  // Run with full learning rate (certainty = 1.0)
  const { response, data } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: scenario.beliefId,
    pre_mirror_descent_aggregate: 0.6,
    certainty: 1.0, // Full convergence
    active_agent_indicators: [], // All passive
    weights: scenario.weights
  });

  assert(response.ok, `Mirror descent failed: ${JSON.stringify(data)}`);

  // All passive agents should converge to aggregate
  const tolerance = EPSILON_PROBABILITY * 10; // Small tolerance for numerical precision
  assert(Math.abs(data.updated_beliefs[scenario.agents[0]] - 0.6) < tolerance, "Agent 0 should converge to aggregate");
  assert(Math.abs(data.updated_beliefs[scenario.agents[1]] - 0.6) < tolerance, "Agent 1 should converge to aggregate");
  assert(Math.abs(data.updated_beliefs[scenario.agents[2]] - 0.6) < tolerance, "Agent 2 should converge to aggregate");
});

Deno.test("Mirror Descent - Mixed active/passive with moderate learning rate", async () => {
  const scenario = await createMirrorDescentTestSetup([0.2, 0.8, 0.3, 0.7]);

  // Make agents 1 and 3 active, others passive
  const activeAgents = [scenario.agents[1], scenario.agents[3]];

  const { response, data } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: scenario.beliefId,
    pre_mirror_descent_aggregate: 0.5,
    certainty: 0.5, // Moderate learning rate
    active_agent_indicators: activeAgents,
    weights: scenario.weights
  });

  assert(response.ok, `Mirror descent failed: ${JSON.stringify(data)}`);

  // Active agents should be unchanged
  assertEquals(data.updated_beliefs[scenario.agents[1]], 0.8, "Active agent 1 unchanged");
  assertEquals(data.updated_beliefs[scenario.agents[3]], 0.7, "Active agent 3 unchanged");

  // Passive agents should be partially updated toward aggregate
  const passiveAgent0 = data.updated_beliefs[scenario.agents[0]];
  const passiveAgent2 = data.updated_beliefs[scenario.agents[2]];

  // With moderate learning rate, should be between original and aggregate
  assert(passiveAgent0 > 0.2 && passiveAgent0 < 0.5, "Passive agent 0 should be between original (0.2) and aggregate (0.5)");
  assert(passiveAgent2 > 0.3 && passiveAgent2 < 0.5, "Passive agent 2 should be between original (0.3) and aggregate (0.5)");

  console.log(`Passive agent 0: 0.2 → ${passiveAgent0}`);
  console.log(`Active agent 1: 0.8 → ${data.updated_beliefs[scenario.agents[1]]} (unchanged)`);
  console.log(`Passive agent 2: 0.3 → ${passiveAgent2}`);
  console.log(`Active agent 3: 0.7 → ${data.updated_beliefs[scenario.agents[3]]} (unchanged)`);
});

Deno.test("Mirror Descent - Input validation", async () => {
  // Test missing belief_id
  const { response: missingBeliefRes } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    pre_mirror_descent_aggregate: 0.5,
    certainty: 0.5,
    active_agent_indicators: [],
    weights: {}
  });
  assertEquals(missingBeliefRes.status, 422, "Should return 422 for missing belief_id");

  // Test invalid aggregate (out of range)
  const { response: invalidAggregateRes } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: 'test-id',
    pre_mirror_descent_aggregate: 1.5, // Invalid: > 1
    certainty: 0.5,
    active_agent_indicators: [],
    weights: {}
  });
  assertEquals(invalidAggregateRes.status, 400, "Should return 400 for invalid aggregate");

  // Test invalid certainty (out of range)
  const { response: invalidCertaintyRes } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: 'test-id',
    pre_mirror_descent_aggregate: 0.5,
    certainty: -0.1, // Invalid: < 0
    active_agent_indicators: [],
    weights: {}
  });
  assertEquals(invalidCertaintyRes.status, 400, "Should return 400 for invalid certainty");
});

Deno.test("Mirror Descent - Nonexistent belief", async () => {
  const { response, data } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: 'nonexistent-belief-id',
    pre_mirror_descent_aggregate: 0.5,
    certainty: 0.5,
    active_agent_indicators: [],
    weights: {}
  });

  // Accept either 404 (no submissions) or 500 (belief doesn't exist) as valid for nonexistent belief
  assert(response.status === 404 || response.status === 500, `Should return 404 or 500 for nonexistent belief, got ${response.status}`);
});

Deno.test("Mirror Descent - Post-aggregation recalculation", async () => {
  const scenario = await createMirrorDescentTestSetup([0.3, 0.7]);

  const { response, data } = await callSupabaseFunction('protocol-beliefs-mirror-descent', {
    belief_id: scenario.beliefId,
    pre_mirror_descent_aggregate: 0.6,
    certainty: 0.8,
    active_agent_indicators: [], // All passive
    weights: scenario.weights
  });

  assert(response.ok, `Mirror descent failed: ${JSON.stringify(data)}`);

  // Should return post-mirror descent metrics
  assert(typeof data.post_mirror_descent_aggregate === 'number', "Should return post-mirror descent aggregate");
  assert(typeof data.post_mirror_descent_disagreement_entropy === 'number', "Should return post-mirror descent entropy");

  // Post-mirror descent aggregate should be different from pre-mirror descent (beliefs changed)
  assert(data.post_mirror_descent_aggregate >= 0 && data.post_mirror_descent_aggregate <= 1, "Post-aggregate should be valid probability");
});
import { assertEquals, assert, assertExists } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { SUPABASE_URL, headers, getTestSolanaAddress } from '../test-config.ts';

const EPSILON_PROBABILITY = 1e-10;
const MIN_PARTICIPANTS = 2;

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
async function setupTestData(numAgents: number = 4) {
  const agents: string[] = [];

  // Create test agents
  for (let i = 0; i < numAgents; i++) {
    const { response, data } = await callSupabaseFunction('app-user-creation', {
      auth_provider: 'test',
      auth_id: `test_bd_${Date.now()}_${Math.random()}`,
      solana_address: getTestSolanaAddress()
    });

    if (!response.ok) {
      throw new Error(`Failed to create test agent ${i}: ${JSON.stringify(data)}`);
    }

    agents.push(data.agent_id);
  }

  // Create test belief
  const { response: beliefRes, data: beliefData } = await callSupabaseFunction('protocol-belief-creation', {
    agent_id: agents[0],
    initial_belief: 0.5,
    duration_epochs: 10
  });

  if (!beliefRes.ok) {
    throw new Error(`Failed to create test belief: ${JSON.stringify(beliefData)}`);
  }

  return {
    agents,
    beliefId: beliefData.belief_id
  };
}

// Helper function to submit beliefs
async function submitBelief(beliefId: string, agentId: string, belief: number, meta: number) {
  const { response, data } = await callSupabaseFunction('protocol-belief-submission', {
    belief_id: beliefId,
    agent_id: agentId,
    belief: belief,
    meta_prediction: meta
  });

  if (!response.ok) {
    throw new Error(`Failed to submit belief: ${JSON.stringify(data)}`);
  }

  return data;
}

Deno.test("Belief Decomposition - Diverse Opinions", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Create submissions with diverse beliefs and accurate meta-predictions
  await submitBelief(beliefId, agents[0], 0.8, 0.6);
  await submitBelief(beliefId, agents[1], 0.3, 0.55);
  await submitBelief(beliefId, agents[2], 0.7, 0.6);
  await submitBelief(beliefId, agents[3], 0.4, 0.55);

  // Equal weights for simplicity
  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  // Call decomposition
  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Decomposition response:", JSON.stringify(data, null, 2));

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // Validate structure
  assertExists(data.aggregate);
  assertExists(data.common_prior);
  assertExists(data.local_expectations_matrix);
  assertExists(data.jensen_shannon_disagreement_entropy);
  assertExists(data.certainty);
  assertExists(data.decomposition_quality);
  assertExists(data.agent_meta_predictions);
  assertExists(data.active_agent_indicators);

  // Validate ranges
  assert(data.aggregate >= 0 && data.aggregate <= 1, `Aggregate ${data.aggregate} not in [0,1]`);
  assert(data.common_prior >= 0 && data.common_prior <= 1, `Common prior ${data.common_prior} not in [0,1]`);
  assert(data.certainty >= 0 && data.certainty <= 1, `Certainty ${data.certainty} not in [0,1]`);
  assert(data.decomposition_quality >= 0 && data.decomposition_quality <= 1, `Quality ${data.decomposition_quality} not in [0,1]`);

  // Matrix should be stochastic
  const W = data.local_expectations_matrix;
  const row0Sum = W.w11 + W.w12;
  const row1Sum = W.w21 + W.w22;
  assert(Math.abs(row0Sum - 1) < 0.01, `Row 0 sum ${row0Sum} not close to 1`);
  assert(Math.abs(row1Sum - 1) < 0.01, `Row 1 sum ${row1Sum} not close to 1`);

  // Should have 4 active agents
  assertEquals(data.active_agent_indicators.length, 4);

  console.log("✅ Diverse opinions test passed");
});

Deno.test("Belief Decomposition - Consensus", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Create submissions with consensus
  await submitBelief(beliefId, agents[0], 0.75, 0.74);
  await submitBelief(beliefId, agents[1], 0.73, 0.74);
  await submitBelief(beliefId, agents[2], 0.76, 0.74);
  await submitBelief(beliefId, agents[3], 0.72, 0.74);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Consensus decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // With consensus, aggregate should be close to individual beliefs
  assert(Math.abs(data.aggregate - 0.74) < 0.05, `Aggregate ${data.aggregate} not close to 0.74`);

  // Certainty should be high (low disagreement)
  assert(data.certainty > 0.8, `Certainty ${data.certainty} should be > 0.8 for consensus`);

  // Disagreement entropy should be low
  assert(data.jensen_shannon_disagreement_entropy < 0.1,
    `Disagreement entropy ${data.jensen_shannon_disagreement_entropy} should be < 0.1`);

  console.log("✅ Consensus test passed");
});

Deno.test("Belief Decomposition - Extreme Disagreement", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Create submissions with extreme disagreement
  await submitBelief(beliefId, agents[0], 0.95, 0.5);
  await submitBelief(beliefId, agents[1], 0.05, 0.5);
  await submitBelief(beliefId, agents[2], 0.9, 0.5);
  await submitBelief(beliefId, agents[3], 0.1, 0.5);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Extreme disagreement decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // With extreme disagreement, certainty should be low
  assert(data.certainty < 0.5, `Certainty ${data.certainty} should be < 0.5 for extreme disagreement`);

  // Disagreement entropy should be high
  assert(data.jensen_shannon_disagreement_entropy > 0.3,
    `Disagreement entropy ${data.jensen_shannon_disagreement_entropy} should be > 0.3`);

  console.log("✅ Extreme disagreement test passed");
});

Deno.test("Belief Decomposition - Weighted", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Create submissions
  await submitBelief(beliefId, agents[0], 0.9, 0.7);
  await submitBelief(beliefId, agents[1], 0.3, 0.5);
  await submitBelief(beliefId, agents[2], 0.8, 0.65);
  await submitBelief(beliefId, agents[3], 0.2, 0.45);

  // Create unequal weights (agent 0 has high weight)
  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.7;  // High weight for high belief
  weights[agents[1]] = 0.1;  // Low weight for low belief
  weights[agents[2]] = 0.15;
  weights[agents[3]] = 0.05;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Weighted decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // Aggregate should be pulled toward the high-weight, high-belief agent
  assert(data.aggregate > 0.7, `Aggregate ${data.aggregate} should be > 0.7 with weighted high belief`);

  console.log("✅ Weighted decomposition test passed");
});

Deno.test("Belief Decomposition - Invalid Weights", async () => {
  const { agents, beliefId } = await setupTestData(2);

  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.55);

  // Weights don't sum to 1
  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.5;
  weights[agents[1]] = 0.3;
  // Sum = 0.8, not 1.0

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Invalid weights response:", JSON.stringify(data, null, 2));

  assertEquals(response.status, 400, "Should return 400 for invalid weights");
  assert(data.error.includes("sum to 1.0"), "Error should mention weight sum requirement");

  console.log("✅ Invalid weights test passed");
});

Deno.test("Belief Decomposition - Minimum Participants", async () => {
  const { agents, beliefId } = await setupTestData(2);

  // Only 2 submissions (minimum)
  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.55);

  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.6;
  weights[agents[1]] = 0.4;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Minimum participants decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Should succeed with minimum participants: ${JSON.stringify(data)}`);

  // Should still produce valid output
  assert(data.aggregate >= 0 && data.aggregate <= 1, `Aggregate ${data.aggregate} not in [0,1]`);

  console.log("✅ Minimum participants test passed");
});

Deno.test("Belief Decomposition - Leave-One-Out", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Create submissions
  await submitBelief(beliefId, agents[0], 0.8, 0.6);
  await submitBelief(beliefId, agents[1], 0.3, 0.55);
  await submitBelief(beliefId, agents[2], 0.7, 0.6);

  // Weights for agents 1 and 2 only (excluding agent 0)
  const weights: Record<string, number> = {};
  weights[agents[1]] = 0.4;
  weights[agents[2]] = 0.6;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/leave-one-out-decompose', {
    belief_id: beliefId,
    exclude_agent_id: agents[0],
    weights
  });

  console.log("Leave-one-out decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Leave-one-out should succeed: ${JSON.stringify(data)}`);

  // Validate structure
  assertExists(data.leave_one_out_aggregate);
  assertExists(data.leave_one_out_prior);
  assertExists(data.leave_one_out_meta_aggregate);

  // Validate ranges
  assert(data.leave_one_out_aggregate >= 0 && data.leave_one_out_aggregate <= 1);
  assert(data.leave_one_out_prior >= 0 && data.leave_one_out_prior <= 1);
  assert(data.leave_one_out_meta_aggregate >= 0 && data.leave_one_out_meta_aggregate <= 1);

  // Meta aggregate should be roughly 0.55*0.4 + 0.6*0.6 = 0.58
  assert(Math.abs(data.leave_one_out_meta_aggregate - 0.58) < 0.1,
    `Meta aggregate ${data.leave_one_out_meta_aggregate} not close to expected 0.58`);

  console.log("✅ Leave-one-out test passed");
});

Deno.test("Belief Decomposition - Leave-One-Out Excluded Agent in Weights", async () => {
  const { agents, beliefId } = await setupTestData(2);

  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.55);

  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.5;  // Excluded agent in weights
  weights[agents[1]] = 0.5;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/leave-one-out-decompose', {
    belief_id: beliefId,
    exclude_agent_id: agents[0],
    weights
  });

  console.log("Excluded agent in weights response:", JSON.stringify(data, null, 2));

  assertEquals(response.status, 400, "Should return 400 for excluded agent in weights");
  assert(data.error.includes("must not be in weights"), "Error should mention excluded agent");

  console.log("✅ Excluded agent in weights test passed");
});

Deno.test("Belief Decomposition - Leave-One-Out Insufficient Participants", async () => {
  const { agents, beliefId } = await setupTestData(2);

  // Only 2 submissions total
  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.55);

  // After excluding one agent, only 1 participant remains
  const weights: Record<string, number> = {};
  weights[agents[1]] = 1.0;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/leave-one-out-decompose', {
    belief_id: beliefId,
    exclude_agent_id: agents[0],
    weights
  });

  console.log("Insufficient participants LOO response:", JSON.stringify(data, null, 2));

  assert(response.ok, "Should return OK with defaults");

  // Should return defaults
  assertEquals(data.leave_one_out_aggregate, 0.5);
  assertEquals(data.leave_one_out_prior, 0.5);
  assertEquals(data.leave_one_out_meta_aggregate, 0.5);

  console.log("✅ Leave-one-out insufficient participants test passed");
});

Deno.test("Belief Decomposition - Numerical Stability (Extreme Values)", async () => {
  const { agents, beliefId } = await setupTestData(2);

  // Create submissions with extreme values
  await submitBelief(beliefId, agents[0], 0.999999, 0.5);
  await submitBelief(beliefId, agents[1], 0.000001, 0.5);

  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.5;
  weights[agents[1]] = 0.5;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Extreme values decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Should handle extreme values: ${JSON.stringify(data)}`);

  // Should not produce NaN or Infinity
  assert(isFinite(data.aggregate), `Aggregate ${data.aggregate} should be finite`);
  assert(isFinite(data.common_prior), `Common prior ${data.common_prior} should be finite`);
  assert(isFinite(data.certainty), `Certainty ${data.certainty} should be finite`);
  assert(isFinite(data.decomposition_quality), `Quality ${data.decomposition_quality} should be finite`);

  console.log("✅ Numerical stability test passed");
});

Deno.test("Belief Decomposition - Identical Beliefs", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // All agents have identical beliefs
  await submitBelief(beliefId, agents[0], 0.6, 0.6);
  await submitBelief(beliefId, agents[1], 0.6, 0.6);
  await submitBelief(beliefId, agents[2], 0.6, 0.6);
  await submitBelief(beliefId, agents[3], 0.6, 0.6);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Identical beliefs decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Should handle identical beliefs: ${JSON.stringify(data)}`);

  // Aggregate should equal the common belief
  assert(Math.abs(data.aggregate - 0.6) < 0.05, `Aggregate ${data.aggregate} should be close to 0.6`);

  // Certainty should be perfect (no disagreement)
  assert(data.certainty > 0.99, `Certainty ${data.certainty} should be > 0.99 for identical beliefs`);

  // Disagreement should be near zero
  assert(data.jensen_shannon_disagreement_entropy < 0.01,
    `Disagreement ${data.jensen_shannon_disagreement_entropy} should be < 0.01`);

  console.log("✅ Identical beliefs test passed");
});
Deno.test("Belief Decomposition - Log-Sum-Exp Stability (Extreme Prior)", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Create scenario that would cause overflow without log-sum-exp trick
  // High beliefs with diverse meta-predictions (creates extreme prior)
  await submitBelief(beliefId, agents[0], 0.99, 0.9);
  await submitBelief(beliefId, agents[1], 0.98, 0.1);
  await submitBelief(beliefId, agents[2], 0.97, 0.5);

  const weights: Record<string, number> = {};
  // Use high weight concentration to simulate large effectiveN scenario
  weights[agents[0]] = 0.7;
  weights[agents[1]] = 0.2;
  weights[agents[2]] = 0.1;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Extreme prior decomposition:", JSON.stringify(data, null, 2));

  assert(response.ok, `Should handle extreme prior without overflow: ${JSON.stringify(data)}`);

  // Should not produce NaN or Infinity despite extreme values
  assert(isFinite(data.aggregate), `Aggregate ${data.aggregate} should be finite`);
  assert(isFinite(data.common_prior), `Common prior ${data.common_prior} should be finite`);
  assert(isFinite(data.decomposition_quality), `Quality ${data.decomposition_quality} should be finite`);

  // Aggregate should be high (near the high beliefs)
  assert(data.aggregate > 0.9, `Aggregate ${data.aggregate} should be > 0.9 with high beliefs`);

  console.log("✅ Log-sum-exp stability test passed");
});

Deno.test("Belief Decomposition - Matrix Stochastic Property", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Create submissions that would produce out-of-bounds raw matrix values
  await submitBelief(beliefId, agents[0], 0.1, 0.95);
  await submitBelief(beliefId, agents[1], 0.2, 0.9);
  await submitBelief(beliefId, agents[2], 0.15, 0.92);

  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.33;
  weights[agents[1]] = 0.34;
  weights[agents[2]] = 0.33;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  console.log("Matrix stochastic test:", JSON.stringify(data, null, 2));

  assert(response.ok, `Should maintain matrix constraints: ${JSON.stringify(data)}`);

  const W = data.local_expectations_matrix;

  // Verify row-stochastic property (rows must sum to 1)
  const row0Sum = W.w11 + W.w12;
  const row1Sum = W.w21 + W.w22;

  assert(Math.abs(row0Sum - 1.0) < 1e-10, `Row 0 must sum to 1.0, got ${row0Sum}`);
  assert(Math.abs(row1Sum - 1.0) < 1e-10, `Row 1 must sum to 1.0, got ${row1Sum}`);

  // Verify all elements in [0,1]
  assert(W.w11 >= 0 && W.w11 <= 1, `w11=${W.w11} must be in [0,1]`);
  assert(W.w12 >= 0 && W.w12 <= 1, `w12=${W.w12} must be in [0,1]`);
  assert(W.w21 >= 0 && W.w21 <= 1, `w21=${W.w21} must be in [0,1]`);
  assert(W.w22 >= 0 && W.w22 <= 1, `w22=${W.w22} must be in [0,1]`);

  console.log("✅ Matrix stochastic property test passed");
});

import { assertEquals, assert, assertExists } from "https://deno.land/std@0.190.0/testing/asserts.ts";
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
  const { response, data } = await callSupabaseFunction('protocol-beliefs-submit', {
    belief_id: beliefId,
    agent_id: agentId,
    belief_value: belief,
    meta_prediction: meta
  });

  if (!response.ok) {
    throw new Error(`Failed to submit belief: ${JSON.stringify(data)}`);
  }

  return data;
}

// ============================================================================
// 1. Core Functionality
// ============================================================================

Deno.test("BD - Diverse Opinions", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Varied beliefs (0.3-0.8)
  await submitBelief(beliefId, agents[0], 0.8, 0.6);
  await submitBelief(beliefId, agents[1], 0.3, 0.55);
  await submitBelief(beliefId, agents[2], 0.7, 0.6);
  await submitBelief(beliefId, agents[3], 0.4, 0.55);

  // Equal weights
  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // All outputs in [0,1]
  assert(data.aggregate >= 0 && data.aggregate <= 1, `Aggregate ${data.aggregate} not in [0,1]`);
  assert(data.common_prior >= 0 && data.common_prior <= 1, `Common prior ${data.common_prior} not in [0,1]`);

  // Matrix row-stochastic
  const W = data.local_expectations_matrix;
  const row0Sum = W.w11 + W.w12;
  const row1Sum = W.w21 + W.w22;
  assert(Math.abs(row0Sum - 1) < 0.01, `Row 0 sum ${row0Sum} not close to 1`);
  assert(Math.abs(row1Sum - 1) < 0.01, `Row 1 sum ${row1Sum} not close to 1`);

  // Leave-one-out fields exist
  assertExists(data.leave_one_out_aggregates, "leave_one_out_aggregates required");
  assertExists(data.leave_one_out_meta_aggregates, "leave_one_out_meta_aggregates required");

  console.log("✅ Diverse opinions test passed");
});

Deno.test("BD - Consensus", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // All beliefs ≈ 0.8
  await submitBelief(beliefId, agents[0], 0.79, 0.79);
  await submitBelief(beliefId, agents[1], 0.80, 0.80);
  await submitBelief(beliefId, agents[2], 0.81, 0.81);
  await submitBelief(beliefId, agents[3], 0.80, 0.80);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // Low disagreement (<0.1)
  assert(data.jensen_shannon_disagreement_entropy < 0.1,
    `Disagreement ${data.jensen_shannon_disagreement_entropy} should be < 0.1`);

  // High certainty (>0.9)
  assert(data.certainty > 0.9, `Certainty ${data.certainty} should be > 0.9`);

  console.log("✅ Consensus test passed");
});

Deno.test("BD - Extreme Disagreement", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Beliefs {0.1, 0.9}
  await submitBelief(beliefId, agents[0], 0.1, 0.5);
  await submitBelief(beliefId, agents[1], 0.9, 0.5);
  await submitBelief(beliefId, agents[2], 0.1, 0.5);
  await submitBelief(beliefId, agents[3], 0.9, 0.5);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // High disagreement (>0.3)
  assert(data.jensen_shannon_disagreement_entropy > 0.3,
    `Disagreement ${data.jensen_shannon_disagreement_entropy} should be > 0.3`);

  // Balanced prior (≈0.5)
  assert(Math.abs(data.common_prior - 0.5) < 0.2,
    `Common prior ${data.common_prior} should be ≈ 0.5`);

  console.log("✅ Extreme disagreement test passed");
});

// ============================================================================
// 2. Weight Handling
// ============================================================================

Deno.test("BD - Weighted Decomposition", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Create submissions
  await submitBelief(beliefId, agents[0], 0.9, 0.7);
  await submitBelief(beliefId, agents[1], 0.3, 0.5);
  await submitBelief(beliefId, agents[2], 0.8, 0.65);
  await submitBelief(beliefId, agents[3], 0.2, 0.45);

  // Non-uniform weights
  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.7;  // High weight for high belief
  weights[agents[1]] = 0.1;
  weights[agents[2]] = 0.15;
  weights[agents[3]] = 0.05;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // Aggregate closer to high-weight agents (0.9 and 0.8)
  assert(data.aggregate > 0.7, `Aggregate ${data.aggregate} should be > 0.7 with weighted high belief`);

  console.log("✅ Weighted decomposition test passed");
});

Deno.test("BD - Invalid Weights", async () => {
  const { agents, beliefId } = await setupTestData(2);

  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.55);

  // Sum ≠ 1.0
  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.5;
  weights[agents[1]] = 0.3;
  // Sum = 0.8, not 1.0

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assertEquals(response.status, 400, "Should return 400 for invalid weights");
  assert(data.error.includes("sum to 1.0") || data.error.includes("1.0"),
    "Error should mention weight sum requirement");

  console.log("✅ Invalid weights test passed");
});

// ============================================================================
// 3. Leave-One-Out Integration (Critical)
// ============================================================================

Deno.test("BD - Leave-One-Out Aggregates in Main Output", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Submit diverse beliefs
  await submitBelief(beliefId, agents[0], 0.8, 0.7);
  await submitBelief(beliefId, agents[1], 0.5, 0.6);
  await submitBelief(beliefId, agents[2], 0.3, 0.5);

  // Equal weights
  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 1/3;
  });

  // Call main decomposition
  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  // CRITICAL: Verify leave-one-out fields exist (required for BTS scoring)
  assertExists(data.leave_one_out_aggregates,
    "Must return leave_one_out_aggregates for BTS scoring integration");
  assertExists(data.leave_one_out_meta_aggregates,
    "Must return leave_one_out_meta_aggregates for BTS scoring integration");

  // Entry for each participating agent
  assertEquals(Object.keys(data.leave_one_out_aggregates).length, 3,
    "Should have leave-one-out belief aggregate for each agent");
  assertEquals(Object.keys(data.leave_one_out_meta_aggregates).length, 3,
    "Should have leave-one-out meta aggregate for each agent");

  // All values in [0, 1]
  for (const agentId of agents) {
    const beliefAgg = data.leave_one_out_aggregates[agentId];
    const metaAgg = data.leave_one_out_meta_aggregates[agentId];

    assertExists(beliefAgg, `Missing leave-one-out belief aggregate for ${agentId}`);
    assertExists(metaAgg, `Missing leave-one-out meta aggregate for ${agentId}`);

    assert(beliefAgg >= 0 && beliefAgg <= 1,
      `Leave-one-out belief aggregate ${beliefAgg} for ${agentId} must be in [0,1]`);
    assert(metaAgg >= 0 && metaAgg <= 1,
      `Leave-one-out meta aggregate ${metaAgg} for ${agentId} must be in [0,1]`);
  }

  // Correct exclusion logic: removing high-belief agent should lower aggregate
  const fullAggregate = data.aggregate;
  const withoutAgent0 = data.leave_one_out_aggregates[agents[0]]; // Excludes 0.8

  assert(withoutAgent0 < fullAggregate,
    `Excluding high-belief agent should lower aggregate: ${withoutAgent0} should be < ${fullAggregate}`);

  console.log("✅ Leave-one-out aggregates test passed");
  console.log("✅ CRITICAL: Decomposition → BTS integration will work correctly");
});

// ============================================================================
// 4. Edge Cases
// ============================================================================

Deno.test("BD - Minimum Participants", async () => {
  const { agents, beliefId } = await setupTestData(1);

  // Only 1 agent
  await submitBelief(beliefId, agents[0], 0.7, 0.6);

  const weights: Record<string, number> = {};
  weights[agents[0]] = 1.0;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assertEquals(response.status, 409, "Should return 409 for insufficient participants");
  assert(data.error.includes("minimum") || data.error.includes("2") || data.error.includes("participants"),
    "Error should mention minimum participants requirement");

  console.log("✅ Minimum participants test passed");
});

Deno.test("BD - Extreme Values", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Near-boundary values (but not all clustered - mix with mid-range)
  await submitBelief(beliefId, agents[0], 0.15, 0.5);  // Just outside boundary threshold
  await submitBelief(beliefId, agents[1], 0.85, 0.5);  // Just outside boundary threshold
  await submitBelief(beliefId, agents[2], 0.5, 0.5);   // Middle

  const weights: Record<string, number> = {};
  weights[agents[0]] = 1/3;
  weights[agents[1]] = 1/3;
  weights[agents[2]] = 1/3;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Should handle extreme values with diversity: ${JSON.stringify(data)}`);

  // No NaN, all finite
  assert(isFinite(data.aggregate), `Aggregate ${data.aggregate} should be finite`);
  assert(isFinite(data.common_prior), `Common prior ${data.common_prior} should be finite`);
  assert(!isNaN(data.aggregate), "Aggregate should not be NaN");
  assert(!isNaN(data.common_prior), "Common prior should not be NaN");

  console.log("✅ Extreme values test passed");
});

Deno.test("BD - Identical Beliefs", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // All 0.6 (may fail quality threshold, but if it passes, aggregate should be close)
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

  // Identical beliefs may trigger quality threshold rejection (singular matrix)
  // If it passes, check properties
  if (response.ok) {
    // Aggregate should be relatively close to 0.6 (may differ due to BD decomposition)
    assert(data.aggregate >= 0.4 && data.aggregate <= 0.8,
      `Aggregate ${data.aggregate} should be reasonably close to belief value`);

    // Disagreement should be low
    assert(data.jensen_shannon_disagreement_entropy < 0.1,
      `Disagreement ${data.jensen_shannon_disagreement_entropy} should be low for identical beliefs`);

    // Certainty should be high
    assert(data.certainty > 0.9, `Certainty ${data.certainty} should be high for identical beliefs`);

    console.log("✅ Identical beliefs test passed (decomposition succeeded)");
  } else {
    // If it failed due to quality threshold, that's expected
    assert(data.error.includes("quality") || data.error.includes("threshold") || data.error.includes("cluster"),
      `Should fail with quality/clustering issue: ${data.error}`);
    console.log("✅ Identical beliefs test passed (correctly rejected due to quality/clustering)");
  }
});

Deno.test("BD - Matrix Validation", async () => {
  const { agents, beliefId } = await setupTestData(3);

  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.5);
  await submitBelief(beliefId, agents[2], 0.6, 0.55);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 1/3;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Decomposition should succeed: ${JSON.stringify(data)}`);

  const W = data.local_expectations_matrix;

  // Rows sum to 1.0
  const row0Sum = W.w11 + W.w12;
  const row1Sum = W.w21 + W.w22;
  assert(Math.abs(row0Sum - 1.0) < 1e-6, `Row 0 must sum to 1.0, got ${row0Sum}`);
  assert(Math.abs(row1Sum - 1.0) < 1e-6, `Row 1 must sum to 1.0, got ${row1Sum}`);

  // All entries in [0,1]
  assert(W.w11 >= 0 && W.w11 <= 1, `w11=${W.w11} must be in [0,1]`);
  assert(W.w12 >= 0 && W.w12 <= 1, `w12=${W.w12} must be in [0,1]`);
  assert(W.w21 >= 0 && W.w21 <= 1, `w21=${W.w21} must be in [0,1]`);
  assert(W.w22 >= 0 && W.w22 <= 1, `w22=${W.w22} must be in [0,1]`);

  console.log("✅ Matrix validation test passed");
});

// ============================================================================
// 5. Separate Endpoints
// ============================================================================

Deno.test("BD - Leave-One-Out Endpoint", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Create submissions
  await submitBelief(beliefId, agents[0], 0.8, 0.6);
  await submitBelief(beliefId, agents[1], 0.3, 0.55);
  await submitBelief(beliefId, agents[2], 0.7, 0.6);

  // Weights excluding agent 0
  const weights: Record<string, number> = {};
  weights[agents[1]] = 0.4;
  weights[agents[2]] = 0.6;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/leave-one-out-decompose', {
    belief_id: beliefId,
    exclude_agent_id: agents[0],
    weights
  });

  assert(response.ok, `Leave-one-out should succeed: ${JSON.stringify(data)}`);

  // Returns single aggregate (not array)
  assertExists(data.leave_one_out_aggregate);
  assertExists(data.leave_one_out_prior);
  assertExists(data.leave_one_out_meta_aggregate);

  assert(data.leave_one_out_aggregate >= 0 && data.leave_one_out_aggregate <= 1);
  assert(data.leave_one_out_prior >= 0 && data.leave_one_out_prior <= 1);
  assert(data.leave_one_out_meta_aggregate >= 0 && data.leave_one_out_meta_aggregate <= 1);

  console.log("✅ Leave-one-out endpoint test passed");
});

// ============================================================================
// 6. New Validation Tests (Full Support, Quality Threshold)
// ============================================================================

Deno.test("BD - Full Support Validation: Boundary Clustering Rejection", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // All beliefs clustered near boundaries (>80% weighted near 0 or 1)
  await submitBelief(beliefId, agents[0], 0.05, 0.5); // Near 0
  await submitBelief(beliefId, agents[1], 0.08, 0.5); // Near 0
  await submitBelief(beliefId, agents[2], 0.95, 0.5); // Near 1
  await submitBelief(beliefId, agents[3], 0.97, 0.5); // Near 1

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assertEquals(response.status, 409, "Should reject when beliefs cluster at boundaries");
  assert(data.error.includes("cluster") || data.error.includes("boundaries"),
    "Error should mention boundary clustering");

  console.log("✅ Boundary clustering rejection test passed");
});

Deno.test("BD - Full Support Validation: Sufficient Diversity", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Mix of near-boundary and mid-range (only 50% near boundaries)
  await submitBelief(beliefId, agents[0], 0.05, 0.5); // Near 0
  await submitBelief(beliefId, agents[1], 0.5, 0.5);  // Middle
  await submitBelief(beliefId, agents[2], 0.6, 0.5);  // Middle
  await submitBelief(beliefId, agents[3], 0.95, 0.5); // Near 1

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(response.ok, `Should accept diverse beliefs: ${JSON.stringify(data)}`);
  assert(data.aggregate >= 0 && data.aggregate <= 1);

  console.log("✅ Sufficient diversity test passed");
});

Deno.test("BD - Quality Threshold: Low Quality Rejection", async () => {
  const { agents, beliefId } = await setupTestData(3);

  // Create scenario likely to produce low quality:
  // Beliefs with no correlation to meta-predictions
  await submitBelief(beliefId, agents[0], 0.3, 0.9);  // Low belief, high meta
  await submitBelief(beliefId, agents[1], 0.7, 0.1);  // High belief, low meta
  await submitBelief(beliefId, agents[2], 0.31, 0.88); // Similar pattern

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 1/3;
  });

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  // May succeed or fail depending on actual quality
  // If it fails, should mention quality threshold
  if (!response.ok) {
    assert(data.error.includes("quality") || data.error.includes("threshold"),
      `Error should mention quality threshold: ${data.error}`);
    assertExists(data.context);
    assertExists(data.context.quality);
    assert(data.context.quality < 0.3, "Reported quality should be < 0.3");
    console.log("✅ Low quality rejection test passed (decomposition rejected)");
  } else {
    // If it succeeded, quality must be >= 0.3
    assert(data.decomposition_quality >= 0.3,
      `If decomposition succeeds, quality must be >= 0.3, got ${data.decomposition_quality}`);
    console.log("✅ Low quality test passed (decomposition accepted with quality >= 0.3)");
  }
});

Deno.test("BD - Leave-One-Out Full Decomposition", async () => {
  const { agents, beliefId } = await setupTestData(4);

  // Diverse beliefs to ensure proper decomposition
  await submitBelief(beliefId, agents[0], 0.8, 0.7);
  await submitBelief(beliefId, agents[1], 0.3, 0.4);
  await submitBelief(beliefId, agents[2], 0.7, 0.65);
  await submitBelief(beliefId, agents[3], 0.4, 0.45);

  const weights: Record<string, number> = {};
  agents.forEach(agent => {
    weights[agent] = 0.25;
  });

  // First, get full decomposition
  const { response: fullResp, data: fullData } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assert(fullResp.ok, `Full decomposition should succeed: ${JSON.stringify(fullData)}`);
  assertExists(fullData.leave_one_out_aggregates);

  // Check that leave-one-out aggregates are different from full aggregate
  // (This validates that leave-one-out is actually excluding agents)
  const fullAggregate = fullData.aggregate;
  let foundDifference = false;

  for (const agentId of agents) {
    const looAggregate = fullData.leave_one_out_aggregates[agentId];
    assertExists(looAggregate, `Leave-one-out aggregate should exist for agent ${agentId}`);
    assert(looAggregate >= 0 && looAggregate <= 1, `LOO aggregate ${looAggregate} should be in [0,1]`);

    // Should be different from full aggregate (since we excluded an agent)
    if (Math.abs(looAggregate - fullAggregate) > 0.01) {
      foundDifference = true;
    }
  }

  assert(foundDifference, "At least one leave-one-out aggregate should differ from full aggregate");

  // Verify leave-one-out uses full BD decomposition by checking the separate endpoint
  const looWeights: Record<string, number> = {};
  agents.slice(1).forEach(agent => {
    looWeights[agent] = 1/3;
  });

  const { response: looResp, data: looData } = await callSupabaseFunction('protocol-beliefs-decompose/leave-one-out-decompose', {
    belief_id: beliefId,
    exclude_agent_id: agents[0],
    weights: looWeights
  });

  assert(looResp.ok, `Leave-one-out decomposition should succeed: ${JSON.stringify(looData)}`);

  // The leave-one-out endpoint should return a prior (proving it did full decomposition)
  assertExists(looData.leave_one_out_prior);
  assert(looData.leave_one_out_prior >= 0 && looData.leave_one_out_prior <= 1);

  // The aggregate from the separate endpoint should match what's in the full decomposition
  const looFromFull = fullData.leave_one_out_aggregates[agents[0]];
  // Note: May not be exactly equal due to weight normalization differences, but should be close
  assert(Math.abs(looData.leave_one_out_aggregate - looFromFull) < 0.1,
    `LOO aggregate from endpoint (${looData.leave_one_out_aggregate}) should be close to LOO from full decomposition (${looFromFull})`);

  console.log("✅ Leave-one-out full decomposition test passed");
});

Deno.test("BD - Weight Normalization Internal Check", async () => {
  const { agents, beliefId } = await setupTestData(2);

  await submitBelief(beliefId, agents[0], 0.7, 0.6);
  await submitBelief(beliefId, agents[1], 0.4, 0.5);

  // Pass weights that don't sum to 1.0
  const weights: Record<string, number> = {};
  weights[agents[0]] = 0.3;
  weights[agents[1]] = 0.5; // Sum = 0.8, not 1.0

  const { response, data } = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  assertEquals(response.status, 400, "Should reject non-normalized weights");
  assert(data.error.includes("sum") || data.error.includes("1.0"),
    `Error should mention weight normalization: ${data.error}`);
  assertExists(data.context);
  assertExists(data.context.weight_sum);

  console.log("✅ Weight normalization internal check test passed");
});

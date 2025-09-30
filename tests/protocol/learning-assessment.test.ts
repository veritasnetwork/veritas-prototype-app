import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { SUPABASE_URL, headers } from '../test-config.ts';

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

// Helper function to create learning assessment test setup
async function createLearningAssessmentTestSetup(initialEntropy: number = 0.5) {
  // Create agent
  const { response: agentRes, data: agentData } = await callSupabaseFunction('protocol-agent-creation', {});
  if (!agentRes.ok) throw new Error('Failed to create agent');

  // Create belief
  const { response: beliefRes, data: beliefData } = await callSupabaseFunction('protocol-belief-creation', {
    agent_id: agentData.agent_id,
    initial_belief: 0.5,
    duration_epochs: 10
  });
  if (!beliefRes.ok) throw new Error('Failed to create belief');

  // Submit belief to create submissions
  await callSupabaseFunction('protocol-beliefs-submit', {
    agent_id: agentData.agent_id,
    belief_id: beliefData.belief_id,
    belief_value: 0.6,
    meta_prediction: 0.5
  });

  // Manually set the previous disagreement entropy for the belief
  const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/beliefs?id=eq.${beliefData.belief_id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      previous_disagreement_entropy: initialEntropy
    })
  });

  if (!updateResponse.ok) {
    throw new Error('Failed to set initial entropy');
  }

  return {
    agentId: agentData.agent_id,
    beliefId: beliefData.belief_id,
    initialEntropy
  };
}

// Helper function to check active status of submissions
async function getSubmissionActiveStatus(beliefId: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${beliefId}&select=agent_id,is_active`, {
    headers
  });
  const submissions = await response.json();
  return submissions;
}

Deno.test("Learning Assessment - Learning occurred (entropy reduction)", async () => {
  const scenario = await createLearningAssessmentTestSetup(0.8); // High initial entropy

  // Run learning assessment with lower post-mirror descent entropy (learning occurred)
  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: 0.3, // Significant reduction from 0.8
    post_mirror_descent_aggregate: 0.65 // New aggregate after mirror descent
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Should detect learning occurred
  assertEquals(data.learning_occurred, true, "Should detect learning when entropy decreases significantly");
  assertEquals(data.disagreement_entropy_reduction, 0.5, "Should calculate correct entropy reduction (0.8 - 0.3)");

  // Economic learning rate should be reduction / previous_entropy = 0.5 / 0.8 = 0.625
  const expectedRate = 0.5 / 0.8;
  assert(Math.abs(data.economic_learning_rate - expectedRate) < EPSILON_PROBABILITY * 10,
    `Economic learning rate should be ${expectedRate}, got ${data.economic_learning_rate}`);

  // After epoch processing, ALL agents become passive (regardless of learning outcome)
  const submissions = await getSubmissionActiveStatus(scenario.beliefId);
  for (const submission of submissions) {
    assertEquals(submission.is_active, false, "All agents become passive after epoch processing");
  }

  console.log(`Learning detected: entropy ${scenario.initialEntropy} → ${0.3}, rate: ${data.economic_learning_rate}`);
});

Deno.test("Learning Assessment - No learning occurred (no entropy reduction)", async () => {
  const scenario = await createLearningAssessmentTestSetup(0.4); // Lower initial entropy

  // Run learning assessment with same or higher entropy (no learning)
  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: 0.45, // Slight increase from 0.4
    post_mirror_descent_aggregate: 0.55 // New aggregate after mirror descent
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Should detect no learning occurred
  assertEquals(data.learning_occurred, false, "Should detect no learning when entropy doesn't decrease significantly");
  assertEquals(data.disagreement_entropy_reduction, 0, "Should clamp negative reduction to 0");
  assertEquals(data.economic_learning_rate, 0, "Economic learning rate should be 0 when no reduction");

  // When no learning occurs, active agents should become passive
  const submissions = await getSubmissionActiveStatus(scenario.beliefId);
  for (const submission of submissions) {
    assertEquals(submission.is_active, false, "Active agents should become passive when no learning occurs");
  }

  console.log(`No learning: entropy ${scenario.initialEntropy} → ${0.45}, agents turned passive`);
});

Deno.test("Learning Assessment - Minimal learning (just above threshold)", async () => {
  const scenario = await createLearningAssessmentTestSetup(0.6);

  // Create reduction just above EPSILON_PROBABILITY threshold
  const postEntropy = 0.6 - (EPSILON_PROBABILITY * 2);

  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: postEntropy,
    post_mirror_descent_aggregate: 0.55
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Should detect learning (just above threshold)
  assertEquals(data.learning_occurred, true, "Should detect learning when reduction just exceeds threshold");
  assert(data.disagreement_entropy_reduction > EPSILON_PROBABILITY, "Reduction should be above threshold");

  // After epoch processing, all agents become passive (regardless of learning outcome)
  const submissions = await getSubmissionActiveStatus(scenario.beliefId);
  for (const submission of submissions) {
    assertEquals(submission.is_active, false, "All agents become passive after epoch processing");
  }
});

Deno.test("Learning Assessment - Just below learning threshold", async () => {
  const scenario = await createLearningAssessmentTestSetup(0.5);

  // Create reduction just below EPSILON_PROBABILITY threshold
  const postEntropy = 0.5 - (EPSILON_PROBABILITY / 2);

  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: postEntropy,
    post_mirror_descent_aggregate: 0.55
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Should detect no learning (below threshold)
  assertEquals(data.learning_occurred, false, "Should detect no learning when reduction is below threshold");

  // Active agents should become passive
  const submissions = await getSubmissionActiveStatus(scenario.beliefId);
  for (const submission of submissions) {
    assertEquals(submission.is_active, false, "Active agents should become passive when reduction below threshold");
  }
});

Deno.test("Learning Assessment - First epoch (near-zero previous entropy)", async () => {
  const scenario = await createLearningAssessmentTestSetup(EPSILON_PROBABILITY / 2); // Near zero

  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: 0.3,
    post_mirror_descent_aggregate: 0.5
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Should handle first epoch case
  assertEquals(data.economic_learning_rate, 0.0, "Economic learning rate should be 0 for near-zero previous entropy");
  assertEquals(data.learning_occurred, false, "Should detect no learning for first epoch");

  console.log(`First epoch case: previous=${scenario.initialEntropy}, post=0.3, rate=${data.economic_learning_rate}`);
});

Deno.test("Learning Assessment - Perfect learning (full entropy reduction)", async () => {
  const scenario = await createLearningAssessmentTestSetup(0.9); // High initial entropy

  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: 0.0, // Complete reduction
    post_mirror_descent_aggregate: 0.6
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Should handle perfect learning
  assertEquals(data.learning_occurred, true, "Should detect learning for complete entropy reduction");
  assertEquals(data.disagreement_entropy_reduction, 0.9, "Should calculate full entropy reduction");
  assertEquals(data.economic_learning_rate, 1.0, "Economic learning rate should be 1.0 for complete reduction");

  console.log(`Perfect learning: entropy 0.9 → 0.0, rate: ${data.economic_learning_rate}`);
});

Deno.test("Learning Assessment - Belief state update", async () => {
  const scenario = await createLearningAssessmentTestSetup(0.7);
  const newEntropy = 0.4;

  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: scenario.beliefId,
    post_mirror_descent_disagreement_entropy: newEntropy,
    post_mirror_descent_aggregate: 0.6
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);

  // Verify belief state was updated
  const beliefResponse = await fetch(`${SUPABASE_URL}/rest/v1/beliefs?id=eq.${scenario.beliefId}&select=previous_disagreement_entropy`, {
    headers
  });
  const beliefs = await beliefResponse.json();

  assertEquals(beliefs.length, 1, "Should find the belief");
  assertEquals(beliefs[0].previous_disagreement_entropy, newEntropy, "Should update belief's previous entropy");
});

Deno.test("Learning Assessment - Input validation", async () => {
  // Test missing belief_id
  const { response: missingBeliefRes } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    post_mirror_descent_disagreement_entropy: 0.5
  });
  assertEquals(missingBeliefRes.status, 422, "Should return 422 for missing belief_id");

  // Test invalid entropy (out of range)
  const { response: invalidEntropyRes } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: 'test-id',
    post_mirror_descent_disagreement_entropy: 1.5 // Invalid: > 1
  });
  assertEquals(invalidEntropyRes.status, 400, "Should return 400 for invalid entropy");

  // Test negative entropy
  const { response: negativeEntropyRes } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: 'test-id',
    post_mirror_descent_disagreement_entropy: -0.1 // Invalid: < 0
  });
  assertEquals(negativeEntropyRes.status, 400, "Should return 400 for negative entropy");
});

Deno.test("Learning Assessment - Nonexistent belief", async () => {
  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: 'nonexistent-belief-id',
    post_mirror_descent_disagreement_entropy: 0.5,
    post_mirror_descent_aggregate: 0.6
  });

  assertEquals(response.status, 404, "Should return 404 for nonexistent belief");
});

Deno.test("Learning Assessment - Multiple active agents become passive", async () => {
  // Create multiple agents for this test
  const agents = [];
  for (let i = 0; i < 3; i++) {
    const { response, data } = await callSupabaseFunction('protocol-agent-creation', {});
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

  // Submit beliefs from all agents (all become active)
  for (let i = 0; i < agents.length; i++) {
    await callSupabaseFunction('protocol-beliefs-submit', {
      agent_id: agents[i],
      belief_id: beliefData.belief_id,
      belief_value: 0.3 + (i * 0.2), // Different beliefs
      meta_prediction: 0.5
    });
  }

  // Set initial entropy
  await fetch(`${SUPABASE_URL}/rest/v1/beliefs?id=eq.${beliefData.belief_id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      previous_disagreement_entropy: 0.6
    })
  });

  // Run learning assessment with no learning
  const { response, data } = await callSupabaseFunction('protocol-beliefs-learning-assessment', {
    belief_id: beliefData.belief_id,
    post_mirror_descent_disagreement_entropy: 0.65, // Slight increase = no learning
    post_mirror_descent_aggregate: 0.55
  });

  assert(response.ok, `Learning assessment failed: ${JSON.stringify(data)}`);
  assertEquals(data.learning_occurred, false, "Should detect no learning");

  // All agents should become passive
  const submissions = await getSubmissionActiveStatus(beliefData.belief_id);
  assertEquals(submissions.length, 3, "Should have 3 submissions");

  for (const submission of submissions) {
    assertEquals(submission.is_active, false, `Agent ${submission.agent_id} should be passive`);
  }

  console.log(`Multiple agents test: all 3 agents turned passive when no learning occurred`);
});
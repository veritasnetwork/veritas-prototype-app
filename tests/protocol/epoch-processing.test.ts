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

// Helper function to get current epoch
async function getCurrentEpoch() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/system_config?key=eq.current_epoch&select=value`, {
    headers
  });
  const data = await response.json();
  return parseInt(data[0]?.value || '0');
}

// Helper function to create isolated test scenario
// Note: durationEpochs represents minute-aligned epochs (minimum 1 = 60 seconds)
async function createIsolatedBelief(participantCount: number, beliefValues: number[], metaPredictions: number[], durationEpochs: number = 10) {
  // Create agents
  const agents = [];
  for (let i = 0; i < participantCount; i++) {
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
    duration_epochs: durationEpochs
  });
  if (!beliefRes.ok) throw new Error('Failed to create belief');

  // Submit beliefs from participants
  for (let i = 0; i < participantCount && i < beliefValues.length; i++) {
    await callSupabaseFunction('protocol-beliefs-submit', {
      agent_id: agents[i],
      belief_id: beliefData.belief_id,
      belief_value: beliefValues[i],
      meta_prediction: metaPredictions[i] || beliefValues[i]
    });
  }

  return {
    agents,
    beliefId: beliefData.belief_id,
    beliefValues,
    metaPredictions: metaPredictions.length > 0 ? metaPredictions : beliefValues
  };
}

Deno.test("Epoch Processing - Process qualifying belief", async () => {
  // Setup: Create belief with 3 participants, different belief values
  const scenario = await createIsolatedBelief(3, [0.2, 0.8, 0.5], [0.3, 0.7, 0.5]);
  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  // Find our processed belief
  const processedBelief = data.processed_beliefs.find(b => b.belief_id === scenario.beliefId);

  // Expected: belief_id in processed_beliefs, aggregate within bounds, weights sum to 1.0
  assert(processedBelief, "Qualifying belief should be processed");
  assertEquals(processedBelief.participant_count, 3, "Should have 3 participants");

  // Validate aggregate bounds: min(0.2, 0.8, 0.5) ≤ aggregate ≤ max(0.2, 0.8, 0.5)
  assert(processedBelief.pre_mirror_descent_aggregate >= 0.2, "Aggregate should be >= minimum belief");
  assert(processedBelief.pre_mirror_descent_aggregate <= 0.8, "Aggregate should be <= maximum belief");

  // Validate weights sum to 1.0
  const weightsSum = Object.values(processedBelief.weights).reduce((sum, weight) => sum + weight, 0);
  assert(Math.abs(weightsSum - 1.0) < EPSILON_PROBABILITY, "Weights should sum to 1.0");
});

Deno.test("Epoch Processing - Skip insufficient participants", async () => {
  // Setup: Create belief with 1 participant
  const scenario = await createIsolatedBelief(1, [0.7], [0.6]);
  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  // Expected: belief_id NOT in processed_beliefs, no errors
  const processedBelief = data.processed_beliefs.find(b => b.belief_id === scenario.beliefId);
  assertEquals(processedBelief, undefined, "Insufficient participant belief should not be processed");
});

Deno.test("Epoch Processing - Skip beliefs with no submissions", async () => {
  // Setup: Create belief but submit no current-epoch submissions
  const agents = [];
  for (let i = 0; i < 2; i++) {
    const { response, data } = await callSupabaseFunction('app-user-creation', {
      auth_provider: 'test',
      auth_id: `test_${Date.now()}_${Math.random()}`,
      solana_address: getTestSolanaAddress()
    });
    if (!response.ok) throw new Error(`Failed to create agent ${i}`);
    agents.push(data.agent_id);
  }

  const { response: beliefRes, data: beliefData } = await callSupabaseFunction('protocol-belief-creation', {
    agent_id: agents[0],
    initial_belief: 0.5,
    duration_epochs: 10
  });
  if (!beliefRes.ok) throw new Error('Failed to create belief');

  // Don't submit any beliefs for current epoch
  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  // Expected: belief_id NOT in processed_beliefs, skipped gracefully
  const processedBelief = data.processed_beliefs.find(b => b.belief_id === beliefData.belief_id);
  assertEquals(processedBelief, undefined, "Belief with no submissions should not be processed");
});

Deno.test("Epoch Processing - Epoch increment", async () => {
  // Setup: Record initial epoch N
  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  // Expected: response.next_epoch = N+1, global epoch updated to N+1
  assertEquals(data.next_epoch, initialEpoch + 1, "Next epoch should be incremented");

  // Verify global epoch was updated
  const newGlobalEpoch = await getCurrentEpoch();
  assertEquals(newGlobalEpoch, initialEpoch + 1, "Global epoch should be updated");
});

Deno.test("Epoch Processing - Expire qualifying beliefs", async () => {
  // Setup: Create belief with short duration that will expire
  const scenario = await createIsolatedBelief(2, [0.3, 0.7], [0.4, 0.6], 1); // 1 epoch duration
  const initialEpoch = await getCurrentEpoch();

  // First, advance epoch so belief will expire
  await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  // Now process again - belief should be expired
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch + 1
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  // Expected: belief_id in expired_beliefs, belief completely deleted
  assert(data.expired_beliefs.includes(scenario.beliefId), "Expired belief should be in expired list");
});

Deno.test("Epoch Processing - Weight normalization", async () => {
  // Setup: Belief with agents having different stakes
  const { response: agent1Res, data: agent1Data } = await callSupabaseFunction('app-user-creation', {
    auth_provider: 'test',
    auth_id: `test_${Date.now()}_${Math.random()}`,
    solana_address: getTestSolanaAddress(),
    initial_stake: 100
  });
  const { response: agent2Res, data: agent2Data } = await callSupabaseFunction('app-user-creation', {
    auth_provider: 'test',
    auth_id: `test_${Date.now()}_${Math.random()}`,
    solana_address: getTestSolanaAddress(),
    initial_stake: 200
  });
  const { response: agent3Res, data: agent3Data } = await callSupabaseFunction('app-user-creation', {
    auth_provider: 'test',
    auth_id: `test_${Date.now()}_${Math.random()}`,
    solana_address: getTestSolanaAddress(),
    initial_stake: 50
  });

  assert(agent1Res.ok && agent2Res.ok && agent3Res.ok, "Agent creation should succeed");

  const { response: beliefRes, data: beliefData } = await callSupabaseFunction('protocol-belief-creation', {
    agent_id: agent1Data.agent_id,
    initial_belief: 0.5,
    duration_epochs: 10
  });
  assert(beliefRes.ok, "Belief creation should succeed");

  // Submit beliefs from all agents
  await callSupabaseFunction('protocol-beliefs-submit', {
    agent_id: agent1Data.agent_id,
    belief_id: beliefData.belief_id,
    belief_value: 0.4,
    meta_prediction: 0.4
  });
  await callSupabaseFunction('protocol-beliefs-submit', {
    agent_id: agent2Data.agent_id,
    belief_id: beliefData.belief_id,
    belief_value: 0.6,
    meta_prediction: 0.6
  });
  await callSupabaseFunction('protocol-beliefs-submit', {
    agent_id: agent3Data.agent_id,
    belief_id: beliefData.belief_id,
    belief_value: 0.5,
    meta_prediction: 0.5
  });

  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  const processedBelief = data.processed_beliefs.find(b => b.belief_id === beliefData.belief_id);
  assert(processedBelief, "Should have processed belief");

  // Expected: weights reflect stake proportions, sum exactly 1.0
  const weightsSum = Object.values(processedBelief.weights).reduce((sum, weight) => sum + weight, 0);
  assert(Math.abs(weightsSum - 1.0) < EPSILON_PROBABILITY, "Weights should sum to 1.0");

  // Agent with higher stake should have higher weight
  const agent2Weight = processedBelief.weights[agent2Data.agent_id];
  const agent1Weight = processedBelief.weights[agent1Data.agent_id];
  const agent3Weight = processedBelief.weights[agent3Data.agent_id];

  assert(agent2Weight > agent1Weight, "Agent with higher stake should have higher weight");
  assert(agent1Weight > agent3Weight, "Agent with higher stake should have higher weight");
});

Deno.test("Epoch Processing - Aggregate bounds validation", async () => {
  // Setup: Participants with beliefs [0.2, 0.8, 0.5]
  const scenario = await createIsolatedBelief(3, [0.2, 0.8, 0.5], [0.3, 0.7, 0.6]);
  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(response.ok, `Epoch processing failed: ${JSON.stringify(data)}`);

  const processedBelief = data.processed_beliefs.find(b => b.belief_id === scenario.beliefId);
  assert(processedBelief, "Should have processed belief");

  // Expected: 0.2 ≤ aggregate ≤ 0.8
  assert(processedBelief.pre_mirror_descent_aggregate >= 0.2, "Aggregate should be >= minimum belief (0.2)");
  assert(processedBelief.pre_mirror_descent_aggregate <= 0.8, "Aggregate should be <= maximum belief (0.8)");
});

Deno.test("Epoch Processing - Certainty computation", async () => {
  // Test 1: Participants with identical beliefs (consensus)
  const consensusScenario = await createIsolatedBelief(3, [0.6, 0.6, 0.6], [0.5, 0.5, 0.5]);
  const initialEpoch = await getCurrentEpoch();

  const { response: consensusResponse, data: consensusData } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  assert(consensusResponse.ok, "Consensus epoch processing should succeed");

  const consensusBelief = consensusData.processed_beliefs.find(b => b.belief_id === consensusScenario.beliefId);
  assert(consensusBelief, "Should have processed consensus belief");

  // Expected: certainty close to 1.0 for identical beliefs
  assert(consensusBelief.certainty > 0.9, "Consensus should have high certainty");

  // Test 2: Participants with diverse beliefs (disagreement)
  const diverseScenario = await createIsolatedBelief(3, [0.1, 0.5, 0.9], [0.2, 0.6, 0.8]);
  const currentEpoch = await getCurrentEpoch();

  const { response: diverseResponse, data: diverseData } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: currentEpoch
  });

  assert(diverseResponse.ok, "Diverse epoch processing should succeed");

  const diverseBelief = diverseData.processed_beliefs.find(b => b.belief_id === diverseScenario.beliefId);
  assert(diverseBelief, "Should have processed diverse belief");

  // Expected: certainty significantly < 1.0 for diverse beliefs
  assert(diverseBelief.certainty < consensusBelief.certainty, "Diverse beliefs should have lower certainty than consensus");
});

Deno.test("Epoch Processing - Empty database state", async () => {
  // Get current epoch without creating any new beliefs
  const initialEpoch = await getCurrentEpoch();

  // Execute epoch processing on potentially empty state
  const { response, data } = await callSupabaseFunction('protocol-epochs-process', {
    current_epoch: initialEpoch
  });

  // Expected: processed_beliefs=[], epoch incremented
  assert(response.ok, `Epoch processing should handle empty state: ${JSON.stringify(data)}`);
  assertEquals(data.next_epoch, initialEpoch + 1, "Epoch should increment even with no beliefs");

  // processed_beliefs and expired_beliefs can be empty or contain existing beliefs - both are valid
  assert(Array.isArray(data.processed_beliefs), "processed_beliefs should be an array");
  assert(Array.isArray(data.expired_beliefs), "expired_beliefs should be an array");
});

// Active Status Consistency Tests

Deno.test('Epoch Processing - Active Status: Fresh Submission Should Be Active', async () => {
  const scenario = await createIsolatedBelief(2, [0.6, 0.4], [0.5, 0.5]);
  const currentEpoch = await getCurrentEpoch();

  // Check submission is active and in current epoch
  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${scenario.beliefId}`, {
    headers
  });
  const submissions = await response.json();

  assertEquals(submissions.length, 2, 'Should have exactly two submissions');

  // All fresh submissions should be active and in current epoch
  for (const submission of submissions) {
    assertEquals(submission.epoch, currentEpoch, 'Submission epoch should match current epoch');
    assertEquals(submission.is_active, true, 'Fresh submission should be active');
  }
});

Deno.test('Epoch Processing - Active Status: Old Epoch Submissions Should Not Be Active', async () => {
  const scenario = await createIsolatedBelief(2, [0.6, 0.4], [0.5, 0.5]);
  let currentEpoch = await getCurrentEpoch();

  // Process epoch (advance to next epoch)
  await callSupabaseFunction('protocol-epochs-process', { current_epoch: currentEpoch });
  currentEpoch = await getCurrentEpoch();

  // Check submission status after epoch advance
  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${scenario.beliefId}`, {
    headers
  });
  const submissions = await response.json();

  assertEquals(submissions.length, 2, 'Should still have the submissions');

  for (const submission of submissions) {
    // CRITICAL TEST: If submission epoch < current epoch AND is_active = true, this is INVALID
    if (submission.epoch < currentEpoch && submission.is_active === true) {
      throw new Error(
        `INVALID STATE DETECTED: Submission from epoch ${submission.epoch} is still active in epoch ${currentEpoch}. ` +
        `Active submissions from previous epochs should be turned passive by learning assessment.`
      );
    }

    // Valid states:
    // 1. submission.epoch = currentEpoch && is_active = true (fresh submission)
    // 2. submission.epoch < currentEpoch && is_active = false (old submission turned passive)

    if (submission.epoch < currentEpoch) {
      assertEquals(submission.is_active, false,
        `Submission from previous epoch ${submission.epoch} should be passive in current epoch ${currentEpoch}`);
    }
  }
});

Deno.test('Epoch Processing - Active Status: Learning Assessment Should Update Active Status', async () => {
  const scenario = await createIsolatedBelief(2, [0.6, 0.4], [0.5, 0.5]);

  // Verify initial active status
  let response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${scenario.beliefId}`, {
    headers
  });
  let submissions = await response.json();

  for (const submission of submissions) {
    assertEquals(submission.is_active, true, 'Initial submissions should be active');
  }

  // Process epoch (this should trigger learning assessment)
  const initialEpoch = await getCurrentEpoch();
  const epochResult = await callSupabaseFunction('protocol-epochs-process', { current_epoch: initialEpoch });

  // Check if learning occurred
  const processedBelief = epochResult.data.processed_beliefs.find(b => b.belief_id === scenario.beliefId);
  const learningOccurred = processedBelief && processedBelief.learning_occurred;

  if (!learningOccurred) {
    // If no learning occurred, agents should become passive
    response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${scenario.beliefId}`, {
      headers
    });
    submissions = await response.json();

    for (const submission of submissions) {
      assertEquals(submission.is_active, false,
        'Agents should become passive when no learning occurs');
    }
  }
  // Note: If learning occurred, active status should remain unchanged
});

Deno.test('Epoch Processing - Active Status: Database Integrity Check', async () => {
  // This test scans the entire belief_submissions table for inconsistencies
  const currentEpoch = await getCurrentEpoch();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?is_active=eq.true`, {
    headers
  });
  const activeSubmissions = await response.json();

  for (const submission of activeSubmissions) {
    if (submission.epoch < currentEpoch) {
      throw new Error(
        `DATABASE INTEGRITY VIOLATION: Submission ${submission.id} from epoch ${submission.epoch} ` +
        `is still marked active in epoch ${currentEpoch}. This indicates a bug in the learning assessment ` +
        `or epoch processing logic.`
      );
    }
  }

  console.log(`✅ Database integrity check passed: ${activeSubmissions.length} active submissions all from current epoch ${currentEpoch}`);
});
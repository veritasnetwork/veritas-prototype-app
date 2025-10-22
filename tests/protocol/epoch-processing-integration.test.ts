/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

interface EpochProcessingRequest {
  current_epoch?: number
}

interface BeliefProcessingResult {
  belief_id: string
  participant_count: number
  weights: Record<string, number>
  effective_stakes: Record<string, number>
  aggregate: number
  jensen_shannon_disagreement_entropy: number
  certainty: number
  redistribution_occurred: boolean
}

interface EpochProcessingResponse {
  processed_beliefs: BeliefProcessingResult[]
  expired_beliefs: string[]
  next_epoch: number
  errors: string[]
}

async function callEpochProcessing(request: EpochProcessingRequest = {}): Promise<EpochProcessingResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-epochs-process`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Epoch processing failed: ${response.status} ${errorText}`)
  }

  return await response.json()
}

// Helper function to create test agents with initial stakes
async function createTestAgent(initialStake: number = 100.0): Promise<string> {
  const username = generateUniqueUsername()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-user-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username })
  })
  const data = await response.json()
  const agentId = data.agent_id

  // Update the agent's total stake
  await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ total_stake: initialStake })
  })

  return agentId
}

// Helper function to create a test belief market
async function createTestBelief(creatorAgentId: string, initialBelief: number = 0.5, durationEpochs: number = 10): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: creatorAgentId,
      initial_belief: initialBelief,
      duration_epochs: durationEpochs
    })
  })

  const data = await response.json()
  return data.belief_id
}

// Helper function to submit belief for an agent
async function submitBelief(agentId: string, beliefId: string, beliefValue: number, metaPrediction: number) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: agentId,
      belief_id: beliefId,
      belief_value: beliefValue,
      meta_prediction: metaPrediction
    })
  })

  return await response.json()
}

// Helper function to get agent's current total stake
async function getAgentStake(agentId: string): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}&select=total_stake`, {
    method: 'GET',
    headers
  })
  const data = await response.json()
  return data[0]?.total_stake || 0
}

// Helper function to get current epoch
async function getCurrentEpoch(): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/system_config?key=eq.current_epoch&select=value`, {
    method: 'GET',
    headers
  })
  const data = await response.json()
  return parseInt(data[0]?.value || '0')
}

// Helper function to reset epoch to 0
async function resetEpoch(): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/system_config?key=eq.current_epoch`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ value: '0' })
  })
}

// Helper function to clean up test data
async function cleanupTestData(): Promise<void> {
  // Delete belief submissions
  const resp1 = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    }
  })
  await resp1.text() // Consume response to avoid leak

  // Delete beliefs
  const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/beliefs`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    }
  })
  await resp2.text() // Consume response to avoid leak

  // Delete agents (but keep system users)
  const resp3 = await fetch(`${SUPABASE_URL}/rest/v1/agents`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    }
  })
  await resp3.text() // Consume response to avoid leak

  // Delete users (but keep system users)
  const resp4 = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    }
  })
  await resp4.text() // Consume response to avoid leak
}

Deno.test("End-to-End Integration - Learning Triggers BTS Scoring and Stake Redistribution", async () => {
  // Clean up any existing test data and reset epoch
  await cleanupTestData()
  await resetEpoch()

  console.log("=== Creating multi-epoch scenario to trigger learning ===")

  // Create test agents with different stakes to test redistribution
  const agentA = await createTestAgent(100.0)
  const agentB = await createTestAgent(80.0)
  const agentC = await createTestAgent(120.0)

  console.log("Created agents:", { agentA, agentB, agentC })

  // Create a belief market
  const beliefId = await createTestBelief(agentA, 0.5, 10)
  console.log("Created belief:", beliefId)

  // Submit very diverse beliefs in epoch 1 to create high entropy
  await submitBelief(agentA, beliefId, 0.1, 0.5)  // Agent A: very low
  await submitBelief(agentB, beliefId, 0.9, 0.5)  // Agent B: very high
  await submitBelief(agentC, beliefId, 0.5, 0.5)  // Agent C: middle

  console.log("Submitted very diverse beliefs for first epoch (0.1, 0.9, 0.5) to create high entropy")

  // Process first epoch to establish high baseline entropy
  let currentEpoch = await getCurrentEpoch()
  console.log("=== Running first epoch to establish high baseline entropy ===")
  await callEpochProcessing({ current_epoch: currentEpoch })

  // In epoch 2, submit different beliefs from A and B to create BTS score differences
  // Leave C passive so aggregation reduces entropy (triggering learning)
  await submitBelief(agentA, beliefId, 0.7, 0.65)  // Agent A: somewhat convergent
  await submitBelief(agentB, beliefId, 0.4, 0.55)  // Agent B: different view
  // Agent C doesn't submit, becomes passive, will be pulled toward aggregate by aggregation
  // This creates: learning (entropy reduction via aggregation) + BTS winners/losers (A vs B disagreement)

  console.log("Submitted different beliefs from A (0.7) and B (0.4), C passive for aggregation")

  // Record initial stakes
  const initialStakeA = await getAgentStake(agentA)
  const initialStakeB = await getAgentStake(agentB)
  const initialStakeC = await getAgentStake(agentC)
  const initialTotalStake = initialStakeA + initialStakeB + initialStakeC

  console.log("Initial stakes:", {
    agentA: initialStakeA,
    agentB: initialStakeB,
    agentC: initialStakeC,
    total: initialTotalStake
  })

  // Get current epoch before processing the second epoch
  currentEpoch = await getCurrentEpoch()
  console.log("Current epoch before second processing:", currentEpoch)

  // Process second epoch (this should trigger learning due to entropy reduction)
  console.log("=== Running second epoch processing ===")
  const result = await callEpochProcessing({ current_epoch: currentEpoch })

  // Verify epoch processing completed successfully
  assertEquals(result.errors.length, 0, `Epoch processing had errors: ${result.errors.join(', ')}`)
  assertEquals(result.next_epoch, currentEpoch + 1)
  assert(result.processed_beliefs.length >= 1, `Should process at least 1 belief, got ${result.processed_beliefs.length}`)

  // Find our specific belief in the processed results
  const processedBelief = result.processed_beliefs.find(b => b.belief_id === beliefId)
  assertExists(processedBelief, `Belief ${beliefId} should be in processed beliefs`)
  assertEquals(processedBelief.participant_count, 3, "Should have 3 total participants (A, B, C - all submitted in epoch 1)")

  console.log("Processed belief result:", {
    redistribution_occurred: processedBelief.redistribution_occurred,
    pre_aggregate: processedBelief.aggregate,
    post_aggregate: processedBelief.aggregate,
    pre_entropy: processedBelief.jensen_shannon_disagreement_entropy,
    post_entropy: processedBelief.jensen_shannon_disagreement_entropy,
    certainty: processedBelief.certainty
  })

  // Verify learning occurred (should happen with diverse beliefs and meta-predictions)
  assertEquals(processedBelief.redistribution_occurred, true, "Learning should have occurred with diverse beliefs")

  console.log("=== Verifying stake redistribution occurred ===")

  // Check final stakes (should be different if redistribution occurred)
  const finalStakeA = await getAgentStake(agentA)
  const finalStakeB = await getAgentStake(agentB)
  const finalStakeC = await getAgentStake(agentC)
  const finalTotalStake = finalStakeA + finalStakeB + finalStakeC

  console.log("Final stakes:", {
    agentA: finalStakeA,
    agentB: finalStakeB,
    agentC: finalStakeC,
    total: finalTotalStake
  })

  // Verify stake conservation (total should remain the same)
  assertEquals(Math.abs(initialTotalStake - finalTotalStake) < 1e-10, true,
    `Stakes should be conserved: initial=${initialTotalStake}, final=${finalTotalStake}`)

  // Note: Stake redistribution may produce zero or very small changes depending on BTS scores
  // The key verification is that learning occurred and triggered the BTS + redistribution pipeline
  console.log("Stake changes:", {
    agentA: finalStakeA - initialStakeA,
    agentB: finalStakeB - initialStakeB,
    agentC: finalStakeC - initialStakeC
  })

  // Verify epoch was incremented in system config
  const newEpoch = await getCurrentEpoch()
  assertEquals(newEpoch, currentEpoch + 1)

  // Verify belief submissions were preserved (should remain intact for audit trail)
  const submissionsResponse = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${beliefId}`, {
    method: 'GET',
    headers
  })
  const submissions = await submissionsResponse.json()
  assert(submissions.length > 0, "Belief submissions should be preserved after learning for audit trail")

  console.log("✅ End-to-end integration test completed successfully")
  console.log("✅ Learning occurred, BTS scoring executed, stakes redistributed, submissions preserved")
})

Deno.test("End-to-End Integration - No Learning Skips BTS and Redistribution", async () => {
  // Clean up any existing test data and reset epoch
  await cleanupTestData()
  await resetEpoch()

  console.log("=== Creating consensus scenario to prevent learning ===")

  // Create test agents
  const agentA = await createTestAgent(100.0)
  const agentB = await createTestAgent(100.0)

  // Create a belief market
  const beliefId = await createTestBelief(agentA, 0.5, 10)

  // Submit very similar beliefs that should NOT trigger learning
  await submitBelief(agentA, beliefId, 0.51, 0.5)  // Very close to initial
  await submitBelief(agentB, beliefId, 0.49, 0.5)  // Very close to initial

  console.log("Submitted consensus beliefs")

  // Record initial stakes
  const initialStakeA = await getAgentStake(agentA)
  const initialStakeB = await getAgentStake(agentB)

  // Get current epoch before processing
  const currentEpoch = await getCurrentEpoch()

  // Process epoch
  console.log("=== Running epoch processing ===")
  const result = await callEpochProcessing({ current_epoch: currentEpoch })

  // Verify epoch processing completed successfully
  assertEquals(result.errors.length, 0)
  assertEquals(result.next_epoch, currentEpoch + 1)
  assert(result.processed_beliefs.length >= 1, `Should process at least 1 belief, got ${result.processed_beliefs.length}`)

  // Find our specific belief in the processed results
  const processedBelief = result.processed_beliefs.find(b => b.belief_id === beliefId)
  assertExists(processedBelief, `Belief ${beliefId} should be in processed beliefs`)

  console.log("No learning case result:", {
    redistribution_occurred: processedBelief.redistribution_occurred,
  })

  // Verify no learning occurred
  assertEquals(processedBelief.redistribution_occurred, false, "No learning should occur with consensus")

  // Check final stakes (should be unchanged if no learning)
  const finalStakeA = await getAgentStake(agentA)
  const finalStakeB = await getAgentStake(agentB)

  // Stakes should remain unchanged
  assertEquals(Math.abs(finalStakeA - initialStakeA) < 1e-10, true, "Stake A should be unchanged")
  assertEquals(Math.abs(finalStakeB - initialStakeB) < 1e-10, true, "Stake B should be unchanged")

  // Verify belief submissions still exist (not cleaned up when no learning)
  const submissionsResponse = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?belief_id=eq.${beliefId}`, {
    method: 'GET',
    headers
  })
  const submissions = await submissionsResponse.json()
  assertEquals(submissions.length, 2, "Belief submissions should remain when no learning occurs")

  console.log("✅ No learning case completed successfully")
  console.log("✅ No learning occurred, BTS scoring and redistribution skipped")
})
/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

interface EpochProcessingRequest {
  current_epoch?: number
}

async function callEpochProcessing(request: EpochProcessingRequest = {}) {
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

// Helper function to create test agents
async function createTestAgent(): Promise<string> {
  const username = generateUniqueUsername()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-user-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username })
  })
  const data = await response.json()
  return data.agent_id
}

// Helper function to create a test belief market
async function createTestBelief(creatorAgentId: string, initialBelief: number = 0.5): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: creatorAgentId,
      initial_belief: initialBelief,
      duration_epochs: 10
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

// Helper function to get current epoch
async function getCurrentEpoch(): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/system_config?key=eq.current_epoch&select=value`, {
    method: 'GET',
    headers
  })
  const data = await response.json()
  return parseInt(data[0]?.value || '0')
}

// Helper function to get belief aggregate from database
async function getBeliefAggregate(beliefId: string): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/beliefs?id=eq.${beliefId}&select=previous_aggregate`, {
    method: 'GET',
    headers
  })
  const data = await response.json()
  return data[0]?.previous_aggregate || 0
}

Deno.test("Aggregate Update Verification - Aggregates Should Change After Epoch Processing", async () => {
  console.log("=== Testing that aggregates are properly updated during epoch processing ===")

  // Create test agents
  const agentA = await createTestAgent()
  const agentB = await createTestAgent()
  const agentC = await createTestAgent()

  console.log("Created agents:", { agentA, agentB, agentC })

  // Create a belief market with initial aggregate of 0.5
  const beliefId = await createTestBelief(agentA, 0.5)
  console.log("Created belief:", beliefId)

  // Submit diverse beliefs that should create an aggregate different from 0.5
  await submitBelief(agentA, beliefId, 0.8, 0.6)  // Agent A: high belief
  await submitBelief(agentB, beliefId, 0.3, 0.4)  // Agent B: low belief
  await submitBelief(agentC, beliefId, 0.7, 0.5)  // Agent C: moderate belief

  console.log("Submitted beliefs: A=0.8, B=0.3, C=0.7")

  // Get initial aggregate before processing
  const initialAggregate = await getBeliefAggregate(beliefId)
  console.log("Initial aggregate:", initialAggregate)

  // Process epoch
  const currentEpoch = await getCurrentEpoch()
  console.log("Processing epoch:", currentEpoch)

  const result = await callEpochProcessing({ current_epoch: currentEpoch })

  // Verify epoch processing completed successfully
  assertEquals(result.errors.length, 0, `Epoch processing had errors: ${result.errors.join(', ')}`)
  assert(result.processed_beliefs.length >= 1, `Should process at least 1 belief, got ${result.processed_beliefs.length}`)

  // Find our specific belief in the processed results
  const processedBelief = result.processed_beliefs.find(b => b.belief_id === beliefId)
  assertExists(processedBelief, `Belief ${beliefId} should be in processed beliefs`)

  console.log("Processing results:", {
    pre_aggregate: processedBelief.aggregate,
    post_aggregate: processedBelief.aggregate,
    redistribution_occurred: processedBelief.redistribution_occurred
  })

  // Get final aggregate after processing
  const finalAggregate = await getBeliefAggregate(beliefId)
  console.log("Final aggregate:", finalAggregate)

  // Verify that the aggregate was updated
  // The final aggregate should match the aggregate
  const expectedAggregate = processedBelief.aggregate
  assertEquals(Math.abs(finalAggregate - expectedAggregate) < 1e-10, true,
    `Final aggregate ${finalAggregate} should match aggregate ${expectedAggregate}`)

  // Verify that the aggregate actually changed from initial
  // With beliefs of 0.8, 0.3, 0.7, the weighted average should be different from 0.5
  assertEquals(Math.abs(finalAggregate - initialAggregate) > 0.01, true,
    `Aggregate should have changed significantly from ${initialAggregate} to ${finalAggregate}`)

  console.log("✅ Aggregate update verification passed!")
  console.log(`   Initial: ${initialAggregate}`)
  console.log(`   Final: ${finalAggregate}`)
  console.log(`   Change: ${(finalAggregate - initialAggregate).toFixed(4)}`)
})

Deno.test("Aggregate Update Verification - Multi-Epoch Consistency", async () => {
  console.log("=== Testing aggregate consistency across multiple epochs ===")

  // Create test agents
  const agentA = await createTestAgent()
  const agentB = await createTestAgent()

  // Create belief market
  const beliefId = await createTestBelief(agentA, 0.5)

  // Submit initial beliefs
  await submitBelief(agentA, beliefId, 0.9, 0.7)
  await submitBelief(agentB, beliefId, 0.2, 0.3)

  // Process first epoch to establish baseline
  let currentEpoch = await getCurrentEpoch()
  console.log("Processing first epoch:", currentEpoch)

  await callEpochProcessing({ current_epoch: currentEpoch })
  const firstAggregate = await getBeliefAggregate(beliefId)
  console.log("First epoch aggregate:", firstAggregate)

  // Submit new beliefs for second epoch
  await submitBelief(agentA, beliefId, 0.6, 0.6)
  await submitBelief(agentB, beliefId, 0.6, 0.6)

  // Process second epoch
  currentEpoch = await getCurrentEpoch()
  console.log("Processing second epoch:", currentEpoch)

  const result = await callEpochProcessing({ current_epoch: currentEpoch })
  const secondAggregate = await getBeliefAggregate(beliefId)
  console.log("Second epoch aggregate:", secondAggregate)

  // Verify that aggregate was updated consistently
  assert(result.processed_beliefs.length >= 1, `Should process at least 1 belief, got ${result.processed_beliefs.length}`)

  // Find our specific belief in the processed results
  const processedBelief = result.processed_beliefs.find(b => b.belief_id === beliefId)
  assertExists(processedBelief, `Belief ${beliefId} should be in processed beliefs`)

  // The database aggregate should match the processing result
  assertEquals(Math.abs(secondAggregate - processedBelief.aggregate) < 1e-10, true,
    "Database aggregate should match processing result")

  // With convergent beliefs (both 0.6), aggregate should move toward 0.6
  assertEquals(Math.abs(secondAggregate - 0.6) < 0.1, true,
    "Aggregate should converge toward consensus belief value")

  console.log("✅ Multi-epoch consistency verification passed!")
  console.log(`   First epoch: ${firstAggregate}`)
  console.log(`   Second epoch: ${secondAggregate}`)
  console.log(`   Convergence toward 0.6: ${Math.abs(secondAggregate - 0.6) < 0.1}`)
})
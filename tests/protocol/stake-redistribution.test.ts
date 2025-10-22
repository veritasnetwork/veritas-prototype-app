/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

interface StakeRedistributionRequest {
  belief_id: string
  information_scores: Record<string, number>
  winners: string[]
  losers: string[]
  current_effective_stakes: Record<string, number>
}

interface StakeRedistributionResponse {
  redistribution_occurred: boolean
  updated_total_stakes: Record<string, number>
  individual_rewards: Record<string, number>
  individual_slashes: Record<string, number>
  slashing_pool: number
}

async function callStakeRedistribution(request: StakeRedistributionRequest): Promise<StakeRedistributionResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-stake-redistribution`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Stake redistribution failed: ${response.status} ${errorText}`)
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

  // Update the agent's total stake using the specific agent ID
  const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ total_stake: initialStake })
  })

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text()
    throw new Error(`Failed to set initial stake: ${updateResponse.status} ${errorText}`)
  }

  return agentId
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

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create belief: ${response.status} ${errorText}`)
  }

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

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to submit belief: ${response.status} ${errorText}`)
  }

  return await response.json()
}

Deno.test("Stake Redistribution - No Learning Case", async () => {
  const request: StakeRedistributionRequest = {
    belief_id: "test-belief-1",
    information_scores: {},
    winners: [],
    losers: [],
    current_effective_stakes: {}
  }

  const result = await callStakeRedistribution(request)

  // Verify no redistribution occurred
  assertEquals(result.redistribution_occurred, false)
  assertEquals(Object.keys(result.updated_total_stakes).length, 0)
  assertEquals(Object.keys(result.individual_rewards).length, 0)
  assertEquals(Object.keys(result.individual_slashes).length, 0)
  assertEquals(result.slashing_pool, 0)

  console.log("No learning case:", result)
})

Deno.test("Stake Redistribution - Basic Learning Case", async () => {
  // Create test agents with initial stakes
  const agentA = await createTestAgent(100.0)
  const agentB = await createTestAgent(80.0)
  const agentC = await createTestAgent(120.0)

  // Create a belief market
  const beliefId = await createTestBelief(agentA, 0.5)

  // Submit beliefs for all agents (submissions will be preserved for audit trail)
  await submitBelief(agentA, beliefId, 0.9, 0.6)  // Agent A: confident, predicts others uncertain
  await submitBelief(agentB, beliefId, 0.4, 0.8)  // Agent B: uncertain, predicts others confident
  await submitBelief(agentC, beliefId, 0.3, 0.7)  // Agent C: leaning false, predicts others confident

  // Agent A is winner (+0.5 info score), B and C are losers (-0.3, -0.2)
  const request: StakeRedistributionRequest = {
    belief_id: beliefId,
    information_scores: {
      [agentA]: 0.5,  // Winner
      [agentB]: -0.3, // Loser
      [agentC]: -0.2  // Loser
    },
    winners: [agentA],
    losers: [agentB, agentC],
    current_effective_stakes: {
      [agentA]: 50.0, // Effective stakes (could be total/num_beliefs)
      [agentB]: 40.0,
      [agentC]: 60.0
    }
  }

  const result = await callStakeRedistribution(request)

  // Verify redistribution occurred
  assertEquals(result.redistribution_occurred, true)
  assertExists(result.updated_total_stakes)
  assertExists(result.individual_rewards)
  assertExists(result.individual_slashes)

  // Calculate expected values
  const expectedSlashingPool = 0.2 * (40.0 + 60.0) // 20% of (B + C effective stakes) = 20
  assertEquals(result.slashing_pool, expectedSlashingPool)

  // Loser slashes should be proportional to |information_score|
  const totalLoserWeight = Math.abs(-0.3) + Math.abs(-0.2) // 0.3 + 0.2 = 0.5
  const expectedBSlash = (0.3 / 0.5) * expectedSlashingPool // (0.3/0.5) * 20 = 12
  const expectedCSlash = (0.2 / 0.5) * expectedSlashingPool // (0.2/0.5) * 20 = 8

  assertEquals(result.individual_slashes[agentB], expectedBSlash)
  assertEquals(result.individual_slashes[agentC], expectedCSlash)

  // Winner rewards should equal total slashing pool (single winner)
  assertEquals(result.individual_rewards[agentA], expectedSlashingPool)

  // Verify conservation: total slashes = total rewards
  const totalSlashes = Object.values(result.individual_slashes).reduce((sum, val) => sum + val, 0)
  const totalRewards = Object.values(result.individual_rewards).reduce((sum, val) => sum + val, 0)
  assertEquals(Math.abs(totalSlashes - totalRewards) < 1e-10, true)

  // Verify stakes were updated correctly in database
  const finalStakeA = await getAgentStake(agentA)
  const finalStakeB = await getAgentStake(agentB)
  const finalStakeC = await getAgentStake(agentC)

  assertEquals(finalStakeA, 100.0 + expectedSlashingPool)
  assertEquals(finalStakeB, 80.0 - expectedBSlash)
  assertEquals(finalStakeC, 120.0 - expectedCSlash)

  console.log("Basic learning case results:", {
    slashing_pool: result.slashing_pool,
    individual_rewards: result.individual_rewards,
    individual_slashes: result.individual_slashes,
    final_stakes: { agentA: finalStakeA, agentB: finalStakeB, agentC: finalStakeC }
  })
})

Deno.test("Stake Redistribution - Multiple Winners", async () => {
  // Create test agents
  const agentA = await createTestAgent(100.0)
  const agentB = await createTestAgent(100.0)
  const agentC = await createTestAgent(100.0)
  const agentD = await createTestAgent(100.0)

  // A and B are winners, C and D are losers
  const request: StakeRedistributionRequest = {
    belief_id: "test-belief-3",
    information_scores: {
      [agentA]: 0.6,  // Winner (higher score)
      [agentB]: 0.4,  // Winner (lower score)
      [agentC]: -0.8, // Loser (higher loss)
      [agentD]: -0.2  // Loser (lower loss)
    },
    winners: [agentA, agentB],
    losers: [agentC, agentD],
    current_effective_stakes: {
      [agentA]: 25.0, // All have same effective stakes
      [agentB]: 25.0,
      [agentC]: 25.0,
      [agentD]: 25.0
    }
  }

  const result = await callStakeRedistribution(request)

  assertEquals(result.redistribution_occurred, true)

  // Expected slashing pool = 0.1 * (25 + 25) = 5.0
  const expectedSlashingPool = 0.1 * (25.0 + 25.0)
  assertEquals(result.slashing_pool, expectedSlashingPool)

  // Verify rewards are proportional to information scores
  const totalWinnerScore = 0.6 + 0.4 // 1.0
  const expectedAReward = (0.6 / 1.0) * expectedSlashingPool // 3.0
  const expectedBReward = (0.4 / 1.0) * expectedSlashingPool // 2.0

  assertEquals(result.individual_rewards[agentA], expectedAReward)
  assertEquals(result.individual_rewards[agentB], expectedBReward)

  // Verify slashes are proportional to |information_scores|
  const totalLoserWeight = 0.8 + 0.2 // 1.0
  const expectedCSlash = (0.8 / 1.0) * expectedSlashingPool // 4.0
  const expectedDSlash = (0.2 / 1.0) * expectedSlashingPool // 1.0

  assertEquals(result.individual_slashes[agentC], expectedCSlash)
  assertEquals(result.individual_slashes[agentD], expectedDSlash)

  console.log("Multiple winners case:", {
    slashing_pool: result.slashing_pool,
    individual_rewards: result.individual_rewards,
    individual_slashes: result.individual_slashes
  })
})

Deno.test("Stake Redistribution - Edge Case: Zero Economic Learning Rate", async () => {
  const agentA = await createTestAgent(100.0)
  const agentB = await createTestAgent(100.0)

  const request: StakeRedistributionRequest = {
    belief_id: "test-belief-4",
    information_scores: {
      [agentA]: 0.5,
      [agentB]: -0.5
    },
    winners: [agentA],
    losers: [agentB],
    current_effective_stakes: {
      [agentA]: 50.0,
      [agentB]: 50.0
    }
  }

  const result = await callStakeRedistribution(request)

  assertEquals(result.redistribution_occurred, true)
  assertEquals(result.slashing_pool, 0.0) // No slashing pool
  assertEquals(result.individual_rewards[agentA], 0.0)
  assertEquals(result.individual_slashes[agentB], 0.0)

  // Verify stakes unchanged
  assertEquals(result.updated_total_stakes[agentA], 100.0)
  assertEquals(result.updated_total_stakes[agentB], 100.0)

  console.log("Zero economic learning rate case:", result)
})

Deno.test("Stake Redistribution - Edge Case: No Winners or Losers", async () => {
  const agentA = await createTestAgent(100.0)

  const request: StakeRedistributionRequest = {
    belief_id: "test-belief-5",
    information_scores: {
      [agentA]: 0.0 // Exactly zero information score
    },
    winners: [], // No winners
    losers: [],  // No losers
    current_effective_stakes: {
      [agentA]: 50.0
    }
  }

  const result = await callStakeRedistribution(request)

  assertEquals(result.redistribution_occurred, true)
  assertEquals(result.slashing_pool, 0.0) // No losers = no slashing pool
  assertEquals(Object.keys(result.individual_rewards).length, 0)
  assertEquals(Object.keys(result.individual_slashes).length, 0)

  console.log("No winners/losers case:", result)
})

Deno.test("Stake Redistribution - Input Validation", async () => {
  // Test missing belief_id
  try {
    await callStakeRedistribution({
      belief_id: "",
      information_scores: {},
      winners: [],
      losers: [],
      current_effective_stakes: {}
    })
    throw new Error("Should have failed")
  } catch (error) {
    assertEquals(error.message.includes("422"), true)
  }

  // Test invalid economic learning rate
  try {
    await callStakeRedistribution({
      belief_id: "test",
      information_scores: {},
      winners: [],
      losers: [],
      current_effective_stakes: {}
    })
    throw new Error("Should have failed")
  } catch (error) {
    assertEquals(error.message.includes("422"), true)
  }

  console.log("Input validation tests passed")
})

Deno.test("Stake Redistribution - Conservation Verification", async () => {
  // Create multiple agents for complex redistribution
  const agents = await Promise.all([
    createTestAgent(100.0),
    createTestAgent(80.0),
    createTestAgent(120.0),
    createTestAgent(150.0)
  ])

  const [agentA, agentB, agentC, agentD] = agents

  const request: StakeRedistributionRequest = {
    belief_id: "test-belief-6",
    information_scores: {
      [agentA]: 0.7,  // Winner
      [agentB]: 0.3,  // Winner
      [agentC]: -0.5, // Loser
      [agentD]: -0.9  // Loser
    },
    winners: [agentA, agentB],
    losers: [agentC, agentD],
    current_effective_stakes: {
      [agentA]: 30.0,
      [agentB]: 20.0,
      [agentC]: 40.0,
      [agentD]: 45.0
    }
  }

  const result = await callStakeRedistribution(request)

  // Verify zero-sum conservation
  const totalSlashes = Object.values(result.individual_slashes).reduce((sum, val) => sum + val, 0)
  const totalRewards = Object.values(result.individual_rewards).reduce((sum, val) => sum + val, 0)

  // Should be equal within numerical precision
  assertEquals(Math.abs(totalSlashes - totalRewards) < 1e-10, true)
  assertEquals(Math.abs(result.slashing_pool - totalRewards) < 1e-10, true)

  // Verify total system stake is conserved
  const initialTotalStake = 100.0 + 80.0 + 120.0 + 150.0 // 450
  const finalTotalStake = Object.values(result.updated_total_stakes).reduce((sum, val) => sum + val, 0)
  assertEquals(Math.abs(initialTotalStake - finalTotalStake) < 1e-10, true)

  console.log("Conservation verification:", {
    total_slashes: totalSlashes,
    total_rewards: totalRewards,
    slashing_pool: result.slashing_pool,
    initial_total_stake: initialTotalStake,
    final_total_stake: finalTotalStake
  })
})
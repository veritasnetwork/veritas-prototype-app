/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

const EPSILON_PROBABILITY = 1e-10

async function callWeightsCalculate(payload: any = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-weights-calculate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

// Helper to create a test agent with specific parameters
async function createTestAgent(totalStake: number = 100, beliefCount: number = 1) {
  // Create agent via protocol
  const agentResponse = await fetch(`${SUPABASE_URL}/functions/v1/protocol-agent-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ initial_stake: totalStake })
  })
  const agentData = await agentResponse.json()
  const agentId = agentData.agent_id

  // Create actual beliefs to increment active_belief_count
  for (let i = 0; i < beliefCount; i++) {
    const beliefResponse = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agent_id: agentId,
        initial_belief: 0.5,
        duration_epochs: 10
      })
    })
    await beliefResponse.json() // Consume response to avoid leaks
  }

  return agentId
}

// Basic Cases
Deno.test('Epistemic Weights - Single agent', async () => {
  const agentId = await createTestAgent(100, 2)
  
  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-1',
    participant_agents: [agentId]
  })
  
  assertEquals(response.status, 200)
  assertEquals(data.weights[agentId], 1.0)
  assertEquals(data.effective_stakes[agentId], 50) // 100/2
  
  // Verify normalization
  const weightSum = Object.values(data.weights as Record<string, number>).reduce((sum, weight) => sum + weight, 0)
  assertEquals(Math.abs(weightSum - 1.0) < EPSILON_PROBABILITY, true)
})

Deno.test('Epistemic Weights - Two equal agents', async () => {
  const agent1Id = await createTestAgent(100, 2) // Effective stake: 50
  const agent2Id = await createTestAgent(100, 2) // Effective stake: 50
  
  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-2',
    participant_agents: [agent1Id, agent2Id]
  })
  
  assertEquals(response.status, 200)
  assertEquals(data.weights[agent1Id], 0.5)
  assertEquals(data.weights[agent2Id], 0.5)
  assertEquals(data.effective_stakes[agent1Id], 50)
  assertEquals(data.effective_stakes[agent2Id], 50)
  
  // Verify normalization
  const weightSum = Object.values(data.weights as Record<string, number>).reduce((sum, weight) => sum + weight, 0)
  assertEquals(Math.abs(weightSum - 1.0) < EPSILON_PROBABILITY, true)
})

Deno.test('Epistemic Weights - Two unequal agents', async () => {
  const agent1Id = await createTestAgent(100, 1) // Effective stake: 100
  const agent2Id = await createTestAgent(100, 4) // Effective stake: 25
  
  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-3',
    participant_agents: [agent1Id, agent2Id]
  })
  
  assertEquals(response.status, 200)
  
  // Agent1 should have 4x the weight of Agent2 (100 vs 25 effective stake)
  // Expected weights: Agent1 = 100/125 = 0.8, Agent2 = 25/125 = 0.2
  assertEquals(Math.abs(data.weights[agent1Id] - 0.8) < EPSILON_PROBABILITY, true)
  assertEquals(Math.abs(data.weights[agent2Id] - 0.2) < EPSILON_PROBABILITY, true)
  assertEquals(data.effective_stakes[agent1Id], 100)
  assertEquals(data.effective_stakes[agent2Id], 25)
  
  // Verify normalization
  const weightSum = Object.values(data.weights as Record<string, number>).reduce((sum, weight) => sum + weight, 0)
  assertEquals(Math.abs(weightSum - 1.0) < EPSILON_PROBABILITY, true)
})

// Error Cases
Deno.test('Epistemic Weights - Division by zero', async () => {
  const agentId = await createTestAgent(100, 0) // Zero active beliefs
  
  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-4',
    participant_agents: [agentId]
  })
  
  assertEquals(response.status, 501)
  assertEquals(data.error, 'Division by zero - agent has no active beliefs')
})

Deno.test('Epistemic Weights - Missing agent', async () => {
  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-5',
    participant_agents: ['nonexistent-agent-id']
  })
  
  assertEquals(response.status, 404)
  assertEquals(data.error, 'Agent not found')
})

Deno.test('Epistemic Weights - Missing required fields', async () => {
  // Missing belief_id
  const { response: response1, data: data1 } = await callWeightsCalculate({
    participant_agents: ['some-agent']
  })
  
  assertEquals(response1.status, 422)
  assertEquals(data1.error, 'belief_id is required')
  
  // Missing participant_agents
  const { response: response2, data: data2 } = await callWeightsCalculate({
    belief_id: 'test-belief-6'
  })
  
  assertEquals(response2.status, 422)
  assertEquals(data2.error, 'participant_agents array is required and must be non-empty')
  
  // Empty participant_agents
  const { response: response3, data: data3 } = await callWeightsCalculate({
    belief_id: 'test-belief-7',
    participant_agents: []
  })
  
  assertEquals(response3.status, 422)
  assertEquals(data3.error, 'participant_agents array is required and must be non-empty')
})

// Edge Cases
Deno.test('Epistemic Weights - Minimal stakes', async () => {
  // Minimum viable stakes: $0.50 per belief = $1 total for 2 beliefs
  const agent1Id = await createTestAgent(1, 2) // $0.50 effective stake
  const agent2Id = await createTestAgent(1, 2) // $0.50 effective stake

  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-8',
    participant_agents: [agent1Id, agent2Id]
  })

  assertEquals(response.status, 200)

  // Should assign equal weights when all stakes are equal
  assertEquals(data.weights[agent1Id], 0.5)
  assertEquals(data.weights[agent2Id], 0.5)

  // Verify normalization
  const weightSum = Object.values(data.weights as Record<string, number>).reduce((sum, weight) => sum + weight, 0)
  assertEquals(Math.abs(weightSum - 1.0) < EPSILON_PROBABILITY, true)
})

Deno.test('Epistemic Weights - Very small effective stakes', async () => {
  // Small effective stakes but above minimum
  const agent1Id = await createTestAgent(0.6, 1) // $0.60 effective stake
  const agent2Id = await createTestAgent(1.2, 1) // $1.20 effective stake

  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-9',
    participant_agents: [agent1Id, agent2Id]
  })

  assertEquals(response.status, 200)

  // Agent2 should have 2x the weight of Agent1
  // Expected weights: 0.6/1.8 = 0.333..., 1.2/1.8 = 0.666...
  assertEquals(typeof data.weights[agent1Id], 'number')
  assertEquals(typeof data.weights[agent2Id], 'number')
  assertEquals(Math.abs(data.weights[agent1Id] - 0.333333) < 0.01, true)
  assertEquals(Math.abs(data.weights[agent2Id] - 0.666666) < 0.01, true)

  // Verify normalization
  const weightSum = Object.values(data.weights as Record<string, number>).reduce((sum, weight) => sum + weight, 0)
  assertEquals(Math.abs(weightSum - 1.0) < EPSILON_PROBABILITY, true)
})

Deno.test('Epistemic Weights - Multiple agents normalization', async () => {
  const agent1Id = await createTestAgent(150, 3) // Effective stake: 50
  const agent2Id = await createTestAgent(200, 4) // Effective stake: 50  
  const agent3Id = await createTestAgent(100, 1) // Effective stake: 100
  
  const { response, data } = await callWeightsCalculate({
    belief_id: 'test-belief-10',
    participant_agents: [agent1Id, agent2Id, agent3Id]
  })
  
  assertEquals(response.status, 200)
  
  // Total effective stakes: 50 + 50 + 100 = 200
  // Expected weights: 50/200, 50/200, 100/200 = 0.25, 0.25, 0.5
  assertEquals(Math.abs(data.weights[agent1Id] - 0.25) < EPSILON_PROBABILITY, true)
  assertEquals(Math.abs(data.weights[agent2Id] - 0.25) < EPSILON_PROBABILITY, true) 
  assertEquals(Math.abs(data.weights[agent3Id] - 0.5) < EPSILON_PROBABILITY, true)
  
  // Verify normalization
  const weightSum = Object.values(data.weights as Record<string, number>).reduce((sum, weight) => sum + weight, 0)
  assertEquals(Math.abs(weightSum - 1.0) < EPSILON_PROBABILITY, true)
})
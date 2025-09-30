/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

async function callBeliefSubmit(agent_id: string, belief_id: string, belief_value: number, meta_prediction: number) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id,
      belief_id,
      belief_value,
      meta_prediction
    })
  })
  return { response, data: await response.json() }
}

// Helper function to get agent belief count
async function getAgentBeliefCount(agent_id: string): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/agents?select=active_belief_count&id=eq.${agent_id}`, {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
    }
  })
  const data = await response.json()
  return data[0]?.active_belief_count || 0
}

// Helper to create test agent
async function createTestAgent() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-agent-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ initial_stake: 100 })
  })
  const data = await response.json()
  return data.agent_id
}

// Helper to create test belief
async function createTestBelief(agentId: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: agentId,
      initial_belief: 0.5,
      duration_epochs: 10
    })
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Failed to create belief: ${JSON.stringify(data)}`)
  }
  return data.belief_id
}

Deno.test('Belief Submission - Valid new submission', async () => {
  const creatorId = await createTestAgent()
  const submitterId = await createTestAgent()
  const beliefId = await createTestBelief(creatorId)

  // Submitter makes first submission (creator already has one from belief creation)
  const { response, data } = await callBeliefSubmit(submitterId, beliefId, 0.7, 0.6)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)
  assertEquals(typeof data.current_epoch, 'number')
  assertEquals(data.is_first_submission, true)
})

Deno.test('Belief Submission - Valid submission update', async () => {
  const agentId = await createTestAgent()
  const beliefId = await createTestBelief(agentId)

  // Agent already has initial submission from belief creation, now update it
  const { response, data } = await callBeliefSubmit(agentId, beliefId, 0.8, 0.7)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)
  assertEquals(data.is_first_submission, false)
})

Deno.test('Belief Submission - Missing agent_id', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      belief_id: 'some-belief-id',
      belief_value: 0.5,
      meta_prediction: 0.5
    })
  })
  const data = await response.json()

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required fields: agent_id, belief_id')
})

Deno.test('Belief Submission - Missing belief_id', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: 'some-agent-id',
      belief_value: 0.5,
      meta_prediction: 0.5
    })
  })
  const data = await response.json()

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required fields: agent_id, belief_id')
})

Deno.test('Belief Submission - Invalid belief_value below range', async () => {
  const { response, data } = await callBeliefSubmit('any-agent', 'any-belief', -0.1, 0.5)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'belief_value must be a number between 0 and 1')
})

Deno.test('Belief Submission - Invalid belief_value above range', async () => {
  const { response, data } = await callBeliefSubmit('any-agent', 'any-belief', 1.1, 0.5)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'belief_value must be a number between 0 and 1')
})

Deno.test('Belief Submission - Invalid meta_prediction below range', async () => {
  const { response, data } = await callBeliefSubmit('any-agent', 'any-belief', 0.5, -0.1)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'meta_prediction must be a number between 0 and 1')
})

Deno.test('Belief Submission - Invalid meta_prediction above range', async () => {
  const { response, data } = await callBeliefSubmit('any-agent', 'any-belief', 0.5, 1.1)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'meta_prediction must be a number between 0 and 1')
})

Deno.test('Belief Submission - Non-existent agent', async () => {
  const beliefId = await createTestBelief(await createTestAgent())
  const { response, data } = await callBeliefSubmit('00000000-0000-0000-0000-000000000000', beliefId, 0.5, 0.5)

  assertEquals(response.status, 404)
  assertEquals(data.error, 'Agent not found')
})

Deno.test('Belief Submission - Non-existent belief', async () => {
  const agentId = await createTestAgent()
  const { response, data } = await callBeliefSubmit(agentId, '00000000-0000-0000-0000-000000000000', 0.5, 0.5)

  assertEquals(response.status, 404)
  assertEquals(data.error, 'Belief not found')
})

Deno.test('Belief Submission - Boundary values (0,1)', async () => {
  const agentId = await createTestAgent()
  const beliefId = await createTestBelief(agentId)
  const { response, data } = await callBeliefSubmit(agentId, beliefId, 0, 1)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)
})

Deno.test('Belief Submission - Boundary values (1,0)', async () => {
  const agentId = await createTestAgent()
  const beliefId = await createTestBelief(agentId)
  const { response, data } = await callBeliefSubmit(agentId, beliefId, 1, 0)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)
})

Deno.test('Belief Submission - Same values update', async () => {
  const agentId = await createTestAgent()
  const beliefId = await createTestBelief(agentId)

  // Submit same values twice
  const { response: response1, data: data1 } = await callBeliefSubmit(agentId, beliefId, 0.6, 0.5)
  assertEquals(response1.status, 200)

  // Update with identical values
  const { response: response2, data: data2 } = await callBeliefSubmit(agentId, beliefId, 0.6, 0.5)

  assertEquals(response2.status, 200)
  assertEquals(data2.submission_id, data1.submission_id)
  assertEquals(data2.is_first_submission, false)
})

Deno.test('Belief Submission - Multiple agents same belief', async () => {
  const agent1Id = await createTestAgent()
  const agent2Id = await createTestAgent()
  const beliefId = await createTestBelief(agent1Id)

  // Both agents submit to same belief
  const { response: response1, data: data1 } = await callBeliefSubmit(agent1Id, beliefId, 0.4, 0.3)
  const { response: response2, data: data2 } = await callBeliefSubmit(agent2Id, beliefId, 0.9, 0.8)

  assertEquals(response1.status, 200)
  assertEquals(response2.status, 200)

  // Different submission IDs
  assert(data1.submission_id !== data2.submission_id)
})

Deno.test('Belief Submission - Response structure validation', async () => {
  const agentId = await createTestAgent()
  const beliefId = await createTestBelief(agentId)
  const { response, data } = await callBeliefSubmit(agentId, beliefId, 0.5, 0.5)

  assertEquals(response.status, 200)

  // Validate response structure
  assertExists(data.submission_id)
  assertEquals(typeof data.submission_id, 'string')

  assertExists(data.current_epoch)
  assertEquals(typeof data.current_epoch, 'number')

  assertExists(data.is_first_submission)
  assertEquals(typeof data.is_first_submission, 'boolean')
})
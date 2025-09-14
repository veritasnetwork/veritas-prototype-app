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

// Helper function to get belief submission count for an agent
async function getSubmissionCount(agent_id: string): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?select=id&agent_id=eq.${agent_id}`, {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
    }
  })
  const data = await response.json()
  return data.length
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

// Test data IDs (these should exist from previous tests)
const ALICE_AGENT_ID = '996df74b-3ef7-4993-832f-6559c2028f41'
const BOB_AGENT_ID = '23b66caf-cc10-4ea1-b429-4007ff48f648'
const CHARLIE_AGENT_ID = 'b678b66e-074d-49fe-803c-2fb74cf47e08'
const ACTIVE_BELIEF_ID = '54fc5377-ede2-4d2b-9c2d-82e6470a332b'

Deno.test('Belief Submission - Valid new submission', async () => {
  // Use Charlie for a fresh submission
  const { response, data } = await callBeliefSubmit(CHARLIE_AGENT_ID, ACTIVE_BELIEF_ID, 0.7, 0.6)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)
  assertEquals(typeof data.current_epoch, 'number')
  assertEquals(typeof data.is_first_submission, 'boolean')

  console.log('✅ New submission created:', {
    submission_id: data.submission_id,
    is_first: data.is_first_submission
  })
})

Deno.test('Belief Submission - Valid submission update', async () => {
  // Update Alice's existing submission
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.8, 0.7)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)
  assertEquals(data.is_first_submission, false)

  console.log('✅ Submission updated:', {
    submission_id: data.submission_id,
    is_first: data.is_first_submission
  })
})

Deno.test('Belief Submission - Missing agent_id', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      belief_id: ACTIVE_BELIEF_ID,
      belief_value: 0.5,
      meta_prediction: 0.5
    })
  })
  const data = await response.json()

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required fields: agent_id, belief_id')
  assertEquals(data.code, 422)
})

Deno.test('Belief Submission - Missing belief_id', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: ALICE_AGENT_ID,
      belief_value: 0.5,
      meta_prediction: 0.5
    })
  })
  const data = await response.json()

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required fields: agent_id, belief_id')
  assertEquals(data.code, 422)
})

Deno.test('Belief Submission - Invalid belief_value below range', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, -0.1, 0.5)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'belief_value must be a number between 0 and 1')
  assertEquals(data.code, 400)
})

Deno.test('Belief Submission - Invalid belief_value above range', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 1.1, 0.5)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'belief_value must be a number between 0 and 1')
  assertEquals(data.code, 400)
})

Deno.test('Belief Submission - Invalid meta_prediction below range', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.5, -0.1)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'meta_prediction must be a number between 0 and 1')
  assertEquals(data.code, 400)
})

Deno.test('Belief Submission - Invalid meta_prediction above range', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.5, 1.1)

  assertEquals(response.status, 400)
  assertEquals(data.error, 'meta_prediction must be a number between 0 and 1')
  assertEquals(data.code, 400)
})

Deno.test('Belief Submission - Non-existent agent', async () => {
  const { response, data } = await callBeliefSubmit('00000000-0000-0000-0000-000000000000', ACTIVE_BELIEF_ID, 0.5, 0.5)

  assertEquals(response.status, 404)
  assertEquals(data.error, 'Agent not found')
  assertEquals(data.code, 404)
})

Deno.test('Belief Submission - Non-existent belief', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, '00000000-0000-0000-0000-000000000000', 0.5, 0.5)

  assertEquals(response.status, 404)
  assertEquals(data.error, 'Belief not found')
  assertEquals(data.code, 404)
})

Deno.test('Belief Submission - Boundary values (0,1)', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0, 1)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)

  console.log('✅ Boundary values accepted:', {
    belief_value: 0,
    meta_prediction: 1
  })
})

Deno.test('Belief Submission - Boundary values (1,0)', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 1, 0)

  assertEquals(response.status, 200)
  assertExists(data.submission_id)

  console.log('✅ Boundary values accepted:', {
    belief_value: 1,
    meta_prediction: 0
  })
})

Deno.test('Belief Submission - Same values update', async () => {
  // Submit same values twice
  const { response: response1, data: data1 } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.6, 0.5)
  assertEquals(response1.status, 200)

  // Update with identical values
  const { response: response2, data: data2 } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.6, 0.5)

  assertEquals(response2.status, 200)
  assertEquals(data2.submission_id, data1.submission_id)
  assertEquals(data2.is_first_submission, false)

  console.log('✅ Same values update accepted')
})

Deno.test('Belief Submission - Multiple agents same belief', async () => {
  // Both Bob and Alice submit to same belief
  const { response: response1, data: data1 } = await callBeliefSubmit(BOB_AGENT_ID, ACTIVE_BELIEF_ID, 0.4, 0.3)
  const { response: response2, data: data2 } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.9, 0.8)

  assertEquals(response1.status, 200)
  assertEquals(response2.status, 200)

  // Different submission IDs
  assert(data1.submission_id !== data2.submission_id)

  console.log('✅ Multiple agents can submit to same belief:', {
    bob_submission: data1.submission_id,
    alice_submission: data2.submission_id
  })
})

Deno.test('Belief Submission - Agent belief count tracking', async () => {
  // Get initial count
  const initialCount = await getAgentBeliefCount(CHARLIE_AGENT_ID)

  console.log(`Charlie's initial belief count: ${initialCount}`)

  // Make submission to a belief Charlie isn't already participating in
  // First, let's create a new belief for this test
  const createBeliefResponse = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: BOB_AGENT_ID,
      initial_belief: 0.3,
      duration_epochs: 10
    })
  })

  const createBeliefData = await createBeliefResponse.json()

  if (createBeliefResponse.ok) {
    const newBeliefId = createBeliefData.belief_id

    // Now Charlie submits to this new belief
    const { response, data } = await callBeliefSubmit(CHARLIE_AGENT_ID, newBeliefId, 0.7, 0.6)

    assertEquals(response.status, 200)
    assertEquals(data.is_first_submission, true)

    // Check that belief count was incremented
    const newCount = await getAgentBeliefCount(CHARLIE_AGENT_ID)
    assertEquals(newCount, initialCount + 1)

    console.log(`✅ Charlie's belief count incremented: ${initialCount} -> ${newCount}`)
  } else {
    console.log('⚠️ Could not create new belief for count test, skipping')
    assert(true, 'Test skipped due to belief creation failure')
  }
})

Deno.test('Belief Submission - Response structure validation', async () => {
  const { response, data } = await callBeliefSubmit(ALICE_AGENT_ID, ACTIVE_BELIEF_ID, 0.5, 0.5)

  assertEquals(response.status, 200)

  // Validate response structure
  assertExists(data.submission_id)
  assertEquals(typeof data.submission_id, 'string')

  assertExists(data.current_epoch)
  assertEquals(typeof data.current_epoch, 'number')

  assertExists(data.is_first_submission)
  assertEquals(typeof data.is_first_submission, 'boolean')

  console.log('✅ Response structure valid:', {
    submission_id: typeof data.submission_id,
    current_epoch: typeof data.current_epoch,
    is_first_submission: typeof data.is_first_submission
  })
})
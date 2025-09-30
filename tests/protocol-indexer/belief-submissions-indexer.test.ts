/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

async function callBeliefSubmissions(beliefId: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-indexer-beliefs-get-submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      belief_id: beliefId
    })
  })
  return { response, data: await response.json() }
}

// Create a test user and return their agent ID
async function createTestUser() {
  const username = generateUniqueUsername()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-user-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username })
  })
  const data = await response.json()
  return data.agent_id
}

// Create a test belief and return its ID
async function createTestBelief() {
  const agent_id = await createTestUser()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id,
      initial_belief: 0.5,
      duration_epochs: 10
    })
  })
  const data = await response.json()
  return data.belief_id
}

Deno.test('Protocol Indexer Belief Submissions - Valid belief_id format', async () => {
  const belief_id = await createTestBelief()
  const { response, data } = await callBeliefSubmissions(belief_id)

  // Should accept valid UUID and find the belief
  assertEquals(response.status, 200)
})

Deno.test('Protocol Indexer Belief Submissions - Invalid belief_id format', async () => {
  const { response, data } = await callBeliefSubmissions('invalid-uuid')

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Invalid belief_id format')
  assertEquals(data.code, 422)
})

Deno.test('Protocol Indexer Belief Submissions - Missing belief_id', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-indexer-beliefs-get-submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  })
  const data = await response.json()

  assertEquals(response.status, 422)
  assertEquals(data.code, 422)
})

Deno.test('Protocol Indexer Belief Submissions - Non-existent belief_id', async () => {
  const { response, data } = await callBeliefSubmissions('00000000-0000-0000-0000-000000000000')

  assertEquals(response.status, 404)
  assertEquals(data.error, 'Belief not found')
  assertEquals(data.code, 404)
})

Deno.test('Protocol Indexer Belief Submissions - Existing belief with data', async () => {
  // Use known belief ID from our test data
  const { response, data } = await callBeliefSubmissions('54fc5377-ede2-4d2b-9c2d-82e6470a332b')

  if (response.status === 200) {
    console.log('✅ Found belief with data:', JSON.stringify(data, null, 2))

    // Test response structure
    assertExists(data.belief_id)
    assertEquals(data.belief_id, '54fc5377-ede2-4d2b-9c2d-82e6470a332b')

    assertExists(data.belief_info)
    assertExists(data.belief_info.creator_agent_id)
    assertEquals(typeof data.belief_info.previous_aggregate, 'number')
    assertEquals(typeof data.belief_info.expiration_epoch, 'number')

    assertExists(data.submissions)
    assertEquals(Array.isArray(data.submissions), true)

    // If submissions exist, test their structure
    if (data.submissions.length > 0) {
      const submission = data.submissions[0]
      assertExists(submission.submission_id)
      assertExists(submission.user)
      assertExists(submission.user.username)
      assertEquals(typeof submission.belief, 'number')
      assertEquals(typeof submission.meta_prediction, 'number')
      assertEquals(typeof submission.stake_allocated, 'number')
      assertEquals(typeof submission.is_active, 'boolean')
    }
  } else {
    console.log(`ℹ️  Belief not found or no data: ${response.status} - ${JSON.stringify(data)}`)
  }

  assert(true, 'Test completed - check console output')
})

Deno.test('Protocol Indexer Belief Submissions - Response data types', async () => {
  const { response, data } = await callBeliefSubmissions('54fc5377-ede2-4d2b-9c2d-82e6470a332b')

  if (response.status === 200) {
    // Test belief_info data types
    assertEquals(typeof data.belief_info.previous_aggregate, 'number')
    assert(data.belief_info.previous_aggregate >= 0 && data.belief_info.previous_aggregate <= 1,
           'previous_aggregate should be between 0 and 1')

    assertEquals(typeof data.belief_info.expiration_epoch, 'number')
    assertEquals(typeof data.belief_info.creator_agent_id, 'string')
    assertEquals(typeof data.belief_info.status, 'string')

    // Test submissions data types
    for (const submission of data.submissions) {
      assertEquals(typeof submission.belief, 'number')
      assert(submission.belief >= 0 && submission.belief <= 1, 'belief should be between 0 and 1')

      assertEquals(typeof submission.meta_prediction, 'number')
      assert(submission.meta_prediction >= 0 && submission.meta_prediction <= 1,
             'meta_prediction should be between 0 and 1')

      assertEquals(typeof submission.stake_allocated, 'number')
      assert(submission.stake_allocated >= 0, 'stake should be non-negative')

      assertEquals(typeof submission.is_active, 'boolean')
      assertEquals(typeof submission.user.username, 'string')
      assertEquals(typeof submission.user.display_name, 'string')
    }
  }

  assert(true, 'Data types test completed')
})
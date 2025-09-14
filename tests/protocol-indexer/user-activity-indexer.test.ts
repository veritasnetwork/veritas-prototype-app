/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, ANON_KEY } from '../test-config.ts'

const PROTOCOL_INDEXER_USERS_ACTIVITY_URL = `${SUPABASE_URL}/functions/v1/protocol-indexer-users-get-activity`

Deno.test('Protocol Indexer - Users Activity - Basic functionality', async () => {
  const response = await fetch(PROTOCOL_INDEXER_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 5,
      offset: 0
    })
  })

  assertEquals(response.status, 200, 'Should return 200 OK')

  const data = await response.json()
  console.log('Protocol indexer users activity response:', JSON.stringify(data, null, 2))

  // Validate response structure
  assertExists(data.agent_activities, 'Should have agent_activities array')
  assertExists(data.total_count, 'Should have total_count')

  if (data.agent_activities.length > 0) {
    const firstActivity = data.agent_activities[0]

    // Validate agent activity structure
    assertExists(firstActivity.agent_id, 'Agent should have agent_id')
    assertExists(firstActivity.total_stake, 'Agent should have total_stake')
    assertExists(firstActivity.active_belief_count, 'Agent should have active_belief_count')
    assertExists(firstActivity.submissions, 'Agent should have submissions array')

    if (firstActivity.submissions.length > 0) {
      const firstSubmission = firstActivity.submissions[0]

      // Validate submission structure (protocol data only, no user info)
      assertExists(firstSubmission.submission_id, 'Submission should have submission_id')
      assertExists(firstSubmission.belief_id, 'Submission should have belief_id')
      assertExists(firstSubmission.belief_value, 'Submission should have belief_value')
      assertExists(firstSubmission.meta_prediction, 'Submission should have meta_prediction')
      assertExists(firstSubmission.epoch, 'Submission should have epoch')
      assertExists(firstSubmission.is_active, 'Submission should have is_active')
      assertExists(firstSubmission.stake_allocated, 'Submission should have stake_allocated')
      assertExists(firstSubmission.belief_info, 'Submission should have belief_info')

      // Validate belief_info structure
      assertExists(firstSubmission.belief_info.creator_agent_id, 'Belief info should have creator_agent_id')
      assertExists(firstSubmission.belief_info.created_epoch, 'Belief info should have created_epoch')
      assertExists(firstSubmission.belief_info.expiration_epoch, 'Belief info should have expiration_epoch')
      assertExists(firstSubmission.belief_info.current_aggregate, 'Belief info should have current_aggregate')
      assertExists(firstSubmission.belief_info.status, 'Belief info should have status')
    }
  }
})

Deno.test('Protocol Indexer - Users Activity - Specific agent filtering', async () => {
  // First get all activities to find an agent_id
  const allResponse = await fetch(PROTOCOL_INDEXER_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 1,
      offset: 0
    })
  })

  const allData = await allResponse.json()

  if (allData.agent_activities.length > 0) {
    const testAgentId = allData.agent_activities[0].agent_id

    // Now test filtering by specific agent_id
    const response = await fetch(PROTOCOL_INDEXER_USERS_ACTIVITY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_ids: [testAgentId],
        limit: 10
      })
    })

    assertEquals(response.status, 200, 'Should return 200 OK for specific agent filtering')

    const data = await response.json()
    console.log('Filtered agent activity response:', JSON.stringify(data, null, 2))

    // Should only return the specified agent
    assertEquals(data.agent_activities.length, 1, 'Should return exactly one agent')
    assertEquals(data.agent_activities[0].agent_id, testAgentId, 'Should return the requested agent')
  } else {
    console.log('⚠️  No agents found for filtering test')
    assert(true, 'Skipped filtering test due to no data')
  }
})

Deno.test('Protocol Indexer - Users Activity - Pagination', async () => {
  const response = await fetch(PROTOCOL_INDEXER_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 2,
      offset: 0
    })
  })

  assertEquals(response.status, 200, 'Should return 200 OK')

  const data = await response.json()
  assert(data.agent_activities.length <= 2, 'Should respect limit parameter')

  console.log(`Pagination test: returned ${data.agent_activities.length} agents with limit=2`)
})

Deno.test('Protocol Indexer - Users Activity - Error handling', async () => {
  // Test invalid limit
  const invalidLimitResponse = await fetch(PROTOCOL_INDEXER_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 150, // Over the 100 limit
      offset: 0
    })
  })

  assertEquals(invalidLimitResponse.status, 422, 'Should return 422 for invalid limit')

  const errorData = await invalidLimitResponse.json()
  assertExists(errorData.error, 'Should have error message')
  console.log('Invalid limit error:', errorData.error)

  // Test negative offset
  const invalidOffsetResponse = await fetch(PROTOCOL_INDEXER_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 10,
      offset: -1
    })
  })

  assertEquals(invalidOffsetResponse.status, 422, 'Should return 422 for negative offset')

  const offsetErrorData = await invalidOffsetResponse.json()
  assertExists(offsetErrorData.error, 'Should have error message for negative offset')
  console.log('Negative offset error:', offsetErrorData.error)
})
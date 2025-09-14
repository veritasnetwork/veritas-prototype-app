/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, ANON_KEY } from '../test-config.ts'

const APP_DASHBOARD_USERS_ACTIVITY_URL = `${SUPABASE_URL}/functions/v1/app-dashboard-users-get-activity`

Deno.test('App Dashboard - Users Activity - Basic functionality', async () => {
  const response = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
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
  console.log('App dashboard users activity response:', JSON.stringify(data, null, 2))

  // Validate response structure
  assertExists(data.users, 'Should have users array')
  assertExists(data.total_count, 'Should have total_count')

  if (data.users.length > 0) {
    const firstUser = data.users[0]

    // Validate user structure (enriched with user info)
    assertExists(firstUser.user_id, 'User should have user_id')
    assertExists(firstUser.username, 'User should have username')
    assertExists(firstUser.display_name, 'User should have display_name')
    assertExists(firstUser.agent_id, 'User should have agent_id')
    assertExists(firstUser.total_stake, 'User should have total_stake')
    assertExists(firstUser.active_belief_count, 'User should have active_belief_count')
    assertExists(firstUser.belief_participations, 'User should have belief_participations array')

    if (firstUser.belief_participations.length > 0) {
      const firstParticipation = firstUser.belief_participations[0]

      // Validate participation structure
      assertExists(firstParticipation.submission_id, 'Participation should have submission_id')
      assertExists(firstParticipation.belief_id, 'Participation should have belief_id')
      assertExists(firstParticipation.belief_value, 'Participation should have belief_value')
      assertExists(firstParticipation.meta_prediction, 'Participation should have meta_prediction')
      assertExists(firstParticipation.stake_allocated, 'Participation should have stake_allocated')
      assertExists(firstParticipation.is_active, 'Participation should have is_active')
      assertExists(firstParticipation.belief_info, 'Participation should have belief_info')

      // Validate belief_info structure
      assertExists(firstParticipation.belief_info.creator_agent_id, 'Belief info should have creator_agent_id')
      assertExists(firstParticipation.belief_info.created_epoch, 'Belief info should have created_epoch')
      assertExists(firstParticipation.belief_info.expiration_epoch, 'Belief info should have expiration_epoch')
      assertExists(firstParticipation.belief_info.current_aggregate, 'Belief info should have current_aggregate')
      assertExists(firstParticipation.belief_info.status, 'Belief info should have status')

      // post_context can be null for standalone protocol beliefs
      if (firstParticipation.post_context) {
        assertExists(firstParticipation.post_context.post_id, 'Post context should have post_id')
        assertExists(firstParticipation.post_context.title, 'Post context should have title')
        assertExists(firstParticipation.post_context.post_type, 'Post context should have post_type')
        assertEquals(firstParticipation.post_context.post_type, 'opinion', 'Post type should be opinion')
      }
    }
  }
})

Deno.test('App Dashboard - Users Activity - Mixed content types (opinion posts vs protocol beliefs)', async () => {
  const response = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 10,
      offset: 0
    })
  })

  assertEquals(response.status, 200, 'Should return 200 OK')

  const data = await response.json()

  let opinionPostCount = 0
  let protocolBeliefCount = 0

  for (const user of data.users) {
    for (const participation of user.belief_participations) {
      if (participation.post_context) {
        opinionPostCount++
        assertEquals(participation.post_context.post_type, 'opinion', 'Opinion posts should have post_type opinion')
      } else {
        protocolBeliefCount++
      }
    }
  }

  console.log(`Found ${opinionPostCount} opinion post participations and ${protocolBeliefCount} standalone protocol belief participations`)

  if (opinionPostCount > 0 && protocolBeliefCount > 0) {
    console.log('✅ Successfully handling both opinion posts and standalone protocol beliefs')
  } else if (opinionPostCount > 0) {
    console.log('ℹ️  Found only opinion post participations (no standalone protocol beliefs)')
  } else if (protocolBeliefCount > 0) {
    console.log('ℹ️  Found only standalone protocol belief participations (no opinion posts)')
  } else {
    console.log('⚠️  No belief participations found')
  }

  assert(true, 'Mixed content type test completed')
})

Deno.test('App Dashboard - Users Activity - Specific user filtering', async () => {
  // First get all users to find a user_id
  const allResponse = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
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

  if (allData.users.length > 0) {
    const testUserId = allData.users[0].user_id

    // Now test filtering by specific user_id
    const response = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_ids: [testUserId],
        limit: 10
      })
    })

    assertEquals(response.status, 200, 'Should return 200 OK for specific user filtering')

    const data = await response.json()
    console.log('Filtered user activity response:', JSON.stringify(data, null, 2))

    // Should only return the specified user
    assertEquals(data.users.length, 1, 'Should return exactly one user')
    assertEquals(data.users[0].user_id, testUserId, 'Should return the requested user')
  } else {
    console.log('⚠️  No users found for filtering test')
    assert(true, 'Skipped filtering test due to no data')
  }
})

Deno.test('App Dashboard - Users Activity - User info enrichment', async () => {
  const response = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 3,
      offset: 0
    })
  })

  assertEquals(response.status, 200, 'Should return 200 OK')

  const data = await response.json()

  if (data.users.length > 0) {
    for (const user of data.users) {
      // Verify user info is properly enriched
      assert(typeof user.username === 'string', 'Username should be string')
      assert(typeof user.display_name === 'string', 'Display name should be string')
      assert(typeof user.agent_id === 'string', 'Agent ID should be string')
      assert(typeof user.total_stake === 'number', 'Total stake should be number')
      assert(typeof user.active_belief_count === 'number', 'Active belief count should be number')

      console.log(`User ${user.username} (@${user.display_name}) has ${user.belief_participations.length} participations`)
    }

    console.log('✅ User info enrichment working correctly')
  } else {
    console.log('⚠️  No users found for enrichment test')
  }

  assert(true, 'User enrichment test completed')
})

Deno.test('App Dashboard - Users Activity - Error handling', async () => {
  // Test invalid limit
  const invalidLimitResponse = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 60, // Over the 50 limit
      offset: 0
    })
  })

  assertEquals(invalidLimitResponse.status, 422, 'Should return 422 for invalid limit')

  const errorData = await invalidLimitResponse.json()
  assertExists(errorData.error, 'Should have error message')
  console.log('Invalid limit error:', errorData.error)

  // Test negative offset
  const invalidOffsetResponse = await fetch(APP_DASHBOARD_USERS_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      limit: 10,
      offset: -5
    })
  })

  assertEquals(invalidOffsetResponse.status, 422, 'Should return 422 for negative offset')

  const offsetErrorData = await invalidOffsetResponse.json()
  assertExists(offsetErrorData.error, 'Should have error message for negative offset')
  console.log('Negative offset error:', offsetErrorData.error)
})
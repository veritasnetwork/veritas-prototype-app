/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

async function callDashboardFeed(userId: string = 'default-user', limit: number = 20, offset: number = 0) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-posts-get-feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: userId,
      limit: limit,
      offset: offset
    })
  })
  return { response, data: await response.json() }
}

Deno.test('Dashboard Feed - Basic functionality', async () => {
  const { response, data } = await callDashboardFeed()

  assertEquals(response.status, 200)
  assertExists(data.posts)
  assertExists(data.total_count)
  assertEquals(Array.isArray(data.posts), true)
  assertEquals(typeof data.total_count, 'number')

  console.log(`Dashboard feed returned ${data.posts.length} posts (${data.total_count} total)`)
})

Deno.test('Dashboard Feed - Missing user_id', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-posts-get-feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      limit: 20
    })
  })
  const data = await response.json()

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required field: user_id')
  assertEquals(data.code, 422)
})

Deno.test('Dashboard Feed - Invalid pagination limits', async () => {
  const { response, data } = await callDashboardFeed('default-user', 150)

  assertEquals(response.status, 422)
  assertEquals(data.error, 'Limit must be between 1 and 100')
  assertEquals(data.code, 422)
})

Deno.test('Dashboard Feed - Post structure validation', async () => {
  const { response, data } = await callDashboardFeed()

  if (data.posts.length > 0) {
    const post = data.posts[0]

    // Basic post fields
    assertExists(post.id)
    assertExists(post.created_at)
    assertExists(post.user)
    assertExists(post.user.username)

    console.log(`Sample post structure:`, {
      id: post.id,
      title: post.title,
      hasOpinionBelief: !!post.belief_id,
      hasBelief: !!post.belief,
      hasSubmissions: !!post.submissions,
      submissionCount: post.submissions?.length || 0
    })
  }

  assert(true, 'Post structure validation completed')
})

Deno.test('Dashboard Feed - Belief post enrichment', async () => {
  const { response, data } = await callDashboardFeed()

  assertEquals(response.status, 200)

  // All posts should have beliefs now
  const beliefPosts = data.posts.filter((post: any) => post.belief_id != null)

  console.log(`Found ${beliefPosts.length} belief posts out of ${data.posts.length} total`)

  for (const post of beliefPosts) {
    console.log(`\nBelief post: ${post.id}`)
    console.log(`- Title: ${post.title}`)
    console.log(`- Belief ID: ${post.belief_id}`)

    if (post.belief) {
      console.log(`- Has belief data: YES`)
      console.log(`  - Aggregate: ${(post.belief.previous_aggregate * 100).toFixed(1)}%`)
      console.log(`  - Status: ${post.belief.status}`)
      console.log(`  - Expires: Epoch ${post.belief.expiration_epoch}`)

      // Validate belief structure
      assertExists(post.belief.belief_id)
      assertEquals(typeof post.belief.previous_aggregate, 'number')
      assertEquals(typeof post.belief.expiration_epoch, 'number')
      assertEquals(typeof post.belief.status, 'string')
    } else {
      console.log(`- Has belief data: NO`)
    }

    if (post.submissions) {
      console.log(`- Submissions: ${post.submissions.length}`)

      for (const submission of post.submissions) {
        console.log(`  - @${submission.user.username}: ${(submission.belief * 100).toFixed(1)}% belief, $${submission.stake_allocated.toFixed(1)} stake, ${submission.is_active ? 'Active' : 'Inactive'}`)

        // Validate submission structure
        assertExists(submission.submission_id)
        assertExists(submission.user.username)
        assertEquals(typeof submission.belief, 'number')
        assertEquals(typeof submission.meta_prediction, 'number')
        assertEquals(typeof submission.stake_allocated, 'number')
        assertEquals(typeof submission.is_active, 'boolean')
      }
    } else {
      console.log(`- Submissions: 0 (none or failed to load)`)
    }
  }

  assert(true, 'Opinion post enrichment validation completed')
})

Deno.test('Dashboard Feed - All posts have beliefs', async () => {
  const { response, data } = await callDashboardFeed()

  assertEquals(response.status, 200)

  // All posts should have belief_id now (no more regular/opinion distinction)
  const postsWithBeliefs = data.posts.filter((post: any) => post.belief_id)
  const postsWithoutBeliefs = data.posts.filter((post: any) => !post.belief_id)

  console.log(`\nPost distribution:`)
  console.log(`- Posts with beliefs: ${postsWithBeliefs.length}`)
  console.log(`- Posts without beliefs: ${postsWithoutBeliefs.length}`)

  // All posts should have belief_id in the new system
  for (const post of data.posts) {
    assertExists(post.belief_id, `Post ${post.id} should have belief_id`)
    // belief and submissions may or may not exist depending on data availability
  }

  // Verify we have no posts without beliefs (they should all be belief posts now)
  assertEquals(postsWithoutBeliefs.length, 0, 'All posts should have beliefs in the new system')

  assert(true, 'All posts have beliefs validation completed')
})

Deno.test('Dashboard Feed - Data consistency check', async () => {
  const { response, data } = await callDashboardFeed()

  assertEquals(response.status, 200)

  // Compare with regular feed API to ensure basic consistency
  const regularFeedResponse = await fetch(`${SUPABASE_URL}/functions/v1/app-post-get-feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: 'default-user',
      limit: 20,
      offset: 0
    })
  })

  const regularFeedData = await regularFeedResponse.json()

  console.log(`\nData consistency check:`)
  console.log(`- Dashboard feed: ${data.posts.length} posts`)
  console.log(`- Regular feed: ${regularFeedData.posts?.length || 0} posts`)

  // Both should return the same basic posts
  assertEquals(data.total_count, regularFeedData.total_count)

  if (data.posts.length > 0 && regularFeedData.posts?.length > 0) {
    // Check that post IDs match (same ordering)
    assertEquals(data.posts[0].id, regularFeedData.posts[0].id)

    // Check that basic post data is consistent
    assertEquals(data.posts[0].title, regularFeedData.posts[0].title)
    assertEquals(data.posts[0].user.username, regularFeedData.posts[0].user.username)
  }

  assert(true, 'Data consistency check completed')
})
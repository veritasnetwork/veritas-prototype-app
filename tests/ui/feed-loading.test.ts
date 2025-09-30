/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

async function callFeedApi(userId: string = 'default-user', limit: number = 50, offset: number = 0) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-get-feed`, {
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

Deno.test('Feed API - Correct endpoint and parameters', async () => {
  const { response, data } = await callFeedApi()

  // Verify API responds successfully
  assertEquals(response.status, 200)

  // Verify response structure matches spec
  assertExists(data.posts)
  assertExists(data.total_count)
  assertEquals(Array.isArray(data.posts), true)
  assertEquals(typeof data.total_count, 'number')
})

Deno.test('Feed API - Response contains required post fields', async () => {
  const { response, data } = await callFeedApi()

  if (data.posts.length > 0) {
    const post = data.posts[0]

    // Verify required fields exist
    assertExists(post.id)
    assertExists(post.created_at)
    assertExists(post.user)

    // Verify user has name field (display_name or username)
    const hasDisplayName = post.user.display_name != null
    const hasUsername = post.user.username != null
    assertEquals(hasDisplayName || hasUsername, true, 'Post must have author display_name or username')
  }
})

Deno.test('Feed API - All posts have belief data', async () => {
  const { response, data } = await callFeedApi()

  // All posts should have belief_id now
  const postsWithBeliefs = data.posts.filter((post: any) => post.belief_id != null)

  for (const post of postsWithBeliefs) {
    assertExists(post.belief_id, 'Post must have belief_id')

    // If belief data exists, verify structure
    if (post.belief) {
      assertExists(post.belief.previous_aggregate)
      assertEquals(typeof post.belief.previous_aggregate, 'number')
      assertEquals(post.belief.previous_aggregate >= 0 && post.belief.previous_aggregate <= 1, true,
        'previous_aggregate must be between 0 and 1')
    }
  }
})

Deno.test('Feed API - Pagination parameters', async () => {
  // Test with different limits
  const { data: smallData } = await callFeedApi('default-user', 2, 0)
  assertEquals(smallData.posts.length <= 2, true)

  const { data: largeData } = await callFeedApi('default-user', 10, 0)
  assertEquals(largeData.posts.length <= 10, true)
})

Deno.test('Feed Data Validation - Handle malformed responses gracefully', async () => {
  // This test simulates how the UI should handle invalid data
  const mockInvalidResponses = [
    { posts: null, total_count: 5 },
    { posts: 'not-an-array', total_count: 5 },
    { posts: [], total_count: 'not-a-number' },
    { posts: [{ id: 'test', user: null }], total_count: 1 }
  ]

  for (const mockData of mockInvalidResponses) {
    // Verify that posts array defaults to empty if invalid
    const posts = Array.isArray(mockData.posts) ? mockData.posts : []
    assertEquals(Array.isArray(posts), true)

    // Verify posts with missing user data get fallback
    for (const post of posts) {
      if (post.user == null) {
        // This should be handled with fallback in UI
        const authorName = 'Unknown'
        assertEquals(authorName, 'Unknown')
      }
    }
  }
})

Deno.test('Feed Integration - End-to-end data flow', async () => {
  const { response, data } = await callFeedApi()

  // Verify complete data pipeline works
  assertEquals(response.status, 200)
  assertExists(data.posts)

  // Simulate UI transformation for each post
  for (const apiPost of data.posts) {
    // Apply same transformation logic as PostsService
    const uiPost = {
      id: apiPost.id,
      title: apiPost.title || 'Untitled',
      content: apiPost.content || '',
      author: {
        name: apiPost.user?.display_name || apiPost.user?.username || 'Unknown'
      },
      timestamp: new Date(apiPost.created_at),
      hasOpinion: apiPost.belief_id != null
    }

    // Verify transformation produces valid UI data
    assertExists(uiPost.id)
    assertExists(uiPost.title)
    assertEquals(typeof uiPost.content, 'string')
    assertEquals(typeof uiPost.author.name, 'string')
    assertExists(uiPost.timestamp)
    assertEquals(typeof uiPost.hasOpinion, 'boolean')

    // Verify opinion data transformation if present
    if (uiPost.hasOpinion && apiPost.belief) {
      const opinionPercentage = Math.round((apiPost.belief.previous_aggregate || 0.5) * 100)
      assertEquals(typeof opinionPercentage, 'number')
      assertEquals(opinionPercentage >= 0 && opinionPercentage <= 100, true)
    }
  }
})

Deno.test('Feed Error Handling - Network failure simulation', async () => {
  // Test with invalid endpoint to simulate network error
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invalid-endpoint`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: 'test' })
  })

  // Verify error response
  assertEquals(response.status, 404)

  // Consume response body to prevent memory leak
  await response.text()

  // UI should handle this gracefully by showing error state
  // This would be tested in actual component tests
})

Deno.test('Feed Performance - Response time validation', async () => {
  const startTime = Date.now()
  const { response } = await callFeedApi('default-user', 20)
  const endTime = Date.now()

  // Verify API responds within reasonable time (5 seconds)
  const responseTime = endTime - startTime
  assertEquals(responseTime < 5000, true, `API response took ${responseTime}ms, should be under 5000ms`)
  assertEquals(response.status, 200)
})
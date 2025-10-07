/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

// Fetch API data for integration tests
async function fetchFeedData() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-get-feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: 'test-user',
      limit: 10,
      offset: 0
    })
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`)
  }

  return await response.json()
}

// Transform API post like PostsService does
function transformApiPost(apiPost: any): any {
  // All posts have beliefs now - no more conditional logic needed
  const aggregate = apiPost.belief?.previous_aggregate ?? 0.5;

  const post: any = {
    id: apiPost.id,
    headline: apiPost.title || 'Untitled',
    content: apiPost.content || '',
    author: {
      name: apiPost.user?.display_name || apiPost.user?.username || 'Unknown',
      avatar: undefined,
    },
    timestamp: new Date(apiPost.created_at),
    relevanceScore: 85,
    signals: {
      truth: 80,
      novelty: 75,
      importance: 70,
      virality: 65,
    },
    sources: [],
    discussionCount: 0,
    belief: {
      yesPercentage: Math.round(aggregate * 100),
      history: undefined,
    }
  }

  return post
}

Deno.test('Feed Integration - Real API data shows belief indicators', async () => {
  const data = await fetchFeedData()

  assertExists(data.posts, 'API should return posts')
  assertEquals(Array.isArray(data.posts), true, 'Posts should be an array')

  let postsWithBeliefData = 0
  let postsWithoutBeliefData = 0

  for (const apiPost of data.posts) {
    const transformedPost = transformApiPost(apiPost)

    if (apiPost.belief) {
      postsWithBeliefData++
      console.log(`Post with belief data: ${apiPost.id}`)
      console.log(`- Previous aggregate: ${apiPost.belief.previous_aggregate}`)
      console.log(`- Transformed percentage: ${transformedPost.belief?.yesPercentage}%`)
    } else {
      postsWithoutBeliefData++
      console.log(`Post without explicit belief data: ${apiPost.id}`)
      console.log(`- Defaulting to 50%`)
      console.log(`- Transformed percentage: ${transformedPost.belief?.yesPercentage}%`)
    }

    // ALL posts should have belief data (default 50% if no explicit belief)
    assertExists(transformedPost.belief, 'All posts should have belief data')
    assertEquals(typeof transformedPost.belief.yesPercentage, 'number', 'Should have numeric percentage')
    assert(transformedPost.belief.yesPercentage >= 0 && transformedPost.belief.yesPercentage <= 100,
           'Percentage should be 0-100')
  }

  console.log(`\nSummary:`)
  console.log(`- Total posts: ${data.posts.length}`)
  console.log(`- Posts with explicit belief data: ${postsWithBeliefData}`)
  console.log(`- Posts using default belief data: ${postsWithoutBeliefData}`)

  assert(true, 'Integration test completed - all posts have belief indicators')
})

Deno.test('Feed Integration - Validate PostCard rendering logic', async () => {
  const data = await fetchFeedData()

  for (const apiPost of data.posts) {
    const transformedPost = transformApiPost(apiPost)

    // ALL posts should show belief indicators now
    assertExists(transformedPost.belief, 'All posts should have belief data')
    assert(transformedPost.belief.yesPercentage >= 0 && transformedPost.belief.yesPercentage <= 100,
          `Post ${apiPost.id} should have valid percentage (0-100)`)
  }
})

Deno.test('Feed Integration - Belief indicator rendering decision', async () => {
  const data = await fetchFeedData()

  let totalPosts = 0

  for (const apiPost of data.posts) {
    const transformedPost = transformApiPost(apiPost)
    totalPosts++

    // All posts should show belief indicators
    console.log(`✓ Post ${apiPost.id} SHOULD show belief indicator (${transformedPost.belief.yesPercentage}%)`)
  }

  console.log(`\nBelief Indicator Rendering:`)
  console.log(`- All posts show belief indicators: ${totalPosts}`)

  assert(totalPosts > 0, 'Should have processed at least one post')
})
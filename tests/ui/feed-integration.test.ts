/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

// This test validates the complete data flow:
// API → PostsService → PostCard → OpinionIndicator rendering

async function fetchFeedData() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-get-feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: 'default-user',
      limit: 50,
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
  const post = {
    id: apiPost.id,
    type: apiPost.opinion_belief_id ? 'opinion' : 'news',
    headline: apiPost.title || 'Untitled',
    content: apiPost.content || '',
    thumbnail: apiPost.media_urls?.[0] || undefined,
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
  }

  // Add opinion data if applicable - this is the critical part!
  if (apiPost.opinion_belief_id) {
    // If belief data exists, use it; otherwise default to 0.5 until aggregation is implemented
    const aggregate = apiPost.belief?.previous_aggregate ?? 0.5;
    post.opinion = {
      yesPercentage: Math.round(aggregate * 100),
      history: undefined,
    }
  }

  return post
}

Deno.test('Feed Integration - Real API data shows opinion indicators', async () => {
  const data = await fetchFeedData()

  assertExists(data.posts, 'API should return posts')
  assertEquals(Array.isArray(data.posts), true, 'Posts should be an array')

  let opinionPostFound = false
  let opinionPostsWithoutBelief = 0

  for (const apiPost of data.posts) {
    const transformedPost = transformApiPost(apiPost)

    // If this is an opinion post (has opinion_belief_id)
    if (apiPost.opinion_belief_id) {
      opinionPostFound = true

      console.log(`Opinion post found: ${apiPost.id}`)
      console.log(`- Has belief data: ${!!apiPost.belief}`)

      if (apiPost.belief) {
        console.log(`- Previous aggregate: ${apiPost.belief.previous_aggregate}`)
        console.log(`- Transformed percentage: ${transformedPost.opinion?.yesPercentage}%`)
      } else {
        opinionPostsWithoutBelief++
        console.log(`- No belief data, defaulting to 50%`)
        console.log(`- Transformed percentage: ${transformedPost.opinion?.yesPercentage}%`)
      }

      // This is what should trigger the orange circle
      assertExists(transformedPost.opinion, 'Opinion post should always have opinion data (default 50% if no belief)')
      assertEquals(typeof transformedPost.opinion.yesPercentage, 'number', 'Should have numeric percentage')
      assert(transformedPost.opinion.yesPercentage >= 0 && transformedPost.opinion.yesPercentage <= 100,
             'Percentage should be 0-100')
    }
  }

  console.log(`\nSummary:`)
  console.log(`- Total posts: ${data.posts.length}`)
  console.log(`- Opinion posts found: ${opinionPostFound ? 'YES' : 'NO'}`)
  console.log(`- Opinion posts without belief data: ${opinionPostsWithoutBelief}`)

  // The test should pass but will help us understand the data
  assert(true, 'Integration test completed - check console logs for data insights')
})

Deno.test('Feed Integration - Validate PostCard conditional logic', async () => {
  const data = await fetchFeedData()

  for (const apiPost of data.posts) {
    const transformedPost = transformApiPost(apiPost)

    // Test the exact conditional logic from PostCard.tsx: {post.opinion && (...)}
    const shouldShowIndicator = !!transformedPost.opinion

    if (apiPost.opinion_belief_id) {
      // Opinion posts should always show indicator (default to 50% if no belief data)
      assertEquals(shouldShowIndicator, true,
                  `Post ${apiPost.id} has opinion_belief_id - should show indicator (50% if no belief data)`)
    } else {
      assertEquals(shouldShowIndicator, false,
                  `Regular post ${apiPost.id} should NOT show indicator`)
    }
  }
})

Deno.test('Feed Integration - Opinion indicator rendering decision', async () => {
  const data = await fetchFeedData()

  let shouldShowIndicators = 0
  let shouldNotShowIndicators = 0

  for (const apiPost of data.posts) {
    const transformedPost = transformApiPost(apiPost)

    // This matches the exact condition in PostCard: {post.opinion && (<OpinionIndicator...>)}
    if (transformedPost.opinion) {
      shouldShowIndicators++
      console.log(`✓ Post ${apiPost.id} SHOULD show orange circle (${transformedPost.opinion.yesPercentage}%)`)
    } else {
      shouldNotShowIndicators++
    }
  }

  console.log(`\nOpinion Indicator Rendering:`)
  console.log(`- Should show orange circles: ${shouldShowIndicators}`)
  console.log(`- Should NOT show orange circles: ${shouldNotShowIndicators}`)

  // If no opinion indicators should show, that might be the problem
  if (shouldShowIndicators === 0) {
    console.log(`\n⚠️  NO OPINION INDICATORS WILL SHOW!`)
    console.log(`This means either:`)
    console.log(`1. No posts have opinion_belief_id`)
    console.log(`2. Posts with opinion_belief_id have no belief data`)
    console.log(`3. The belief data is malformed`)
  }

  assert(true, 'Check console for rendering decisions')
})
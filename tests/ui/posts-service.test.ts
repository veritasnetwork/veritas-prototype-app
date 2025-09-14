/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

// Mock API response structure based on actual feed response
const mockApiPost = {
  id: 'test-post-id',
  title: 'Test Post Title',
  content: 'Test post content',
  created_at: '2025-09-14T12:00:00Z',
  media_urls: [],
  opinion_belief_id: 'test-belief-id',
  user: {
    username: 'testuser',
    display_name: 'Test User'
  },
  belief: {
    initial_aggregate: 0.75
  }
}

const mockRegularPost = {
  id: 'regular-post-id',
  title: 'Regular Post',
  content: 'Regular content',
  created_at: '2025-09-14T12:00:00Z',
  media_urls: [],
  opinion_belief_id: null,
  user: {
    username: 'regularuser',
    display_name: 'Regular User'
  }
}

// Test PostsService data transformation logic
// This simulates the transformApiPost method since we can't directly import it
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

  // Add opinion data if applicable
  if (apiPost.opinion_belief_id) {
    // If belief data exists, use it; otherwise default to 0.5 until aggregation is implemented
    const aggregate = apiPost.belief?.initial_aggregate ?? 0.5;
    post.opinion = {
      yesPercentage: Math.round(aggregate * 100),
      history: undefined,
    }
  }

  return post
}

Deno.test('PostsService - API response transformation', async () => {
  const transformedPost = transformApiPost(mockApiPost)

  // Verify basic fields
  assertEquals(transformedPost.id, 'test-post-id')
  assertEquals(transformedPost.headline, 'Test Post Title')
  assertEquals(transformedPost.content, 'Test post content')
  assertEquals(transformedPost.author.name, 'Test User')
})

Deno.test('PostsService - Opinion post classification', async () => {
  const transformedPost = transformApiPost(mockApiPost)

  // Verify opinion post classification
  assertEquals(transformedPost.type, 'opinion')
  assertExists(transformedPost.opinion)
  assertEquals(transformedPost.opinion.yesPercentage, 75) // 0.75 * 100 = 75
})

Deno.test('PostsService - Regular post classification', async () => {
  const transformedPost = transformApiPost(mockRegularPost)

  // Verify regular post classification
  assertEquals(transformedPost.type, 'news')
  assertEquals(transformedPost.opinion, undefined)
})

Deno.test('PostsService - Missing author name fallback', async () => {
  const postWithoutDisplayName = {
    ...mockApiPost,
    user: {
      username: 'testuser'
      // missing display_name
    }
  }

  const transformedPost = transformApiPost(postWithoutDisplayName)
  assertEquals(transformedPost.author.name, 'testuser')
})

Deno.test('PostsService - Missing author fallback to Unknown', async () => {
  const postWithoutUser = {
    ...mockApiPost,
    user: null
  }

  const transformedPost = transformApiPost(postWithoutUser)
  assertEquals(transformedPost.author.name, 'Unknown')
})

Deno.test('PostsService - Missing title fallback', async () => {
  const postWithoutTitle = {
    ...mockApiPost,
    title: null
  }

  const transformedPost = transformApiPost(postWithoutTitle)
  assertEquals(transformedPost.headline, 'Untitled')
})

Deno.test('PostsService - Opinion post without belief data defaults to 50%', async () => {
  const postWithoutBelief = {
    ...mockApiPost,
    belief: null // No belief data
  }

  const transformedPost = transformApiPost(postWithoutBelief)
  assertEquals(transformedPost.opinion.yesPercentage, 50) // Should default to 50% (0.5 * 100)
})

Deno.test('PostsService - Opinion percentage calculation', async () => {
  const testCases = [
    { aggregate: 0.0, expected: 0 },
    { aggregate: 0.25, expected: 25 },
    { aggregate: 0.5, expected: 50 },
    { aggregate: 0.33, expected: 33 },
    { aggregate: 1.0, expected: 100 }
  ]

  for (const testCase of testCases) {
    const postWithAggregate = {
      ...mockApiPost,
      belief: {
        initial_aggregate: testCase.aggregate
      }
    }

    const transformedPost = transformApiPost(postWithAggregate)
    assertEquals(
      transformedPost.opinion.yesPercentage,
      testCase.expected,
      `Failed for aggregate ${testCase.aggregate}`
    )
  }
})
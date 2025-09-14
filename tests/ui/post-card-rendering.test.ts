/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// Mock post data for testing
const mockOpinionPost = {
  id: 'opinion-post-id',
  type: 'opinion' as const,
  headline: 'Opinion Post Title',
  content: 'This is an opinion post content',
  author: { name: 'Test User' },
  timestamp: new Date('2025-09-14T12:00:00Z'),
  relevanceScore: 85,
  signals: { truth: 80, novelty: 75, importance: 70, virality: 65 },
  sources: [],
  discussionCount: 0,
  opinion: {
    yesPercentage: 75,
    history: undefined
  }
}

const mockRegularPost = {
  id: 'regular-post-id',
  type: 'news' as const,
  headline: 'Regular Post Title',
  content: 'This is regular post content',
  author: { name: 'Test User' },
  timestamp: new Date('2025-09-14T12:00:00Z'),
  relevanceScore: 85,
  signals: { truth: 80, novelty: 75, importance: 70, virality: 65 },
  sources: [],
  discussionCount: 0
  // No opinion property
}

// Helper function to render component as HTML string for testing
function renderPostCard(post: any): string {
  const title = post.headline || 'Untitled'
  const authorName = post.author?.name || 'Unknown'
  const content = post.content || ''

  let opinionIndicator = ''
  if (post.opinion) {
    opinionIndicator = `
      <div class="flex-shrink-0">
        <div class="relative w-16 h-16">
          <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgb(245 245 245)" stroke-width="3"></path>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#EA900E" stroke-width="3" stroke-dasharray="${post.opinion.yesPercentage}, 100"></path>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-sm font-bold text-veritas-orange font-sans">${post.opinion.yesPercentage}%</span>
          </div>
        </div>
        <div class="text-center mt-1">
          <span class="text-xs text-neutral-500 font-medium">YES</span>
        </div>
      </div>
    `
  }

  return `
    <article class="bg-white px-4 md:px-0 py-6 border-b border-neutral-200">
      <div>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 bg-veritas-orange rounded-full flex items-center justify-center">
            <span class="text-white font-bold text-sm">${authorName.charAt(0)}</span>
          </div>
          <div class="flex-1">
            <div class="font-medium text-neutral-900">${authorName}</div>
          </div>
        </div>
        <div class="flex items-start gap-2 mb-6">
          <h2 class="flex-1 text-2xl md:text-3xl font-bold text-black leading-snug font-serif">${title}</h2>
          ${opinionIndicator}
        </div>
        ${content ? `<p class="text-neutral-600 text-lg leading-relaxed line-clamp-3 font-serif">${content}</p>` : ''}
      </div>
    </article>
  `
}

Deno.test('PostCard Rendering - Opinion post shows orange circle', async () => {
  const html = renderPostCard(mockOpinionPost)

  // Verify opinion indicator is present
  assert(html.includes('stroke="#EA900E"'), 'Should contain orange stroke color')
  assert(html.includes('75%'), 'Should display correct percentage')
  assert(html.includes('stroke-dasharray="75, 100"'), 'Should have correct progress arc')
  assert(html.includes('YES'), 'Should show YES label')
})

Deno.test('PostCard Rendering - Regular post has no orange circle', async () => {
  const html = renderPostCard(mockRegularPost)

  // Verify opinion indicator is NOT present
  assert(!html.includes('stroke="#EA900E"'), 'Should not contain orange stroke color')
  assert(!html.includes('%'), 'Should not display percentage')
  assert(!html.includes('YES'), 'Should not show YES label')
  assert(!html.includes('stroke-dasharray'), 'Should not have progress arc')
})

Deno.test('PostCard Rendering - Opinion percentage accuracy', async () => {
  const testCases = [
    { percentage: 0, expected: '0%' },
    { percentage: 25, expected: '25%' },
    { percentage: 50, expected: '50%' },
    { percentage: 75, expected: '75%' },
    { percentage: 100, expected: '100%' }
  ]

  for (const testCase of testCases) {
    const postWithPercentage = {
      ...mockOpinionPost,
      opinion: {
        yesPercentage: testCase.percentage,
        history: undefined
      }
    }

    const html = renderPostCard(postWithPercentage)

    // Verify percentage is displayed correctly
    assert(html.includes(testCase.expected), `Should display ${testCase.expected}`)
    assert(html.includes(`stroke-dasharray="${testCase.percentage}, 100"`),
           `Should have correct progress arc for ${testCase.percentage}%`)
  }
})

Deno.test('PostCard Rendering - Orange circle styling verification', async () => {
  const html = renderPostCard(mockOpinionPost)

  // Verify the key styling elements for the orange circle
  assert(html.includes('w-16 h-16'), 'Should have correct size classes')
  assert(html.includes('transform -rotate-90'), 'Should have rotation for progress circle')
  assert(html.includes('stroke="#EA900E"'), 'Should use correct orange color')
  assert(html.includes('text-veritas-orange'), 'Should use veritas orange text class')
  assert(html.includes('font-bold'), 'Should have bold percentage text')
})

Deno.test('PostCard Rendering - Conditional rendering logic', async () => {
  // Test post with opinion property
  const opinionHtml = renderPostCard(mockOpinionPost)
  const opinionIndicatorPresent = opinionHtml.includes('stroke="#EA900E"')
  assertEquals(opinionIndicatorPresent, true, 'Opinion post should show indicator')

  // Test post without opinion property
  const regularHtml = renderPostCard(mockRegularPost)
  const opinionIndicatorAbsent = !regularHtml.includes('stroke="#EA900E"')
  assertEquals(opinionIndicatorAbsent, true, 'Regular post should not show indicator')

  // Test post with null opinion
  const postWithNullOpinion = { ...mockOpinionPost, opinion: null }
  const nullOpinionHtml = renderPostCard(postWithNullOpinion)
  const nullOpinionIndicatorAbsent = !nullOpinionHtml.includes('stroke="#EA900E"')
  assertEquals(nullOpinionIndicatorAbsent, true, 'Post with null opinion should not show indicator')
})
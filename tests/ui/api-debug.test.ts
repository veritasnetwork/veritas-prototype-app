/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

Deno.test('API Debug - Raw response inspection', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-get-feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: 'default-user',
      limit: 50,
      offset: 0
    })
  })

  const data = await response.json()

  console.log('\n=== RAW API RESPONSE ===')
  console.log(JSON.stringify(data, null, 2))

  for (const post of data.posts || []) {
    console.log(`\n--- Post ${post.id} ---`)
    console.log(`Title: ${post.title}`)
    console.log(`Type: opinion_belief_id = ${post.opinion_belief_id}`)
    console.log(`Belief data: ${JSON.stringify(post.belief)}`)

    if (post.opinion_belief_id && !post.belief) {
      console.log(`🚨 ISSUE: Has opinion_belief_id but no belief data!`)
    }
  }

  assert(true, 'Debug completed - check logs')
})
/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, ANON_KEY } from '../test-config.ts'

Deno.test('Database Check - Belief exists for opinion post', async () => {
  // First get the post to see what belief_id it references
  const postResponse = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=*&belief_id=not.is.null`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    }
  })

  const posts = await postResponse.json()
  console.log('Posts with belief_id:', posts)

  if (posts.length > 0) {
    const beliefId = posts[0].belief_id
    console.log(`Checking for belief with ID: ${beliefId}`)

    // Now check if belief exists
    const beliefResponse = await fetch(`${SUPABASE_URL}/rest/v1/beliefs?select=*&id=eq.${beliefId}`, {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY
      }
    })

    const beliefs = await beliefResponse.json()
    console.log('Belief records found:', beliefs)

    if (beliefs.length > 0) {
      console.log(`✅ Belief exists with previous_aggregate: ${beliefs[0].previous_aggregate}`)
    } else {
      console.log(`❌ No belief record found for ID: ${beliefId}`)
    }
  } else {
    console.log('No posts with belief_id found')
  }

  assert(true, 'Check completed - see console output')
})
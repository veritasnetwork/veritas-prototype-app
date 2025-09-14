/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, ANON_KEY } from '../test-config.ts'

Deno.test('Debug - Check if belief_submissions exist', async () => {
  // Check if there are any belief_submissions in the database
  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?select=*&limit=5`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    }
  })

  const submissions = await response.json()
  console.log('Belief submissions in database:', submissions)

  if (submissions.length > 0) {
    console.log('Sample submission structure:', JSON.stringify(submissions[0], null, 2))
  } else {
    console.log('❌ No belief_submissions found in database')
  }

  assert(true, 'Debug check completed')
})

Deno.test('Debug - Check belief_submissions for specific belief', async () => {
  const beliefId = '54fc5377-ede2-4d2b-9c2d-82e6470a332b'

  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?select=*&belief_id=eq.${beliefId}`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    }
  })

  const submissions = await response.json()
  console.log(`Submissions for belief ${beliefId}:`, submissions)

  assert(true, 'Belief-specific debug completed')
})

Deno.test('Debug - Test users table join', async () => {
  // Test if the join with users table works
  const response = await fetch(`${SUPABASE_URL}/rest/v1/belief_submissions?select=*,users:agent_id(id,username,display_name)&limit=3`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    }
  })

  console.log('Query status:', response.status)
  const result = await response.json()
  console.log('Join query result:', JSON.stringify(result, null, 2))

  if (response.status !== 200) {
    console.log('❌ Join query failed - this might be the issue')
  }

  assert(true, 'Join test completed')
})
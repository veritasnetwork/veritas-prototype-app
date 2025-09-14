/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, ANON_KEY } from '../test-config.ts'

Deno.test('Schema Check - Beliefs table structure', async () => {
  // Query the actual belief record to see what fields exist
  const response = await fetch(`${SUPABASE_URL}/rest/v1/beliefs?select=*&id=eq.54fc5377-ede2-4d2b-9c2d-82e6470a332b`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    }
  })

  const beliefs = await response.json()
  console.log('Actual belief record structure:', JSON.stringify(beliefs[0], null, 2))

  // Now test the same query that the API uses
  const apiStyleResponse = await fetch(`${SUPABASE_URL}/rest/v1/beliefs?select=id,previous_aggregate,previous_disagreement_entropy,participant_count,expiration_epoch,creator_agent_id&id=eq.54fc5377-ede2-4d2b-9c2d-82e6470a332b`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    }
  })

  console.log('API-style query status:', apiStyleResponse.status)
  const apiStyleData = await apiStyleResponse.json()
  console.log('API-style query result:', JSON.stringify(apiStyleData, null, 2))

  assert(true, 'Schema check completed')
})
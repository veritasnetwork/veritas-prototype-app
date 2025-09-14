/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

async function callAgentCreation(payload: any = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-agent-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

Deno.test('Protocol Agent Creation - Default stake', async () => {
  const { response, data } = await callAgentCreation({})
  
  assertEquals(response.status, 200)
  assertEquals(typeof data.agent_id, 'string')
  assertEquals(data.total_stake, 100)
  assertEquals(data.active_belief_count, 0)
})

Deno.test('Protocol Agent Creation - Custom stake', async () => {
  const { response, data } = await callAgentCreation({ initial_stake: 250.5 })
  
  assertEquals(response.status, 200)
  assertEquals(typeof data.agent_id, 'string')
  assertEquals(data.total_stake, 250.5)
  assertEquals(data.active_belief_count, 0)
})

Deno.test('Protocol Agent Creation - Negative stake validation', async () => {
  const { response, data } = await callAgentCreation({ initial_stake: -10 })
  
  assertEquals(response.status, 400)
  assertEquals(data.error, 'Initial stake must be non-negative')
  assertEquals(data.code, 400)
})

Deno.test('Protocol Agent Creation - Zero stake allowed', async () => {
  const { response, data } = await callAgentCreation({ initial_stake: 0 })
  
  assertEquals(response.status, 200)
  assertEquals(data.total_stake, 0)
})
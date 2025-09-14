/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

async function callBeliefCreation(payload: any = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

// Get agent ID for pre-created test users
async function getAgentId(username: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=agent_id&username=eq.${username}`, {
    headers: {
      'Authorization': headers.Authorization,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    }
  })
  const data = await response.json()
  return data[0]?.agent_id
}

Deno.test('Protocol Belief Creation - Valid belief', async () => {
  const agentId = await getAgentId('alice')
  
  const { response, data } = await callBeliefCreation({
    agent_id: agentId,
    initial_belief: 0.75,
    duration_epochs: 5
  })
  
  if (response.status !== 200) {
    console.log('Error response:', data)
  }
  
  assertEquals(response.status, 200)
  assertEquals(typeof data.belief_id, 'string')
  assertEquals(data.initial_aggregate, 0.75)
  assertEquals(typeof data.expiration_epoch, 'number')
})

Deno.test('Protocol Belief Creation - Invalid belief value', async () => {
  const agentId = await getAgentId('bob')
  
  const { response, data } = await callBeliefCreation({
    agent_id: agentId,
    initial_belief: 1.5, // Invalid: > 1
    duration_epochs: 5
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'initial_belief must be between 0 and 1')
})

Deno.test('Protocol Belief Creation - Duration validation', async () => {
  const agentId = await getAgentId('charlie')
  
  const { response, data } = await callBeliefCreation({
    agent_id: agentId,
    initial_belief: 0.75,
    duration_epochs: -1 // Invalid duration
  })
  
  assertEquals(response.status, 422)
})

Deno.test('Protocol Belief Creation - Missing fields', async () => {
  const { response, data } = await callBeliefCreation({
    initial_belief: 0.75
    // Missing required fields
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required fields: agent_id, initial_belief, duration_epochs')
})
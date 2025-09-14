/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

async function callPostCreation(payload: any = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-creation-with-opinion`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

// Get user ID for pre-created test users
async function getUserId(username: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&username=eq.${username}`, {
    headers: {
      'Authorization': headers.Authorization,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    }
  })
  const data = await response.json()
  return data[0]?.id
}

Deno.test('App Post Creation - Valid post with opinion', async () => {
  const userId = await getUserId('alice')
  
  const { response, data } = await callPostCreation({
    user_id: userId,
    title: 'Test Opinion Post',
    content: 'This is a test post with an opinion about something interesting.',
    initial_belief: 0.75,
    duration_epochs: 5
  })
  
  assertEquals(response.status, 200)
  assertEquals(typeof data.post_id, 'string')
  assertEquals(typeof data.belief_id, 'string')
  assertEquals(data.post.title, 'Test Opinion Post')
  assertEquals(data.post.user_id, userId)
  assertEquals(data.belief.initial_aggregate, 0.75)
  assertEquals(typeof data.belief.expiration_epoch, 'number')
})

Deno.test('App Post Creation - Title too long', async () => {
  const userId = await getUserId('bob')
  const longTitle = 'x'.repeat(201)
  
  const { response, data } = await callPostCreation({
    user_id: userId,
    title: longTitle,
    content: 'Valid content',
    initial_belief: 0.5
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Title must be 200 characters or less')
})

Deno.test('App Post Creation - Content too long', async () => {
  const userId = await getUserId('charlie')
  const longContent = 'x'.repeat(2001)
  
  const { response, data } = await callPostCreation({
    user_id: userId,
    title: 'Valid title',
    content: longContent,
    initial_belief: 0.5
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Content must be 2000 characters or less')
})

Deno.test('App Post Creation - Missing required fields', async () => {
  const { response, data } = await callPostCreation({
    title: 'Missing user_id and belief values'
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Missing required fields: user_id, title, initial_belief')
})

Deno.test('App Post Creation - Invalid user ID', async () => {
  const { response, data } = await callPostCreation({
    user_id: '00000000-0000-0000-0000-000000000000',
    title: 'Test Title',
    content: 'Test content',
    initial_belief: 0.5
  })
  
  assertEquals(response.status, 404)
  assertEquals(data.error, 'User not found')
})
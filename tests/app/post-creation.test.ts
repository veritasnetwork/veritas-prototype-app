/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

async function callPostCreation(payload: any = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

// Create a test user and return their user ID
async function createTestUser() {
  const username = generateUniqueUsername()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-user-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username })
  })
  const data = await response.json()
  return data.user_id
}

Deno.test('App Post Creation - Valid post with belief', async () => {
  const userId = await createTestUser()

  const { response, data } = await callPostCreation({
    user_id: userId,
    title: 'Test Post',
    content: 'This is a test post with a belief about something interesting.',
    initial_belief: 0.75,
    duration_epochs: 10
  })

  assertEquals(response.status, 200)
  assertEquals(typeof data.post_id, 'string')
  assertEquals(typeof data.belief_id, 'string')
  assertEquals(data.post.title, 'Test Post')
  assertEquals(data.post.user_id, userId)
  assertEquals(data.belief.initial_aggregate, 0.75)
  assertEquals(typeof data.belief.expiration_epoch, 'number')
})

Deno.test('App Post Creation - Title too long', async () => {
  const userId = await createTestUser()
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
  const userId = await createTestUser()
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
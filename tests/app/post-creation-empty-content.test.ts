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

Deno.test('App Post Creation - Empty content allowed', async () => {
  const userId = await createTestUser()

  const { response, data } = await callPostCreation({
    user_id: userId,
    title: 'Test Post with Empty Content',
    content: '',
    initial_belief: 0.75,
    duration_epochs: 10
  })

  assertEquals(response.status, 200)
  assertEquals(typeof data.post_id, 'string')
  assertEquals(typeof data.belief_id, 'string')
  assertEquals(data.post.title, 'Test Post with Empty Content')
  assertEquals(data.post.content, '')
  assertEquals(data.post.user_id, userId)
  assertEquals(data.belief.initial_aggregate, 0.75)
  assertEquals(typeof data.belief.expiration_epoch, 'number')
})
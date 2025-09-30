/// <reference lib="deno.ns" />
import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

async function callUserCreation(payload: any) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-users-create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

function generateUniqueAuthId() {
  return `test_auth_${Date.now()}_${Math.random().toString(36).substring(2)}`
}

Deno.test('App User Creation - Basic creation with auto-generated username', async () => {
  const { response, data } = await callUserCreation({
    auth_provider: 'privy',
    auth_id: generateUniqueAuthId(),
    display_name: 'Test User'
  })

  assertEquals(response.status, 200)
  assertEquals(typeof data.user_id, 'string')
  assertEquals(typeof data.agent_id, 'string')

  // Verify auto-generated username format
  assert(data.user.username.startsWith('privy'))
  assertEquals(data.user.username.length, 11) // 'privy' + 6 digits

  assertEquals(data.user.display_name, 'Test User')
  assertEquals(data.user.auth_provider, 'privy')
  assertEquals(data.user.total_stake, 10000)
  assertEquals(data.user.beliefs_created, 0)
  assertEquals(data.user.beliefs_participated, 0)
  assertEquals(data.user.agent_id, data.agent_id)
})

Deno.test('App User Creation - Custom username provided', async () => {
  const username = generateUniqueUsername()
  const { response, data } = await callUserCreation({
    auth_provider: 'github',
    auth_id: generateUniqueAuthId(),
    username: username,
    display_name: 'GitHub User'
  })

  assertEquals(response.status, 200)
  assertEquals(data.user.username, username)
  assertEquals(data.user.display_name, 'GitHub User')
  assertEquals(data.user.auth_provider, 'github')
})

Deno.test('App User Creation - Custom stake', async () => {
  const { response, data } = await callUserCreation({
    auth_provider: 'google',
    auth_id: generateUniqueAuthId(),
    initial_stake: 500
  })

  assertEquals(response.status, 200)
  assertEquals(data.user.total_stake, 500)
})

Deno.test('App User Creation - Missing auth_provider', async () => {
  const { response, data } = await callUserCreation({
    auth_id: generateUniqueAuthId()
  })

  assertEquals(response.status, 422)
  assertEquals(data.error, 'auth_provider is required')
})

Deno.test('App User Creation - Missing auth_id', async () => {
  const { response, data } = await callUserCreation({
    auth_provider: 'privy'
  })

  assertEquals(response.status, 422)
  assertEquals(data.error, 'auth_id is required')
})

Deno.test('App User Creation - Duplicate auth credentials', async () => {
  const authId = generateUniqueAuthId()

  // Create first user
  const { response: firstResponse } = await callUserCreation({
    auth_provider: 'privy',
    auth_id: authId
  })
  assertEquals(firstResponse.status, 200)

  // Try to create duplicate
  const { response: secondResponse, data: secondData } = await callUserCreation({
    auth_provider: 'privy',
    auth_id: authId
  })

  assertEquals(secondResponse.status, 409)
  assertEquals(secondData.error, 'User with these auth credentials already exists')
})

Deno.test('App User Creation - Username too short', async () => {
  const { response, data } = await callUserCreation({
    auth_provider: 'privy',
    auth_id: generateUniqueAuthId(),
    username: 'x'
  })

  assertEquals(response.status, 422)
  assertEquals(data.error, 'username must be between 2 and 50 characters')
})

Deno.test('App User Creation - Duplicate username', async () => {
  const username = generateUniqueUsername()

  // Create first user with username
  const { response: firstResponse } = await callUserCreation({
    auth_provider: 'privy',
    auth_id: generateUniqueAuthId(),
    username: username
  })
  assertEquals(firstResponse.status, 200)

  // Try to create second user with same username
  const { response: secondResponse, data: secondData } = await callUserCreation({
    auth_provider: 'github',
    auth_id: generateUniqueAuthId(),
    username: username
  })

  assertEquals(secondResponse.status, 409)
  assertEquals(secondData.error, 'Username already exists')
})
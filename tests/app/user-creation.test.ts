/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers, generateUniqueUsername } from '../test-config.ts'

async function callUserCreation(payload: any) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/app-user-creation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  return { response, data: await response.json() }
}

Deno.test('App User Creation - Success with display name', async () => {
  const username = generateUniqueUsername()
  const { response, data } = await callUserCreation({
    username,
    display_name: 'Test User'
  })
  
  assertEquals(response.status, 200)
  assertEquals(typeof data.user_id, 'string')
  assertEquals(typeof data.agent_id, 'string')
  assertEquals(data.user.username, username)
  assertEquals(data.user.display_name, 'Test User')
  assertEquals(data.user.total_stake, 100)
  assertEquals(data.user.beliefs_created, 0)
  assertEquals(data.user.beliefs_participated, 0)
  assertEquals(data.user.agent_id, data.agent_id)
})

Deno.test('App User Creation - Success without display name', async () => {
  const username = generateUniqueUsername()
  const { response, data } = await callUserCreation({ username })
  
  assertEquals(response.status, 200)
  assertEquals(data.user.username, username)
  assertEquals(data.user.display_name, username) // defaults to username
})

Deno.test('App User Creation - Empty username validation', async () => {
  const { response, data } = await callUserCreation({
    username: '',
    display_name: 'Empty Username'
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Username is required')
  assertEquals(data.code, 422)
})

Deno.test('App User Creation - Whitespace only username validation', async () => {
  const { response, data } = await callUserCreation({
    username: '   ',
    display_name: 'Whitespace Username'
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Username is required')
})

Deno.test('App User Creation - Username too short', async () => {
  const { response, data } = await callUserCreation({
    username: 'x',
    display_name: 'Short Name'
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Username must be between 2 and 50 characters')
})

Deno.test('App User Creation - Username too long', async () => {
  const longUsername = 'x'.repeat(51)
  const { response, data } = await callUserCreation({
    username: longUsername,
    display_name: 'Long Name'
  })
  
  assertEquals(response.status, 422)
  assertEquals(data.error, 'Username must be between 2 and 50 characters')
})

Deno.test('App User Creation - Duplicate username rejection', async () => {
  const username = generateUniqueUsername()
  
  // Create first user
  const { response: firstResponse } = await callUserCreation({
    username,
    display_name: 'First User'
  })
  assertEquals(firstResponse.status, 200)
  
  // Try to create duplicate
  const { response: secondResponse, data: secondData } = await callUserCreation({
    username,
    display_name: 'Duplicate User'
  })
  
  assertEquals(secondResponse.status, 409)
  assertEquals(secondData.error, 'Username already exists')
  assertEquals(secondData.code, 409)
})
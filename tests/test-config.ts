/// <reference lib="deno.ns" />

export const SUPABASE_URL = 'http://127.0.0.1:54321'
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const headers = {
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
}

export function generateUniqueUsername() {
  return `testuser_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// Test Solana addresses (deterministic keypairs for testing)
export const TEST_SOLANA_ADDRESSES = [
  '11111111111111111111111111111111', // System program (valid format)
  '2' + '1'.repeat(43), // Test address 1
  '3' + '1'.repeat(43), // Test address 2
  '4' + '1'.repeat(43), // Test address 3
  '5' + '1'.repeat(43), // Test address 4
  '6' + '1'.repeat(43), // Test address 5
  '7' + '1'.repeat(43), // Test address 6
  '8' + '1'.repeat(43), // Test address 7
  '9' + '1'.repeat(43), // Test address 8
]

let addressCounter = 0
export function getTestSolanaAddress(): string {
  const address = TEST_SOLANA_ADDRESSES[addressCounter % TEST_SOLANA_ADDRESSES.length]
  addressCounter++
  return address
}
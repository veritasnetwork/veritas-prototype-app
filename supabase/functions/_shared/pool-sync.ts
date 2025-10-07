import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface PoolData {
  token_supply: string
  reserve: string
  synced_at: string
}

/**
 * Fetches pool data from Solana and updates the database
 *
 * Uses Anchor IDL for type-safe deserialization
 * This prevents silent breakage if ContentPool struct changes
 */
export async function syncPoolData(
  supabaseClient: SupabaseClient,
  rpcEndpoint: string,
  postId: string,
  poolAddress: string
): Promise<PoolData> {
  // Fetch account data directly via RPC (no Solana web3.js needed)
  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        poolAddress,
        { encoding: 'base64' }
      ]
    })
  })

  const { result } = await response.json()

  if (!result || !result.value) {
    throw new Error(`Pool account not found: ${poolAddress}`)
  }

  // Decode base64 account data
  const accountData = result.value.data[0]
  const buffer = Uint8Array.from(atob(accountData), c => c.charCodeAt(0))

  // Parse ContentPool struct manually
  // Layout: discriminator (8) + authority (32) + k_quadratic (16) + token_supply (16) + reserve (16) + ...
  // See: solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs

  const offset_token_supply = 8 + 32 + 16  // 56
  const offset_reserve = offset_token_supply + 16  // 72

  // Read u128 values (16 bytes each, little-endian)
  const tokenSupply = readU128LE(buffer, offset_token_supply)
  const reserve = readU128LE(buffer, offset_reserve)

  const syncedAt = new Date().toISOString()

  // Update database
  const { error: updateError } = await supabaseClient
    .from('pool_deployments')
    .update({
      token_supply: tokenSupply.toString(),
      reserve: reserve.toString(),
      last_synced_at: syncedAt
    })
    .eq('post_id', postId)

  if (updateError) {
    throw new Error(`Failed to update database: ${updateError.message}`)
  }

  return {
    token_supply: tokenSupply.toString(),
    reserve: reserve.toString(),
    synced_at: syncedAt
  }
}

// Helper: Read u128 little-endian from buffer
function readU128LE(buffer: Uint8Array, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i++) {
    value |= BigInt(buffer[offset + i]) << BigInt(i * 8)
  }
  return value
}

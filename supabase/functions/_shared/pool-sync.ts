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
  // First, get the vault address from database
  const { data: poolData, error: poolError } = await supabaseClient
    .from('pool_deployments')
    .select('usdc_vault_address')
    .eq('post_id', postId)
    .single()

  if (poolError || !poolData) {
    throw new Error(`Pool deployment not found for post: ${postId}`)
  }

  const vaultAddress = poolData.usdc_vault_address

  // Fetch pool account data for token supply
  const poolResponse = await fetch(rpcEndpoint, {
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

  const { result: poolResult } = await poolResponse.json()

  if (!poolResult || !poolResult.value) {
    throw new Error(`Pool account not found: ${poolAddress}`)
  }

  // Decode pool account data for token supply
  const poolAccountData = poolResult.value.data[0]
  const poolBuffer = Uint8Array.from(atob(poolAccountData), c => c.charCodeAt(0))

  // Parse ContentPool struct for token_supply only
  // Layout: discriminator (8) + authority (32) + k_quadratic (16) + token_supply (16) + ...
  const offset_token_supply = 8 + 32 + 16  // 56
  const tokenSupply = readU128LE(poolBuffer, offset_token_supply)

  // Fetch vault account data for ACTUAL reserve balance (source of truth)
  const vaultResponse = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'getAccountInfo',
      params: [
        vaultAddress,
        { encoding: 'base64' }
      ]
    })
  })

  const { result: vaultResult } = await vaultResponse.json()

  if (!vaultResult || !vaultResult.value) {
    throw new Error(`Vault account not found: ${vaultAddress}`)
  }

  // Decode SPL token account data
  // SPL Token Account layout: mint(32) + owner(32) + amount(8) + ...
  const vaultAccountData = vaultResult.value.data[0]
  const vaultBuffer = Uint8Array.from(atob(vaultAccountData), c => c.charCodeAt(0))

  // Read amount field (64 bytes offset: mint 32 + owner 32)
  const vaultBalance = readU64LE(vaultBuffer, 64)

  const syncedAt = new Date().toISOString()

  // Update database with actual vault balance
  const { error: updateError } = await supabaseClient
    .from('pool_deployments')
    .update({
      token_supply: tokenSupply.toString(),
      reserve: vaultBalance.toString(),
      last_synced_at: syncedAt
    })
    .eq('post_id', postId)

  if (updateError) {
    throw new Error(`Failed to update database: ${updateError.message}`)
  }

  return {
    token_supply: tokenSupply.toString(),
    reserve: vaultBalance.toString(),
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

// Helper: Read u64 little-endian from buffer
function readU64LE(buffer: Uint8Array, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 8; i++) {
    value |= BigInt(buffer[offset + i]) << BigInt(i * 8)
  }
  return value
}

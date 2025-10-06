import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.87.6'
import { AnchorProvider, Program } from 'https://esm.sh/@coral-xyz/anchor@0.29.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  post_id: string
  pool_address: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { post_id, pool_address }: SyncRequest = await req.json()

    if (!post_id || !pool_address) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Solana connection
    const rpcEndpoint = Deno.env.get('SOLANA_RPC_ENDPOINT') || 'http://127.0.0.1:8899'
    const connection = new Connection(rpcEndpoint, 'confirmed')

    // Fetch pool account data
    const poolPubkey = new PublicKey(pool_address)
    const accountInfo = await connection.getAccountInfo(poolPubkey)

    if (!accountInfo) {
      return new Response(
        JSON.stringify({ error: 'Pool account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deserialize pool data (ContentPool struct)
    // Discriminator (8) + post_id (32) + k_quadratic (16) + token_supply (16) + reserve (16)
    const data = accountInfo.data
    const tokenSupply = deserializeU128(data.slice(56, 72)) // token_supply at offset 56
    const reserve = deserializeU128(data.slice(72, 88)) // reserve at offset 72

    // Update database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for updates
    )

    const { error: updateError } = await supabaseClient
      .from('pool_deployments')
      .update({
        token_supply: tokenSupply.toString(),
        reserve_balance: reserve.toString(),
        last_synced_at: new Date().toISOString()
      })
      .eq('post_id', post_id)

    if (updateError) {
      console.error('Failed to update pool data:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        token_supply: tokenSupply.toString(),
        reserve_balance: reserve.toString(),
        synced_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper to deserialize u128 from little-endian bytes
function deserializeU128(bytes: Uint8Array): bigint {
  let value = 0n
  for (let i = 0; i < 16; i++) {
    value += BigInt(bytes[i]) << BigInt(i * 8)
  }
  return value
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncPoolData } from '../_shared/pool-sync.ts'

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
    // For local development, edge functions run in Docker and need host.docker.internal
    // In production, use the configured RPC endpoint
    let rpcEndpoint = Deno.env.get('SOLANA_RPC_ENDPOINT') || 'http://127.0.0.1:8899'

    // If endpoint is localhost/127.0.0.1, convert to host.docker.internal for Docker
    if (rpcEndpoint.includes('127.0.0.1') || rpcEndpoint.includes('localhost')) {
      rpcEndpoint = rpcEndpoint.replace('127.0.0.1', 'host.docker.internal')
      rpcEndpoint = rpcEndpoint.replace('localhost', 'host.docker.internal')
    }

    // Initialize Supabase client with service role for updates
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Sync pool data
    const result = await syncPoolData(
      supabaseClient,
      rpcEndpoint,
      post_id,
      pool_address
    )

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)

    const status = error.message.includes('not found') ? 404 : 500
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

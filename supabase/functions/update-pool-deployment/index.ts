import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdatePoolDeploymentRequest {
  pool_address: string
  tx_signature: string
}

interface UpdatePoolDeploymentResponse {
  success: boolean
  pool_address: string
  tx_signature: string
  confirmed_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Parse request body
    const {
      pool_address,
      tx_signature
    }: UpdatePoolDeploymentRequest = await req.json()

    // Validate required fields
    if (!pool_address || !tx_signature) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: pool_address, tx_signature',
          code: 422
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate Solana address format (base58, 32-44 chars)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!base58Regex.test(pool_address)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid pool_address format (must be base58)',
          code: 422
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!base58Regex.test(tx_signature)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid tx_signature format (must be base58)',
          code: 422
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if pool deployment exists
    const { data: existingPool, error: fetchError } = await supabaseClient
      .from('pool_deployments')
      .select('deployment_tx_signature')
      .eq('pool_address', pool_address)
      .single()

    if (fetchError || !existingPool) {
      return new Response(
        JSON.stringify({
          error: 'Pool deployment not found',
          code: 404
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if already confirmed
    if (existingPool.deployment_tx_signature) {
      return new Response(
        JSON.stringify({
          error: 'Pool deployment already confirmed',
          code: 409,
          existing_signature: existingPool.deployment_tx_signature
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update pool deployment with transaction signature
    const { error: updateError } = await supabaseClient
      .from('pool_deployments')
      .update({
        deployment_tx_signature: tx_signature,
        last_synced_at: new Date().toISOString()
      })
      .eq('pool_address', pool_address)

    if (updateError) {
      console.error('Failed to update pool deployment:', updateError)
      return new Response(
        JSON.stringify({
          error: 'Failed to update pool deployment',
          code: 503
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const response: UpdatePoolDeploymentResponse = {
      success: true,
      pool_address,
      tx_signature,
      confirmed_at: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 500
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StakeValidationRequest {
  agent_id: string
  additional_beliefs?: number
}

interface StakeValidationResponse {
  valid: boolean
  current_effective_stake: number
  projected_effective_stake: number
  min_required: number
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
    const { agent_id, additional_beliefs = 0 }: StakeValidationRequest = await req.json()

    // Validate inputs
    if (!agent_id || agent_id.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'agent_id is required', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get minimum stake requirement from config
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'min_stake_per_belief')
      .single()

    if (configError) {
      console.error('Failed to get min_stake_per_belief:', configError)
      return new Response(
        JSON.stringify({ error: 'Configuration error', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const minRequired = parseFloat(configData.value)

    // Retrieve agent data
    const { data: agentData, error: agentError } = await supabaseClient
      .from('agents')
      .select('total_stake, active_belief_count')
      .eq('id', agent_id)
      .single()

    if (agentError) {
      console.error('Failed to get agent:', agentError)
      return new Response(
        JSON.stringify({ error: 'Agent not found', code: 404 }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate current effective stake
    let currentEffectiveStake: number
    if (agentData.active_belief_count === 0) {
      currentEffectiveStake = agentData.total_stake
    } else {
      currentEffectiveStake = agentData.total_stake / agentData.active_belief_count
    }

    // Calculate projected effective stake
    const projectedCount = agentData.active_belief_count + additional_beliefs
    let projectedEffectiveStake: number
    if (projectedCount === 0) {
      projectedEffectiveStake = agentData.total_stake
    } else {
      projectedEffectiveStake = agentData.total_stake / projectedCount
    }

    // Validate against minimum
    const valid = projectedEffectiveStake >= minRequired

    const response: StakeValidationResponse = {
      valid,
      current_effective_stake: currentEffectiveStake,
      projected_effective_stake: projectedEffectiveStake,
      min_required: minRequired
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
      JSON.stringify({ error: 'Internal server error', code: 500 }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
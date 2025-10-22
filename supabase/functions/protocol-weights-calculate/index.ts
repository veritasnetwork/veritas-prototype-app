import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants from configuration spec
const EPSILON_STAKES = 1e-8
const EPSILON_PROBABILITY = 1e-10

interface WeightsCalculateRequest {
  belief_id: string
  participant_agents: string[]
}

interface WeightsCalculateResponse {
  weights: Record<string, number>
  effective_stakes: Record<string, number>
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
    const { belief_id, participant_agents }: WeightsCalculateRequest = await req.json()

    // 1. Validate inputs
    if (!belief_id || belief_id.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'belief_id is required', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!participant_agents || !Array.isArray(participant_agents) || participant_agents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'participant_agents array is required and must be non-empty', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Calculate effective stakes for each agent
    const effectiveStakes: Record<string, number> = {}

    for (const agentId of participant_agents) {
      // Query agents table by agent_id
      const { data: agentData, error: agentError } = await supabaseClient
        .from('agents')
        .select('total_stake')
        .eq('id', agentId)
        .single()

      if (agentError) {
        console.error(`Failed to get agent ${agentId}:`, agentError)
        return new Response(
          JSON.stringify({ error: 'Agent not found', code: 404 }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Get user_id from agent_id
      const { data: userData } = await supabaseClient
        .from('users')
        .select('id')
        .eq('agent_id', agentId)
        .single()

      if (!userData) {
        return new Response(
          JSON.stringify({ error: 'User not found for agent', code: 404 }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Count open positions for this agent (replaces active_belief_count)
      const { data: openPositions, error: positionsError } = await supabaseClient
        .from('user_pool_balances')
        .select('pool_address')
        .eq('user_id', userData.id)
        .gt('token_balance', 0)

      if (positionsError) {
        console.error(`Failed to get positions for agent ${agentId}:`, positionsError)
        return new Response(
          JSON.stringify({ error: 'Failed to get positions', code: 500 }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const activePositionCount = openPositions?.length || 0

      // Verify agent has active positions (avoid division by zero)
      if (activePositionCount === 0) {
        return new Response(
          JSON.stringify({ error: 'Division by zero - agent has no open positions', code: 501 }),
          {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Calculate: effective_stake = total_stake / active_position_count
      let effectiveStake = agentData.total_stake / activePositionCount

      // Apply minimum: max(effective_stake, EPSILON_STAKES)
      effectiveStake = Math.max(effectiveStake, EPSILON_STAKES)

      // Store in effective_stakes map
      effectiveStakes[agentId] = effectiveStake
    }

    // 3. Normalize stakes to weights
    const weights: Record<string, number> = {}
    
    // Sum all effective_stakes values
    const stakesSum = Object.values(effectiveStakes).reduce((sum, stake) => sum + stake, 0)
    
    if (stakesSum > EPSILON_STAKES) {
      // For each agent: weight = effective_stake / sum
      for (const agentId of participant_agents) {
        weights[agentId] = effectiveStakes[agentId] / stakesSum
      }
    } else {
      // Assign equal weights: 1.0 / number_of_agents (no meaningful stakes)
      const equalWeight = 1.0 / participant_agents.length
      for (const agentId of participant_agents) {
        weights[agentId] = equalWeight
      }
    }

    // 4. Verify normalization
    const weightsSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    if (Math.abs(weightsSum - 1.0) > EPSILON_PROBABILITY) {
      console.error(`Normalization failure: weights sum to ${weightsSum}, expected 1.0`)
      return new Response(
        JSON.stringify({ error: 'Normalization failure', code: 500 }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 5. Return: Weights and effective stakes maps
    const response: WeightsCalculateResponse = {
      weights,
      effective_stakes: effectiveStakes
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
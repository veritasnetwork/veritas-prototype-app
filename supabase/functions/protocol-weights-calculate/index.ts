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
  belief_weights: Record<string, number>  // Raw w_i values (2% of last trade)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with SERVICE_ROLE for protocol operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    // 2. Get pool_address for this belief
    const { data: poolDeployment, error: poolError } = await supabaseClient
      .from('pool_deployments')
      .select('pool_address')
      .eq('belief_id', belief_id)
      .single()

    if (poolError || !poolDeployment) {
      console.error(`No pool deployment found for belief ${belief_id}:`, poolError)
      return new Response(
        JSON.stringify({
          error: `No pool found for belief ${belief_id}. Cannot calculate weights without pool deployment.`,
          code: 404
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const poolAddress = poolDeployment.pool_address
    console.log(`Found pool address for belief ${belief_id}: ${poolAddress}`)

    // 3. Get belief weights (w_i) from user_pool_balances
    // Aggregate LONG + SHORT gross locks per agent
    const beliefWeights: Record<string, number> = {}

    for (const agentId of participant_agents) {
      // Get user_id from agent_id
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('agent_id', agentId)
        .single()

      if (userError || !userData) {
        console.error(`Failed to get user for agent ${agentId}:`, userError)
        return new Response(
          JSON.stringify({ error: `User not found for agent ${agentId}`, code: 404 }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get belief_locks for both LONG and SHORT positions
      const { data: locks, error: balanceError } = await supabaseClient
        .from('user_pool_balances')
        .select('belief_lock, token_balance')
        .eq('user_id', userData.id)
        .eq('pool_address', poolAddress)
        .gt('token_balance', 0)

      if (balanceError) {
        console.error(`Failed to get balance for agent ${agentId}, pool ${poolAddress}:`, balanceError)
        return new Response(
          JSON.stringify({ error: 'Failed to get user balance', code: 500 }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Aggregate gross locks (LONG + SHORT)
      let grossLock = 0
      for (const lock of locks || []) {
        grossLock += lock.belief_lock || 0
      }

      // If no open positions, use zero weight
      if (grossLock === 0) {
        console.log(`Agent ${agentId} has no open position in pool ${poolAddress}, w_i = 0`)
        beliefWeights[agentId] = 0
        continue
      }

      // Apply minimum threshold
      beliefWeights[agentId] = Math.max(grossLock / 1_000_000, EPSILON_STAKES)

      console.log(`Agent ${agentId}: gross_lock = ${grossLock} μUSDC, w_i = ${beliefWeights[agentId]} USDC`)
    }

    // 4. Normalize belief weights to get aggregation weights (sum = 1.0)
    const weights: Record<string, number> = {}

    // Sum all belief_weights values (raw w_i in USDC)
    const totalBeliefWeight = Object.values(beliefWeights).reduce((sum, w) => sum + w, 0)

    if (totalBeliefWeight > EPSILON_STAKES) {
      // For each agent: weight = w_i / Σw_j
      for (const agentId of participant_agents) {
        weights[agentId] = beliefWeights[agentId] / totalBeliefWeight
      }
    } else {
      // All agents have zero weights (no open positions)
      // Assign equal weights: 1.0 / number_of_agents
      console.log(`WARNING: All agents have zero belief weights for belief ${belief_id}. Using equal weights.`)
      const equalWeight = 1.0 / participant_agents.length
      for (const agentId of participant_agents) {
        weights[agentId] = equalWeight
        beliefWeights[agentId] = EPSILON_STAKES  // Set minimum for redistribution
      }
    }

    // 5. Verify normalization (normalized weights should sum to 1.0)
    const normalizedSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    if (Math.abs(normalizedSum - 1.0) > EPSILON_PROBABILITY) {
      console.error(`Normalization failure: weights sum to ${normalizedSum}, expected 1.0`)
      return new Response(
        JSON.stringify({ error: 'Normalization failure', code: 500 }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 5. Return: Weights (normalized) and belief_weights (raw w_i)
    const response: WeightsCalculateResponse = {
      weights,
      belief_weights: beliefWeights
    }

    console.log(`Weights calculation complete for belief ${belief_id}:`)
    console.log(`  - Participants: ${participant_agents.length}`)
    console.log(`  - Total belief weight: ${totalBeliefWeight.toFixed(4)} USDC`)
    console.log(`  - Normalized weights:`, weights)

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
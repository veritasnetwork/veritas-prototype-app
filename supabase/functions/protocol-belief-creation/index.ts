import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BeliefCreationRequest {
  agent_id: string
  initial_belief: number
  meta_prediction?: number
}

interface BeliefCreationResponse {
  belief_id: string
  initial_aggregate: number
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
    const {
      agent_id,
      initial_belief,
      meta_prediction = initial_belief // Default to initial_belief if not provided
    }: BeliefCreationRequest = await req.json()

    // Validate required fields
    if (!agent_id || typeof initial_belief !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agent_id, initial_belief', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate initial_belief range
    if (initial_belief < 0 || initial_belief > 1) {
      return new Response(
        JSON.stringify({ error: 'initial_belief must be between 0 and 1', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // No stake validation - per stake-mechanics.md, skim auto-collateralizes on trades
    // Belief weights = 2% of last trade amount (per user_pool_balances.belief_lock)

    // New beliefs always start at epoch 0
    // Epoch increments happen per-pool via pool_deployments.current_epoch during settlements
    const currentEpoch = 0

    // Verify agent exists
    const { data: agentData, error: agentError } = await supabaseClient
      .from('agents')
      .select('id')
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

    // Create belief record
    const { data: belief, error: beliefError } = await supabaseClient
      .from('beliefs')
      .insert({
        creator_agent_id: agent_id,
        created_epoch: currentEpoch,
        previous_aggregate: initial_belief,
        previous_disagreement_entropy: 0.0
      })
      .select()
      .single()

    if (beliefError) {
      console.error('Failed to create belief:', beliefError)
      return new Response(
        JSON.stringify({ error: 'Database error', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // No need to update active_belief_count - that column was deprecated
    // Belief counts are now derived from open positions in user_pool_balances

    // Create initial submission
    const { error: submissionError } = await supabaseClient
      .from('belief_submissions')
      .insert({
        agent_id: agent_id,
        belief_id: belief.id,
        belief: initial_belief,
        meta_prediction: meta_prediction,
        epoch: currentEpoch,
        is_active: true
      })

    if (submissionError) {
      console.error('Failed to create initial submission:', submissionError)
      return new Response(
        JSON.stringify({ error: 'Failed to create submission', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const response: BeliefCreationResponse = {
      belief_id: belief.id,
      initial_aggregate: initial_belief
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
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
  duration_epochs: number
}

interface BeliefCreationResponse {
  belief_id: string
  initial_aggregate: number
  expiration_epoch: number
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
      agent_id, 
      initial_belief, 
      meta_prediction = initial_belief, // Default to initial_belief if not provided
      duration_epochs
    }: BeliefCreationRequest = await req.json()

    // Validate required fields
    if (!agent_id || typeof initial_belief !== 'number' || typeof duration_epochs !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agent_id, initial_belief, duration_epochs', code: 422 }),
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

    // Validate duration_epochs
    if (duration_epochs < 1 || duration_epochs > 1000) {
      return new Response(
        JSON.stringify({ error: 'duration_epochs must be between 1 and 1000', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate stake allocation using epistemic weights function
    const stakeValidationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-weights-validate-stake-allocation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: agent_id,
        additional_beliefs: 1 // This new belief will be added
      })
    })

    const stakeValidationData = await stakeValidationResponse.json()

    if (!stakeValidationResponse.ok) {
      console.error('Failed to validate stake:', stakeValidationData)
      return new Response(
        JSON.stringify({ error: stakeValidationData.error || 'Stake validation failed', code: stakeValidationData.code || 503 }),
        { 
          status: stakeValidationData.code || 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!stakeValidationData.valid) {
      return new Response(
        JSON.stringify({ 
          error: `Insufficient stake. Projected effective stake: $${stakeValidationData.projected_effective_stake.toFixed(2)}, Minimum required: $${stakeValidationData.min_required}`, 
          code: 400 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get current epoch and calculate expiration
    const { data: epochData, error: epochError } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single()

    if (epochError) {
      console.error('Failed to get current_epoch:', epochError)
      return new Response(
        JSON.stringify({ error: 'Configuration error', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const currentEpoch = parseInt(epochData.value)
    const expirationEpoch = currentEpoch + duration_epochs

    // Check for overflow
    if (expirationEpoch >= Math.pow(2, 31)) {
      return new Response(
        JSON.stringify({ error: 'Epoch overflow risk', code: 502 }),
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }


    // BEGIN TRANSACTION
    const { data: agentData, error: agentError } = await supabaseClient
      .from('agents')
      .select('active_belief_count')
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

    // Check max beliefs per agent
    const maxBeliefsPerAgent = 100 // TODO: Get from config
    if (agentData.active_belief_count >= maxBeliefsPerAgent) {
      return new Response(
        JSON.stringify({ error: 'Max beliefs per agent exceeded', code: 504 }),
        { 
          status: 504,
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
        expiration_epoch: expirationEpoch,
        previous_aggregate: initial_belief,
        previous_disagreement_entropy: 0.0,
        status: 'active'
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

    // Update agent's active_belief_count
    const { error: updateError } = await supabaseClient
      .from('agents')
      .update({ active_belief_count: agentData.active_belief_count + 1 })
      .eq('id', agent_id)

    if (updateError) {
      console.error('Failed to update agent belief count:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update agent', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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
      initial_aggregate: initial_belief,
      expiration_epoch: expirationEpoch
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
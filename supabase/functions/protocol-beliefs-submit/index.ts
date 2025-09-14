import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BeliefSubmissionRequest {
  agent_id: string
  belief_id: string
  belief_value: number
  meta_prediction: number
}

interface BeliefSubmissionResponse {
  submission_id: string
  current_epoch: number
  is_first_submission: boolean
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
      belief_id,
      belief_value,
      meta_prediction
    }: BeliefSubmissionRequest = await req.json()

    // 1. Validate inputs
    if (!agent_id || !belief_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agent_id, belief_id', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (typeof belief_value !== 'number' || belief_value < 0 || belief_value > 1) {
      return new Response(
        JSON.stringify({ error: 'belief_value must be a number between 0 and 1', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (typeof meta_prediction !== 'number' || meta_prediction < 0 || meta_prediction > 1) {
      return new Response(
        JSON.stringify({ error: 'meta_prediction must be a number between 0 and 1', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Verify entities exist
    const { data: agentData, error: agentError } = await supabaseClient
      .from('agents')
      .select('id, active_belief_count')
      .eq('id', agent_id)
      .single()

    if (agentError || !agentData) {
      return new Response(
        JSON.stringify({ error: 'Agent not found', code: 404 }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { data: beliefData, error: beliefError } = await supabaseClient
      .from('beliefs')
      .select('id, status, expiration_epoch')
      .eq('id', belief_id)
      .single()

    if (beliefError || !beliefData) {
      return new Response(
        JSON.stringify({ error: 'Belief not found', code: 404 }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Check belief status
    if (beliefData.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Belief is not active', code: 504 }),
        {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get current epoch
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

    // Verify belief hasn't expired
    if (currentEpoch >= beliefData.expiration_epoch) {
      return new Response(
        JSON.stringify({ error: 'Belief has expired', code: 504 }),
        {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 4. BEGIN TRANSACTION
    // 5. Check existing submission
    const { data: existingSubmission, error: existingError } = await supabaseClient
      .from('belief_submissions')
      .select('id')
      .eq('belief_id', belief_id)
      .eq('agent_id', agent_id)
      .maybeSingle()

    if (existingError) {
      console.error('Failed to check existing submission:', existingError)
      return new Response(
        JSON.stringify({ error: 'Database error', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let submissionId: string
    let isFirstSubmission = false

    if (existingSubmission) {
      // 6A. Update existing submission
      const { data: updatedSubmission, error: updateError } = await supabaseClient
        .from('belief_submissions')
        .update({
          belief: belief_value,
          meta_prediction: meta_prediction,
          epoch: currentEpoch,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id)
        .select('id')
        .single()

      if (updateError || !updatedSubmission) {
        console.error('Failed to update submission:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update submission', code: 503 }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      submissionId = updatedSubmission.id
    } else {
      // 6B. Create new submission
      isFirstSubmission = true

      // Validate stake allocation for new participation
      const stakeValidationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-weights-validate-stake-allocation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_id: agent_id,
          additional_beliefs: 1
        })
      })

      const stakeValidationData = await stakeValidationResponse.json()

      if (!stakeValidationResponse.ok || !stakeValidationData.valid) {
        return new Response(
          JSON.stringify({
            error: `Insufficient stake. Projected effective stake: $${stakeValidationData.projected_effective_stake?.toFixed(2) || 'unknown'}, Minimum required: $${stakeValidationData.min_required || 'unknown'}`,
            code: 400
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Insert new submission
      const { data: newSubmission, error: insertError } = await supabaseClient
        .from('belief_submissions')
        .insert({
          agent_id: agent_id,
          belief_id: belief_id,
          belief: belief_value,
          meta_prediction: meta_prediction,
          epoch: currentEpoch,
          is_active: true
        })
        .select('id')
        .single()

      if (insertError || !newSubmission) {
        console.error('Failed to create submission:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create submission', code: 503 }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      submissionId = newSubmission.id

      // Update agent's active_belief_count
      const { error: updateAgentError } = await supabaseClient
        .from('agents')
        .update({
          active_belief_count: agentData.active_belief_count + 1
        })
        .eq('id', agent_id)

      if (updateAgentError) {
        console.error('Failed to update agent belief count:', updateAgentError)
        return new Response(
          JSON.stringify({ error: 'Failed to update agent', code: 503 }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check max beliefs per agent
      const maxBeliefsPerAgent = 100 // TODO: Get from config
      if (agentData.active_belief_count + 1 > maxBeliefsPerAgent) {
        return new Response(
          JSON.stringify({ error: 'Max beliefs per agent exceeded', code: 504 }),
          {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    const response: BeliefSubmissionResponse = {
      submission_id: submissionId,
      current_epoch: currentEpoch,
      is_first_submission: isFirstSubmission
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
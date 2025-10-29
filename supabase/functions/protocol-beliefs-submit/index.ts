import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Boundary constants to match belief decomposition
const BOUNDARY_SAFE_MIN = 0.01  // 1% - safe lower bound
const BOUNDARY_SAFE_MAX = 0.99  // 99% - safe upper bound
const EPSILON_PROBABILITY = 1e-10  // Absolute minimum for numerical stability

interface BeliefSubmissionRequest {
  agent_id: string
  belief_id: string
  belief_value: number
  meta_prediction: number
  epoch: number  // Required: the epoch for this submission (from pool's next epoch)
}

interface BeliefSubmissionResponse {
  submission_id: string
  current_epoch: number
  is_first_submission: boolean
  clamped_belief?: boolean  // Warning flag if belief was clamped
  clamped_meta?: boolean    // Warning flag if meta was clamped
  original_belief?: number  // Original value before clamping
  original_meta?: number    // Original value before clamping
}

/**
 * Clamps probability values to safe boundaries for decomposition
 * Returns clamped value and whether clamping occurred
 */
function clampProbability(value: number): { clamped: number; wasClamped: boolean } {
  if (value < BOUNDARY_SAFE_MIN) {
    console.warn(`Clamping probability ${value} to safe minimum ${BOUNDARY_SAFE_MIN}`)
    return { clamped: BOUNDARY_SAFE_MIN, wasClamped: true }
  }
  if (value > BOUNDARY_SAFE_MAX) {
    console.warn(`Clamping probability ${value} to safe maximum ${BOUNDARY_SAFE_MAX}`)
    return { clamped: BOUNDARY_SAFE_MAX, wasClamped: true }
  }
  return { clamped: value, wasClamped: false }
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
      belief_id,
      belief_value,
      meta_prediction,
      epoch
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

    if (typeof epoch !== 'number' || epoch < 0 || !Number.isInteger(epoch)) {
      return new Response(
        JSON.stringify({ error: 'epoch must be a non-negative integer', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (typeof belief_value !== 'number' || isNaN(belief_value) || !isFinite(belief_value)) {
      return new Response(
        JSON.stringify({ error: 'belief_value must be a valid number', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (typeof meta_prediction !== 'number' || isNaN(meta_prediction) || !isFinite(meta_prediction)) {
      return new Response(
        JSON.stringify({ error: 'meta_prediction must be a valid number', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Reject extreme invalid values (outside [0,1])
    if (belief_value < 0 || belief_value > 1) {
      return new Response(
        JSON.stringify({
          error: 'belief_value must be between 0 and 1',
          code: 400,
          provided: belief_value
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (meta_prediction < 0 || meta_prediction > 1) {
      return new Response(
        JSON.stringify({
          error: 'meta_prediction must be between 0 and 1',
          code: 400,
          provided: meta_prediction
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Clamp to safe boundaries for decomposition
    const beliefResult = clampProbability(belief_value)
    const metaResult = clampProbability(meta_prediction)

    const finalBeliefValue = beliefResult.clamped
    const finalMetaPrediction = metaResult.clamped

    // Track if clamping occurred for response
    const clampingOccurred = beliefResult.wasClamped || metaResult.wasClamped

    if (clampingOccurred) {
      console.log(
        `[belief-submit] Clamped values for agent ${agent_id}: ` +
        `belief ${belief_value} → ${finalBeliefValue}, ` +
        `meta ${meta_prediction} → ${finalMetaPrediction}`
      )
    }

    // 2. Verify entities exist
    const { data: agentData, error: agentError } = await supabaseClient
      .from('agents')
      .select('id')
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
      .select('id')
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

    // 3. Use the provided epoch (no system-wide epoch anymore)
    const submissionEpoch = epoch
    console.log(`[belief-submit] Submitting for belief ${belief_id}, agent ${agent_id}, epoch ${submissionEpoch}`)

    // 4. BEGIN TRANSACTION
    // 5. Check existing submission for this belief/agent/epoch combination
    const { data: existingSubmission, error: existingError } = await supabaseClient
      .from('belief_submissions')
      .select('id')
      .eq('belief_id', belief_id)
      .eq('agent_id', agent_id)
      .eq('epoch', submissionEpoch)
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
      // 6A. Update existing submission for this epoch (use clamped values)
      const { data: updatedSubmission, error: updateError } = await supabaseClient
        .from('belief_submissions')
        .update({
          belief: finalBeliefValue,
          meta_prediction: finalMetaPrediction,
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

      // No stake validation - per stake-mechanics.md, belief weights = 2% of last trade amount
      // Skim auto-collateralizes on trades, no upfront stake requirement

      // Insert new submission (use clamped values)
      const { data: newSubmission, error: insertError } = await supabaseClient
        .from('belief_submissions')
        .insert({
          agent_id: agent_id,
          belief_id: belief_id,
          belief: finalBeliefValue,
          meta_prediction: finalMetaPrediction,
          epoch: submissionEpoch,
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

      // No need to update active_belief_count - that column was deprecated
      // Belief counts are now derived from open positions in user_pool_balances
    }

    const response: BeliefSubmissionResponse = {
      submission_id: submissionId,
      current_epoch: submissionEpoch,
      is_first_submission: isFirstSubmission
    }

    // Add clamping warnings if values were adjusted
    if (beliefResult.wasClamped) {
      response.clamped_belief = true
      response.original_belief = belief_value
    }
    if (metaResult.wasClamped) {
      response.clamped_meta = true
      response.original_meta = meta_prediction
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
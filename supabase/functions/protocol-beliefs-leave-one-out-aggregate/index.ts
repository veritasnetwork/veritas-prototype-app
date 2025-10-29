import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants from configuration spec
const EPSILON_PROBABILITY = 1e-10

interface LeaveOneOutAggregateRequest {
  belief_id: string
  exclude_agent_id: string
  weights: Record<string, number>
}

interface LeaveOneOutAggregateResponse {
  leave_one_out_belief_aggregate: number
  leave_one_out_meta_prediction_aggregate: number
}

// Clamp probability to safe range
function clampProbability(p: number): number {
  return Math.max(EPSILON_PROBABILITY, Math.min(1 - EPSILON_PROBABILITY, p))
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
    const { belief_id, exclude_agent_id, weights }: LeaveOneOutAggregateRequest = await req.json()

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

    if (!exclude_agent_id || exclude_agent_id.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'exclude_agent_id is required', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify excluded agent not in weights
    if (exclude_agent_id in weights) {
      return new Response(
        JSON.stringify({ error: 'Excluded agent should not be in weights map', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify weights sum to 1.0 (if non-empty)
    if (Object.keys(weights).length > 0) {
      const weightsSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
      if (Math.abs(weightsSum - 1.0) > EPSILON_PROBABILITY) {
        return new Response(
          JSON.stringify({ error: 'Weights must sum to 1.0', code: 400 }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 2. Note: This function is deprecated and should not be used
    // Leave-one-out aggregates are now computed by protocol-beliefs-decompose
    // which requires explicit epoch parameter (no system-wide epoch exists)

    // Load latest submission from each agent (not just current epoch)
    // Critical for BTS scoring - need all historical participants, not just current epoch
    const { data: allSubmissions, error: submissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id, belief, meta_prediction, epoch')
      .eq('belief_id', belief_id)
      .neq('agent_id', exclude_agent_id)
      .order('epoch', { ascending: false })

    if (submissionsError) {
      console.error('Failed to load submissions:', submissionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to load submissions', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Group by agent_id and take the latest submission (highest epoch) for each agent
    const latestSubmissions: Record<string, any> = {}
    for (const submission of (allSubmissions || [])) {
      if (!latestSubmissions[submission.agent_id] || submission.epoch > latestSubmissions[submission.agent_id].epoch) {
        latestSubmissions[submission.agent_id] = submission
      }
    }
    const submissions = Object.values(latestSubmissions)

    // If no submissions, return defaults (0.5, 0.5)
    if (!submissions || submissions.length === 0) {
      const response: LeaveOneOutAggregateResponse = {
        leave_one_out_belief_aggregate: 0.5,
        leave_one_out_meta_prediction_aggregate: 0.5
      }

      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Calculate leave-one-out aggregates
    let beliefAggregate = 0.0
    let metaAggregate = 0.0

    for (const submission of submissions) {
      const agentId = submission.agent_id

      // Verify agent_id has weight
      if (!(agentId in weights)) {
        return new Response(
          JSON.stringify({ error: 'Missing weight for participant agent', code: 504 }),
          {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Clamp belief and meta_prediction to safe range
      const clampedBelief = clampProbability(submission.belief)
      const clampedMeta = clampProbability(submission.meta_prediction)

      // Add weighted values to aggregates
      beliefAggregate += weights[agentId] * clampedBelief
      metaAggregate += weights[agentId] * clampedMeta
    }

    // 4. Apply final clamping
    beliefAggregate = clampProbability(beliefAggregate)
    metaAggregate = clampProbability(metaAggregate)

    // 5. Return leave-one-out aggregates
    const response: LeaveOneOutAggregateResponse = {
      leave_one_out_belief_aggregate: beliefAggregate,
      leave_one_out_meta_prediction_aggregate: metaAggregate
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
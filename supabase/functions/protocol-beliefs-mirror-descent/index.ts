import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EPSILON_PROBABILITY = 1e-10

interface MirrorDescentRequest {
  belief_id: string
  pre_mirror_descent_aggregate: number
  certainty: number
  active_agent_indicators: string[]
  weights: Record<string, number>
}

interface MirrorDescentResponse {
  updated_beliefs: Record<string, number>
  post_mirror_descent_aggregate: number
  post_mirror_descent_disagreement_entropy: number
}

// Helper function to clamp probability values
function clampProbability(value: number): number {
  return Math.max(EPSILON_PROBABILITY, Math.min(1 - EPSILON_PROBABILITY, value))
}

// Helper function to call internal aggregation function
async function callAggregationFunction(supabaseUrl: string, anonKey: string, beliefId: string, weights: Record<string, number>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/protocol-beliefs-aggregate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      belief_id: beliefId,
      weights: weights
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Aggregation failed: ${JSON.stringify(errorData)}`)
  }

  return response.json()
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Parse and validate request
    const { belief_id, pre_mirror_descent_aggregate, certainty, active_agent_indicators, weights }: MirrorDescentRequest = await req.json()

    if (!belief_id) {
      return new Response(JSON.stringify({ error: 'belief_id is required' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (pre_mirror_descent_aggregate < 0 || pre_mirror_descent_aggregate > 1) {
      return new Response(JSON.stringify({ error: 'pre_mirror_descent_aggregate must be in [0,1]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (certainty < 0 || certainty > 1) {
      return new Response(JSON.stringify({ error: 'certainty must be in [0,1]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Begin transaction
    const { data: submissions, error: submissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('id, agent_id, belief')
      .eq('belief_id', belief_id)

    if (submissionsError) {
      throw new Error(`Failed to load submissions: ${submissionsError.message}`)
    }

    if (!submissions || submissions.length === 0) {
      return new Response(JSON.stringify({ error: 'No submissions found for belief' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Apply mirror descent updates
    const learning_rate = certainty
    const P_pre = clampProbability(pre_mirror_descent_aggregate)
    const updated_beliefs: Record<string, number> = {}
    const updatesToApply = []

    console.log(`Mirror descent: learning_rate=${learning_rate}, P_pre=${P_pre}`)
    console.log(`Active agents: ${active_agent_indicators.join(', ')}`)

    for (const submission of submissions) {
      if (active_agent_indicators.includes(submission.agent_id)) {
        // Active agents: Keep belief unchanged (no mirror descent)
        updated_beliefs[submission.agent_id] = submission.belief
        console.log(`Agent ${submission.agent_id}: ACTIVE - belief unchanged: ${submission.belief}`)
      } else {
        // Passive agents: Apply mirror descent update
        const p_old = clampProbability(submission.belief)
        let p_new: number

        if (learning_rate >= 1 - EPSILON_PROBABILITY) {
          // Full convergence
          p_new = P_pre
        } else if (learning_rate <= EPSILON_PROBABILITY) {
          // No update
          p_new = p_old
        } else {
          // Apply multiplicative update rule
          const alpha = learning_rate
          const numerator = Math.pow(p_old, 1 - alpha) * Math.pow(P_pre, alpha)
          const denominator = Math.pow(p_old, 1 - alpha) * Math.pow(P_pre, alpha) +
                            Math.pow(1 - p_old, 1 - alpha) * Math.pow(1 - P_pre, alpha)

          if (denominator <= EPSILON_PROBABILITY) {
            p_new = p_old // Fallback for numerical stability
          } else {
            p_new = numerator / denominator
          }
        }

        p_new = clampProbability(p_new)
        updated_beliefs[submission.agent_id] = p_new

        console.log(`Agent ${submission.agent_id}: PASSIVE - ${p_old.toFixed(4)} → ${p_new.toFixed(4)}`)

        // Track update for bulk database operation
        updatesToApply.push({
          id: submission.id,
          belief: p_new
        })
      }
    }

    // Bulk update database
    for (const update of updatesToApply) {
      const { error: updateError } = await supabaseClient
        .from('belief_submissions')
        .update({ belief: update.belief })
        .eq('id', update.id)

      if (updateError) {
        throw new Error(`Failed to update submission ${update.id}: ${updateError.message}`)
      }
    }

    console.log(`Updated ${updatesToApply.length} passive agents via mirror descent`)

    // Recalculate post-mirror descent metrics
    let aggregationResult;
    try {
      aggregationResult = await callAggregationFunction(supabaseUrl, anonKey, belief_id, weights)
    } catch (error) {
      // If aggregation fails, it might be because the belief doesn't exist
      if (error.message.includes('No submissions found')) {
        return new Response(JSON.stringify({ error: 'Belief not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      throw error
    }

    const response: MirrorDescentResponse = {
      updated_beliefs,
      post_mirror_descent_aggregate: aggregationResult.pre_mirror_descent_aggregate, // This is now post-mirror descent
      post_mirror_descent_disagreement_entropy: aggregationResult.jensen_shannon_disagreement_entropy
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Mirror descent error:', error)
    return new Response(
      JSON.stringify({
        error: 'Mirror descent failed',
        details: error.message,
        code: 500
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
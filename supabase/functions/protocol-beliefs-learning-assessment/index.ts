import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EPSILON_PROBABILITY = 1e-10

interface LearningAssessmentRequest {
  belief_id: string
  post_mirror_descent_disagreement_entropy: number
  post_mirror_descent_aggregate: number
}

interface LearningAssessmentResponse {
  learning_occurred: boolean
  disagreement_entropy_reduction: number
  economic_learning_rate: number
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

    // Parse and validate request
    const { belief_id, post_mirror_descent_disagreement_entropy, post_mirror_descent_aggregate }: LearningAssessmentRequest = await req.json()

    if (!belief_id) {
      return new Response(JSON.stringify({ error: 'belief_id is required' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (post_mirror_descent_disagreement_entropy < 0 || post_mirror_descent_disagreement_entropy > 1) {
      return new Response(JSON.stringify({ error: 'entropy must be in [0,1]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (typeof post_mirror_descent_aggregate !== 'number' || post_mirror_descent_aggregate < 0 || post_mirror_descent_aggregate > 1) {
      return new Response(JSON.stringify({ error: 'post_mirror_descent_aggregate must be a number in [0,1]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Begin transaction - retrieve belief state
    const { data: belief, error: beliefError } = await supabaseClient
      .from('beliefs')
      .select('previous_disagreement_entropy')
      .eq('id', belief_id)
      .single()

    if (beliefError || !belief) {
      return new Response(JSON.stringify({ error: 'Belief not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const previous_entropy = belief.previous_disagreement_entropy || 0

    console.log(`Learning assessment for belief ${belief_id}:`)
    console.log(`  Previous entropy: ${previous_entropy}`)
    console.log(`  Post-mirror descent entropy: ${post_mirror_descent_disagreement_entropy}`)

    // Calculate entropy reduction
    const reduction = Math.max(0, previous_entropy - post_mirror_descent_disagreement_entropy) // Ensure no negative due to rounding

    // Determine if learning occurred
    const learning_occurred = reduction > EPSILON_PROBABILITY

    // Calculate economic learning rate
    let economic_learning_rate: number
    if (previous_entropy < EPSILON_PROBABILITY) {
      // First epoch or near-zero previous entropy
      economic_learning_rate = 0.0
    } else {
      economic_learning_rate = Math.max(0, Math.min(1, reduction / previous_entropy)) // Clamp to [0,1]
    }

    console.log(`  Entropy reduction: ${reduction}`)
    console.log(`  Learning occurred: ${learning_occurred}`)
    console.log(`  Economic learning rate: ${economic_learning_rate}`)

    // Update belief state with both entropy and aggregate
    const { error: updateBeliefError } = await supabaseClient
      .from('beliefs')
      .update({
        previous_disagreement_entropy: post_mirror_descent_disagreement_entropy,
        previous_aggregate: post_mirror_descent_aggregate ?? 0.5 // Default to neutral if NULL
      })
      .eq('id', belief_id)

    if (updateBeliefError) {
      throw new Error(`Failed to update belief: ${updateBeliefError.message}`)
    }

    // Update agent active status: ALL submissions become passive after epoch processing
    // Agents must resubmit in the next epoch to remain active
    const { data: activeSubmissions, error: getActiveError } = await supabaseClient
      .from('belief_submissions')
      .select('id')
      .eq('belief_id', belief_id)
      .eq('is_active', true)

    if (getActiveError) {
      throw new Error(`Failed to get active submissions: ${getActiveError.message}`)
    }

    if (activeSubmissions && activeSubmissions.length > 0) {
      const { error: updateActiveError } = await supabaseClient
        .from('belief_submissions')
        .update({
          is_active: false
        })
        .eq('belief_id', belief_id)
        .eq('is_active', true)

      if (updateActiveError) {
        throw new Error(`Failed to update active status: ${updateActiveError.message}`)
      }

      console.log(`  Turned ${activeSubmissions.length} active agents passive (epoch processing complete)`)
    }

    const response: LearningAssessmentResponse = {
      learning_occurred,
      disagreement_entropy_reduction: reduction,
      economic_learning_rate
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Learning assessment error:', error)
    return new Response(
      JSON.stringify({
        error: 'Learning assessment failed',
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
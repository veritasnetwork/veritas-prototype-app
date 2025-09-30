import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants from configuration spec
const EPSILON_PROBABILITY = 1e-10

interface BTSScoringRequest {
  belief_id: string
  post_mirror_descent_beliefs: Record<string, number>
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
  normalized_weights: Record<string, number>
  agent_meta_predictions: Record<string, number>
}

interface BTSScoringResponse {
  bts_scores: Record<string, number>
  information_scores: Record<string, number>
  winners: string[]
  losers: string[]
}

// Clamp probability to safe range
function clampProbability(p: number): number {
  return Math.max(EPSILON_PROBABILITY, Math.min(1 - EPSILON_PROBABILITY, p))
}

// Binary KL divergence: D_KL(p || q) = p*log(p/q) + (1-p)*log((1-p)/(1-q))
function binaryKLDivergence(p: number, q: number): number {
  const pClamped = clampProbability(p)
  const qClamped = clampProbability(q)

  return pClamped * Math.log(pClamped / qClamped) +
         (1 - pClamped) * Math.log((1 - pClamped) / (1 - qClamped))
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const {
      belief_id,
      post_mirror_descent_beliefs,
      leave_one_out_aggregates,
      leave_one_out_meta_aggregates,
      normalized_weights,
      agent_meta_predictions
    }: BTSScoringRequest = await req.json()

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

    if (!post_mirror_descent_beliefs || Object.keys(post_mirror_descent_beliefs).length === 0) {
      return new Response(
        JSON.stringify({ error: 'post_mirror_descent_beliefs is required and must be non-empty', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate all required objects have matching agent sets
    const agentIds = Object.keys(post_mirror_descent_beliefs)

    for (const agentId of agentIds) {
      if (!(agentId in leave_one_out_aggregates)) {
        return new Response(
          JSON.stringify({ error: `Missing leave_one_out_aggregate for agent ${agentId}`, code: 422 }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      if (!(agentId in leave_one_out_meta_aggregates)) {
        return new Response(
          JSON.stringify({ error: `Missing leave_one_out_meta_aggregate for agent ${agentId}`, code: 422 }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      if (!(agentId in normalized_weights)) {
        return new Response(
          JSON.stringify({ error: `Missing normalized_weight for agent ${agentId}`, code: 422 }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      if (!(agentId in agent_meta_predictions)) {
        return new Response(
          JSON.stringify({ error: `Missing meta_prediction for agent ${agentId}`, code: 422 }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 2. Calculate BTS scores for each agent
    const btsScores: Record<string, number> = {}
    const informationScores: Record<string, number> = {}

    for (const agentId of agentIds) {
      const pi = post_mirror_descent_beliefs[agentId]
      const pBarMinusI = leave_one_out_aggregates[agentId]
      const mBarMinusI = leave_one_out_meta_aggregates[agentId]
      const mi = agent_meta_predictions[agentId]
      const weight = normalized_weights[agentId]

      // BTS score: s_i = D_KL(p_i || m̄_{-i}) - D_KL(p_i || p̄_{-i}) - D_KL(p̄_{-i} || m_i)
      const term1 = binaryKLDivergence(pi, mBarMinusI)  // Information gain vs meta-predictions
      const term2 = binaryKLDivergence(pi, pBarMinusI)  // Information gain vs beliefs
      const term3 = binaryKLDivergence(pBarMinusI, mi)  // Prediction accuracy penalty

      const btsScore = term1 - term2 - term3
      const informationScore = weight * btsScore

      btsScores[agentId] = btsScore
      informationScores[agentId] = informationScore
    }

    // 3. Partition into winners and losers
    const winners: string[] = []
    const losers: string[] = []

    for (const agentId of agentIds) {
      if (informationScores[agentId] > 0) {
        winners.push(agentId)
      } else if (informationScores[agentId] < 0) {
        losers.push(agentId)
      }
      // Note: agents with exactly 0 information score are neither winners nor losers
    }

    // 4. Return BTS scoring results
    const response: BTSScoringResponse = {
      bts_scores: btsScores,
      information_scores: informationScores,
      winners: winners,
      losers: losers
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error in BTS scoring:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 500 }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
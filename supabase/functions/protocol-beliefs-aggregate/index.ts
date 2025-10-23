import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants from configuration spec
const EPSILON_PROBABILITY = 1e-10

interface BeliefsAggregateRequest {
  belief_id: string
  weights: Record<string, number>
}

interface BeliefsAggregateResponse {
  aggregate: number
  jensen_shannon_disagreement_entropy: number
  normalized_disagreement_entropy: number
  certainty: number
  agent_meta_predictions: Record<string, number>
  active_agent_indicators: string[]
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
}

// Binary entropy function H(p) = -p*log2(p) - (1-p)*log2(1-p)
function binaryEntropy(p: number): number {
  // Handle edge cases: H(p) = 0 when p ≈ 0 or p ≈ 1
  if (p <= EPSILON_PROBABILITY || p >= 1 - EPSILON_PROBABILITY) {
    return 0
  }
  return -(p * Math.log2(p)) - ((1 - p) * Math.log2(1 - p))
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
    const { belief_id, weights }: BeliefsAggregateRequest = await req.json()

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

    if (!weights || Object.keys(weights).length === 0) {
      return new Response(
        JSON.stringify({ error: 'weights object is required and must be non-empty', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify weights sum to 1.0
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

    // 2. Load filteredSubmissions from current epoch
    const { data: currentEpochData } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single()

    const currentEpoch = parseInt(currentEpochData?.value || '0')

    // Load latest submission from each agent (not just current epoch)
    // We need all agent beliefs to compute the aggregate, not just current epoch
    const { data: submissions, error: submissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id, belief, meta_prediction, is_active, epoch')
      .eq('belief_id', belief_id)
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
    for (const submission of (submissions || [])) {
      if (!latestSubmissions[submission.agent_id] || submission.epoch > latestSubmissions[submission.agent_id].epoch) {
        latestSubmissions[submission.agent_id] = submission
      }
    }
    const filteredSubmissions = Object.values(latestSubmissions)

    if (!filteredSubmissions || filteredSubmissions.length === 0) {
      console.log(`No submissions found for belief ${belief_id} - returning neutral defaults`)
      return new Response(
        JSON.stringify({
          aggregate: 0.5, // Neutral
          jensen_shannon_disagreement_entropy: 0.0,
          normalized_disagreement_entropy: 0.0,
          certainty: 0.0, // No certainty without submissions
          agent_meta_predictions: {},
          active_agent_indicators: [],
          leave_one_out_aggregates: {},
          leave_one_out_meta_aggregates: {}
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Additional validation: ensure we have at least one submission
    if (filteredSubmissions.length < 1) {
      console.error(`Insufficient filteredSubmissions for aggregation: ${filteredSubmissions.length} < 1`)
      return new Response(
        JSON.stringify({
          error: 'Insufficient filteredSubmissions for aggregation',
          code: 422,
          submission_count: filteredSubmissions.length
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Calculate weighted aggregate
    let aggregate = 0.0
    const agentMetaPredictions: Record<string, number> = {}
    const activeAgentIndicators: string[] = []

    for (const submission of filteredSubmissions) {
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

      // Clamp belief to safe range
      const clampedBelief = clampProbability(submission.belief)

      // Add weighted belief to aggregate
      aggregate += weights[agentId] * clampedBelief

      // Store meta prediction
      agentMetaPredictions[agentId] = submission.meta_prediction

      // Track active agents
      if (submission.is_active) {
        activeAgentIndicators.push(agentId)
      }
    }

    // Clamp final aggregate
    aggregate = clampProbability(aggregate)

    // 4. Calculate Jensen-Shannon disagreement entropy
    // Calculate H_avg = Σ(weight × H(belief)) for all agents
    let hAvg = 0.0
    for (const submission of filteredSubmissions) {
      const agentId = submission.agent_id
      const clampedBelief = clampProbability(submission.belief)
      const entropy = binaryEntropy(clampedBelief)
      hAvg += weights[agentId] * entropy
    }

    // Calculate H_agg = H(aggregate)
    const hAgg = binaryEntropy(aggregate)

    // Jensen-Shannon disagreement: D_JS = H_agg - H_avg
    let jensenShannonDisagreement = hAgg - hAvg

    // Ensure D_JS ≥ 0 (numerical stability)
    jensenShannonDisagreement = Math.max(0, jensenShannonDisagreement)

    // Normalize: D_JS_norm = min(1.0, D_JS)
    const normalizedDisagreementEntropy = Math.min(1.0, jensenShannonDisagreement)

    // Certainty = 1.0 - D_JS_norm
    const certainty = 1.0 - normalizedDisagreementEntropy

    // 5. Calculate leave-one-out aggregates for BTS scoring
    const leaveOneOutAggregates: Record<string, number> = {}
    const leaveOneOutMetaAggregates: Record<string, number> = {}

    for (const targetSubmission of filteredSubmissions) {
      const targetAgentId = targetSubmission.agent_id

      // Calculate belief aggregate excluding target agent
      let leaveOneOutBelief = 0.0
      let leaveOneOutMeta = 0.0
      let remainingWeightSum = 0.0

      for (const submission of filteredSubmissions) {
        if (submission.agent_id !== targetAgentId) {
          const agentWeight = weights[submission.agent_id]
          remainingWeightSum += agentWeight
          leaveOneOutBelief += agentWeight * clampProbability(submission.belief)
          leaveOneOutMeta += agentWeight * clampProbability(submission.meta_prediction)
        }
      }

      // Normalize by remaining weight sum (if any agents remain)
      if (remainingWeightSum > EPSILON_PROBABILITY) {
        leaveOneOutAggregates[targetAgentId] = clampProbability(leaveOneOutBelief / remainingWeightSum)
        leaveOneOutMetaAggregates[targetAgentId] = clampProbability(leaveOneOutMeta / remainingWeightSum)
      } else {
        // If only one agent, leave-one-out is undefined - use neutral values
        leaveOneOutAggregates[targetAgentId] = 0.5
        leaveOneOutMetaAggregates[targetAgentId] = 0.5
      }
    }

    // 6. Return aggregation results
    const response: BeliefsAggregateResponse = {
      aggregate: aggregate,
      jensen_shannon_disagreement_entropy: jensenShannonDisagreement,
      normalized_disagreement_entropy: normalizedDisagreementEntropy,
      certainty: certainty,
      agent_meta_predictions: agentMetaPredictions,
      active_agent_indicators: activeAgentIndicators,
      leave_one_out_aggregates: leaveOneOutAggregates,
      leave_one_out_meta_aggregates: leaveOneOutMetaAggregates
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
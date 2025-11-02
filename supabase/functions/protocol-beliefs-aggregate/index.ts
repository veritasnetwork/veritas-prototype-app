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
  epoch?: number  // Optional: if provided, use this epoch instead of system current_epoch
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
    const { belief_id, weights, epoch: providedEpoch }: BeliefsAggregateRequest = await req.json()

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

    // 2. Epoch parameter is now REQUIRED - no system-wide epoch
    if (providedEpoch === undefined) {
      return new Response(
        JSON.stringify({ error: 'epoch parameter is required. Each belief tracks its own epoch independently.', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const queryEpoch = providedEpoch
    console.log(`Aggregating belief ${belief_id} for epoch ${queryEpoch}`)

    // Load ALL submissions to get latest from each agent (for aggregation)
    // We need latest submission from ALL participants, not just current epoch
    const { data: allSubmissions, error: allSubmissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id, belief, meta_prediction, is_active, epoch, updated_at')
      .eq('belief_id', belief_id)
      .order('updated_at', { ascending: false })

    if (allSubmissionsError) {
      console.error('Failed to load submissions:', allSubmissionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to load submissions', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get most recent submission per agent
    const latestSubmissionsByAgent: Record<string, any> = {}
    const seenAgents = new Set<string>()

    for (const submission of allSubmissions || []) {
      if (!seenAgents.has(submission.agent_id)) {
        // Store latest submission for this agent
        latestSubmissionsByAgent[submission.agent_id] = submission
        seenAgents.add(submission.agent_id)
      }
    }

    // Convert to array for processing
    const filteredSubmissions = Object.values(latestSubmissionsByAgent)

    if (filteredSubmissions.length === 0) {
      console.error(`No submissions found for belief ${belief_id} in epoch ${queryEpoch} - cannot aggregate`)
      return new Response(
        JSON.stringify({
          error: 'No submissions available for aggregation',
          code: 422,
          belief_id: belief_id,
          epoch: queryEpoch,
          message: 'Cannot calculate aggregate without any submissions. Belief must have at least one active submission.'
        }),
        {
          status: 422,
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

      // Track active agents (those who submitted in the query epoch)
      if (submission.epoch === queryEpoch && submission.is_active) {
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
        // If only one agent, leave-one-out is undefined
        // Use the agent's own belief/meta as leave-one-out (since no other agents exist)
        // This preserves the property that BTS scoring still works with single agent
        leaveOneOutAggregates[targetAgentId] = clampProbability(targetSubmission.belief)
        leaveOneOutMetaAggregates[targetAgentId] = clampProbability(targetSubmission.meta_prediction)
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
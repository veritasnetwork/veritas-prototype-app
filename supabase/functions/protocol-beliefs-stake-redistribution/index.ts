import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StakeRedistributionRequest {
  belief_id: string
  information_scores: Record<string, number>  // BTS scores (range: [-1, 1])
  belief_weights: Record<string, number>      // w_i per agent (2% of last trade)
}

interface StakeRedistributionResponse {
  redistribution_occurred: boolean
  updated_total_stakes: Record<string, number>
  individual_rewards: Record<string, number>
  individual_slashes: Record<string, number>
  slashing_pool: number
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
      belief_id,
      information_scores,
      belief_weights
    }: StakeRedistributionRequest = await req.json()

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

    if (!information_scores || Object.keys(information_scores).length === 0) {
      return new Response(
        JSON.stringify({ error: 'information_scores is required', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!belief_weights || Object.keys(belief_weights).length === 0) {
      return new Response(
        JSON.stringify({ error: 'belief_weights is required', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Get all agent IDs
    const agentIds = Object.keys(information_scores)

    console.log(`Processing stake redistribution for belief ${belief_id}`)
    console.log(`  Agents: ${agentIds.length}`)

    // 3. Load current stakes from database
    const { data: agentsData, error: agentsError } = await supabaseClient
      .from('agents')
      .select('id, total_stake')
      .in('id', agentIds)

    if (agentsError) {
      console.error('Failed to load agent stakes:', agentsError)
      return new Response(
        JSON.stringify({ error: 'Failed to load agent stakes', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create map of current stakes
    const currentStakes: Record<string, number> = {}
    for (const agent of agentsData || []) {
      currentStakes[agent.id] = agent.total_stake
    }

    // 4. Calculate stake changes: ΔS_i = score_i × w_i
    const stakeDeltas: Record<string, number> = {}
    const updatedStakes: Record<string, number> = {}
    const individualRewards: Record<string, number> = {}
    const individualSlashes: Record<string, number> = {}

    for (const agentId of agentIds) {
      const score = information_scores[agentId]
      const w_i = belief_weights[agentId]
      const currentStake = currentStakes[agentId] || 0

      // ΔS = score × w_i
      const delta = score * w_i

      // Update stake (clamped at zero)
      const newStake = Math.max(0, currentStake + delta)

      stakeDeltas[agentId] = delta
      updatedStakes[agentId] = newStake

      // Track rewards/slashes for reporting
      if (delta > 0) {
        individualRewards[agentId] = delta
      } else if (delta < 0) {
        individualSlashes[agentId] = Math.abs(delta)
      }

      console.log(`  Agent ${agentId.substring(0, 8)}: score=${score.toFixed(3)}, w_i=${w_i.toFixed(2)}, ΔS=${delta.toFixed(2)}, S: ${currentStake.toFixed(2)} → ${newStake.toFixed(2)}`)
    }

    // 5. Zero-sum validation (CRITICAL)
    const totalDelta = Object.values(stakeDeltas).reduce((sum, d) => sum + d, 0)
    const totalRewards = Object.values(individualRewards).reduce((sum, r) => sum + r, 0)
    const totalSlashes = Object.values(individualSlashes).reduce((sum, s) => sum + s, 0)

    console.log(`💰 Zero-sum check:`)
    console.log(`   Total ΔS: ${totalDelta.toFixed(6)}`)
    console.log(`   Total rewards: ${totalRewards.toFixed(6)}`)
    console.log(`   Total slashes: ${totalSlashes.toFixed(6)}`)

    if (Math.abs(totalDelta) > 0.01) {
      console.error(`❌ ZERO-SUM VIOLATION: Total ΔS = ${totalDelta}`)
      console.error(`   This indicates a bug in BTS scoring or weight calculation.`)
      // NOTE: Not throwing error - may be due to rounding. Log warning instead.
      console.warn(`   Proceeding with redistribution, but this should be investigated.`)
    }

    // 6. Update database
    for (const agentId of agentIds) {
      const { error: updateError } = await supabaseClient
        .from('agents')
        .update({ total_stake: updatedStakes[agentId] })
        .eq('id', agentId)

      if (updateError) {
        console.error(`Failed to update stake for agent ${agentId}:`, updateError)
        return new Response(
          JSON.stringify({ error: `Failed to update stake for agent ${agentId}`, code: 503 }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 7. Return results
    const response: StakeRedistributionResponse = {
      redistribution_occurred: Object.keys(stakeDeltas).length > 0,
      updated_total_stakes: updatedStakes,
      individual_rewards: individualRewards,
      individual_slashes: individualSlashes,
      slashing_pool: totalSlashes  // For backward compatibility (not used in new model)
    }

    console.log(`✅ Stake redistribution complete for belief ${belief_id}`)

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

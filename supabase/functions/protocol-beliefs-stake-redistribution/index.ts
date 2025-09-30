import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StakeRedistributionRequest {
  belief_id: string
  learning_occurred: boolean
  economic_learning_rate: number
  information_scores: Record<string, number>
  winners: string[]
  losers: string[]
  current_effective_stakes: Record<string, number>
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
      learning_occurred,
      economic_learning_rate,
      information_scores,
      winners,
      losers,
      current_effective_stakes
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

    if (typeof learning_occurred !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'learning_occurred must be a boolean', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (typeof economic_learning_rate !== 'number' || economic_learning_rate < 0 || economic_learning_rate > 1) {
      return new Response(
        JSON.stringify({ error: 'economic_learning_rate must be a number between 0 and 1', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Handle no learning case
    if (!learning_occurred) {
      // No redistribution - stakes remain unchanged
      const response: StakeRedistributionResponse = {
        redistribution_occurred: false,
        updated_total_stakes: {}, // No changes
        individual_rewards: {},
        individual_slashes: {},
        slashing_pool: 0
      }

      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Validate learning occurred inputs
    if (!information_scores || Object.keys(information_scores).length === 0) {
      return new Response(
        JSON.stringify({ error: 'information_scores is required when learning occurred', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!current_effective_stakes || Object.keys(current_effective_stakes).length === 0) {
      return new Response(
        JSON.stringify({ error: 'current_effective_stakes is required when learning occurred', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 4. Validate zero-sum: Must have both winners and losers for redistribution
    if ((losers.length > 0 && winners.length === 0) || (winners.length > 0 && losers.length === 0)) {
      console.log('Zero-sum constraint: No redistribution when only winners or only losers')
      const response: StakeRedistributionResponse = {
        redistribution_occurred: false,
        updated_total_stakes: {},
        individual_rewards: {},
        individual_slashes: {},
        slashing_pool: 0
      }
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 5. Calculate slashing pool from loser stakes
    let slashing_pool = 0
    if (losers && losers.length > 0) {
      for (const loserId of losers) {
        if (!(loserId in current_effective_stakes)) {
          return new Response(
            JSON.stringify({ error: `Missing effective stake for loser ${loserId}`, code: 422 }),
            {
              status: 422,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        slashing_pool += economic_learning_rate * current_effective_stakes[loserId]
      }
    }

    // 5. Calculate individual slashes for losers
    const individualSlashes: Record<string, number> = {}
    let totalLoserWeight = 0

    // Calculate total absolute information scores for losers
    for (const loserId of losers) {
      if (!(loserId in information_scores)) {
        return new Response(
          JSON.stringify({ error: `Missing information score for loser ${loserId}`, code: 422 }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      totalLoserWeight += Math.abs(information_scores[loserId])
    }

    // Distribute slashes proportionally by information score magnitude
    if (totalLoserWeight > 0) {
      for (const loserId of losers) {
        individualSlashes[loserId] = (Math.abs(information_scores[loserId]) / totalLoserWeight) * slashing_pool
      }
    } else {
      // Edge case: all losers have zero information scores
      // Distribute slashing pool equally among losers
      console.log(`Warning: Zero total loser weight for belief ${belief_id}, distributing slashes equally`)
      const equalSlash = losers.length > 0 ? slashing_pool / losers.length : 0
      for (const loserId of losers) {
        individualSlashes[loserId] = equalSlash
      }
    }

    // 6. Calculate individual rewards for winners
    const individualRewards: Record<string, number> = {}
    let totalWinnerWeight = 0

    // Calculate total information scores for winners (should be positive)
    for (const winnerId of winners) {
      if (!(winnerId in information_scores)) {
        return new Response(
          JSON.stringify({ error: `Missing information score for winner ${winnerId}`, code: 422 }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      totalWinnerWeight += Math.abs(information_scores[winnerId]) // Use absolute value for safety
    }

    // Distribute rewards proportionally by information score
    if (totalWinnerWeight > 0) {
      for (const winnerId of winners) {
        individualRewards[winnerId] = (Math.abs(information_scores[winnerId]) / totalWinnerWeight) * slashing_pool
      }
    } else {
      // Edge case: all winners have zero information scores
      // Distribute slashing pool equally among winners
      console.log(`Warning: Zero total winner weight for belief ${belief_id}, distributing rewards equally`)
      const equalReward = winners.length > 0 ? slashing_pool / winners.length : 0
      for (const winnerId of winners) {
        individualRewards[winnerId] = equalReward
      }
    }

    // 7. Calculate updated total stakes
    // First, get current total stakes for all agents from database
    const agentIds = Object.keys(current_effective_stakes)
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

    const updatedTotalStakes: Record<string, number> = {}

    // Start with current total stakes
    for (const agent of agentsData || []) {
      updatedTotalStakes[agent.id] = agent.total_stake
    }

    // Apply slashes to losers
    for (const loserId of losers) {
      if (loserId in updatedTotalStakes) {
        updatedTotalStakes[loserId] -= individualSlashes[loserId]
        // Ensure stakes don't go negative
        updatedTotalStakes[loserId] = Math.max(0, updatedTotalStakes[loserId])
      }
    }

    // Apply rewards to winners
    for (const winnerId of winners) {
      if (winnerId in updatedTotalStakes) {
        updatedTotalStakes[winnerId] += individualRewards[winnerId]
      }
    }

    // 7.5. Zero-sum conservation check (CRITICAL_FIXES.md Priority 2 Issue #7)
    const totalRewards = Object.values(individualRewards).reduce((a, b) => a + b, 0)
    const totalSlashes = Object.values(individualSlashes).reduce((a, b) => a + b, 0)
    const conservationError = Math.abs(totalRewards - totalSlashes)

    console.log(`💰 Conservation check: rewards=${totalRewards.toFixed(6)}, slashes=${totalSlashes.toFixed(6)}, error=${conservationError.toFixed(6)}`)

    if (conservationError > 0.001) {
      console.error(`❌ Zero-sum violation in redistribution for belief ${belief_id}`)
      console.error(`   Total rewards: ${totalRewards}`)
      console.error(`   Total slashes: ${totalSlashes}`)
      console.error(`   Conservation error: ${conservationError}`)

      return new Response(
        JSON.stringify({
          error: 'Zero-sum violation in redistribution',
          details: {
            total_rewards: totalRewards,
            total_slashes: totalSlashes,
            conservation_error: conservationError
          },
          code: 500
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 8. Update agent stakes in database
    for (const agentId of Object.keys(updatedTotalStakes)) {
      const { error: updateError } = await supabaseClient
        .from('agents')
        .update({ total_stake: updatedTotalStakes[agentId] })
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

    // 9. Preserve belief submissions for full audit trail
    // All submissions remain intact to maintain complete historical record
    console.log(`Stake redistribution completed for belief ${belief_id}. Submissions preserved for audit trail.`)

    // 10. Return redistribution results
    const response: StakeRedistributionResponse = {
      redistribution_occurred: true,
      updated_total_stakes: updatedTotalStakes,
      individual_rewards: individualRewards,
      individual_slashes: individualSlashes,
      slashing_pool: slashing_pool
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error in stake redistribution:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 500 }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
/**
 * Belief-Specific Epoch Processing
 *
 * Processes a SINGLE belief through the protocol chain:
 * 1. Epistemic Weights
 * 2. Belief Decomposition/Aggregation
 * 3. BTS Scoring
 * 4. Stake Redistribution
 * 5. Record relevance history
 *
 * This function is called on-demand for individual beliefs,
 * unlike the global epoch-process which processes all active beliefs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BeliefEpochProcessRequest {
  belief_id: string
  current_epoch?: number
}

interface BeliefProcessingResult {
  belief_id: string
  participant_count: number
  aggregate: number
  certainty: number
  jensen_shannon_disagreement_entropy: number
  redistribution_occurred: boolean
  slashing_pool: number
}

// Helper function to call internal functions
async function callInternalFunction(supabaseUrl: string, anonKey: string, functionName: string, payload: any) {
  console.log(`[CALL] ${functionName}`)

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      const errorText = await response.text();
      throw new Error(`${functionName} failed (${response.status}): ${errorText}`);
    }
    throw new Error(`${functionName} failed: ${JSON.stringify(errorData)}`);
  }

  return await response.json();
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

    // Parse request body
    const requestBody: BeliefEpochProcessRequest = await req.json()
    const { belief_id, current_epoch: inputEpoch } = requestBody

    if (!belief_id) {
      return new Response(
        JSON.stringify({ error: 'belief_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current epoch from system config
    const { data: epochData } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single()

    const currentEpoch = inputEpoch ?? parseInt(epochData?.value || '0')

    console.log(`\n🔄 PROCESSING BELIEF ${belief_id.substring(0, 8)}`)
    console.log(`📅 Current epoch: ${currentEpoch}`)
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`)

    // Verify belief exists
    const { data: belief, error: beliefError } = await supabaseClient
      .from('beliefs')
      .select('id')
      .eq('id', belief_id)
      .single()

    if (beliefError || !belief) {
      throw new Error(`Belief not found: ${beliefError?.message || 'Unknown error'}`)
    }

    // Get ALL participants who have ever submitted to this belief market
    const { data: submissions, error: submissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', belief_id)

    if (submissionsError) {
      throw new Error(`Failed to get submissions: ${submissionsError.message}`)
    }

    if (!submissions || submissions.length === 0) {
      throw new Error(`No submissions found for belief ${belief_id.substring(0, 8)}`)
    }

    if (submissions.length < 2) {
      throw new Error(`Insufficient participants for belief ${belief_id.substring(0, 8)} (${submissions.length} < 2)`)
    }

    const participantAgents = [...new Set(submissions.map(s => s.agent_id))] // Get unique participants
    console.log(`👥 Found ${participantAgents.length} unique participants (${submissions.length} total submissions)`)
    console.log(`👥 Participants: ${participantAgents.map(id => id.substring(0, 8)).join(', ')}`)

    // Step 1: Calculate epistemic weights
    const weightsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-weights-calculate', {
      belief_id: belief_id,
      participant_agents: participantAgents
    })

    console.log(`⚖️  Step 1: Calculated weights for ${Object.keys(weightsData.weights).length} agents`)
    const weightSummary = Object.entries(weightsData.weights)
      .map(([id, weight]) => `${id.substring(0, 8)}:${((weight as number) * 100).toFixed(1)}%`)
      .join(', ')
    console.log(`⚖️  Weights: ${weightSummary}`)

    // Step 2: Try belief decomposition first, fall back to aggregation if it fails
    let aggregationData;
    let decompositionUsed = false;

    try {
      // Try decomposition first
      aggregationData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-decompose/decompose', {
        belief_id: belief_id,
        weights: weightsData.weights
      })
      decompositionUsed = true;

      console.log(`📊 Step 2: Belief DECOMPOSITION complete`)
      console.log(`📊 Aggregate: ${(aggregationData.aggregate * 100).toFixed(1)}%`)
      console.log(`📊 Common Prior: ${(aggregationData.common_prior * 100).toFixed(1)}%`)
      console.log(`📊 Decomposition Quality: ${(aggregationData.decomposition_quality * 100).toFixed(1)}%`)
      console.log(`📊 Jensen-Shannon entropy: ${aggregationData.jensen_shannon_disagreement_entropy.toFixed(4)}`)
      console.log(`📊 Certainty: ${(aggregationData.certainty * 100).toFixed(1)}%`)

      // Check decomposition quality - if too low, fall back to naive aggregation
      if (aggregationData.decomposition_quality < 0.3) {
        console.log(`⚠️  Decomposition quality too low (${(aggregationData.decomposition_quality * 100).toFixed(1)}%), falling back to naive aggregation`)
        decompositionUsed = false;
      }
    } catch (decomposeError) {
      console.log(`⚠️  Decomposition failed: ${decomposeError.message}, falling back to naive aggregation`)
      decompositionUsed = false;
    }

    // Fall back to naive aggregation if decomposition failed or quality was too low
    if (!decompositionUsed) {
      aggregationData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-aggregate', {
        belief_id: belief_id,
        weights: weightsData.weights
      })

      console.log(`📊 Step 2: Belief aggregation (naive) complete`)
      console.log(`📊 Aggregate: ${(aggregationData.aggregate * 100).toFixed(1)}%`)
      console.log(`📊 Jensen-Shannon entropy: ${aggregationData.jensen_shannon_disagreement_entropy.toFixed(4)}`)
      console.log(`📊 Certainty: ${(aggregationData.certainty * 100).toFixed(1)}%`)
    }

    // Use aggregation/decomposition result directly as final aggregate (absolute BD relevance)
    const finalAggregate = aggregationData.aggregate

    // Step 3: Update beliefs table with certainty and new previous_aggregate
    const { error: beliefUpdateError } = await supabaseClient
      .from('beliefs')
      .update({
        certainty: aggregationData.certainty,
        previous_aggregate: finalAggregate
      })
      .eq('id', belief_id)

    if (beliefUpdateError) {
      throw new Error(`Failed to update belief: ${beliefUpdateError.message}`)
    }

    console.log(`📊 Belief table updated:`)
    console.log(`   - Absolute relevance: ${(finalAggregate * 100).toFixed(1)}%`)
    console.log(`   - Certainty: ${(aggregationData.certainty * 100).toFixed(1)}%`)

    // Calculate total belief weight (sum of all w_i)
    const totalStake = Object.values(weightsData.belief_weights as Record<string, number>)
      .reduce((sum: number, w: number) => sum + w, 0)

    // Record belief history for charts (absolute BD relevance)
    const { error: historyInsertError } = await supabaseClient
      .from('belief_relevance_history')
      .insert({
        belief_id: belief_id,
        epoch: currentEpoch,
        aggregate: finalAggregate,
        certainty: aggregationData.certainty,
        disagreement_entropy: aggregationData.jensen_shannon_disagreement_entropy,
        participant_count: participantAgents.length,
        total_stake: totalStake,
        recorded_at: new Date().toISOString()
      })

    if (historyInsertError) {
      console.error(`⚠️ Failed to record belief history: ${historyInsertError.message}`)
      // Don't throw - this is not critical to processing
    } else {
      console.log(`📝 Belief history recorded: epoch ${currentEpoch}, relevance ${(finalAggregate * 100).toFixed(1)}%, ${participantAgents.length} participants, $${totalStake.toFixed(2)} total stake`)
    }

    // Step 4: Get active agent indicators for BTS scoring
    const { data: currentEpochSubmissions, error: currentSubmissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id, is_active')
      .eq('belief_id', belief_id)
      .eq('epoch', currentEpoch)

    if (currentSubmissionsError) {
      throw new Error(`Failed to get current epoch submissions: ${currentSubmissionsError.message}`)
    }

    // Agents are active ONLY if they submitted in the current epoch
    const activeAgentIndicators = (currentEpochSubmissions || [])
      .map(s => s.agent_id)

    console.log(`📋 Step 4: Active agents in current epoch: ${activeAgentIndicators.length}/${participantAgents.length}`)
    if (activeAgentIndicators.length > 0) {
      console.log(`📋 Active agents: ${activeAgentIndicators.map(id => id.substring(0, 8)).join(', ')}`)
    }

    // Step 5: BTS Scoring (always run)
    console.log(`\n💰 Proceeding with BTS scoring and redistribution`)

    // Collect agent beliefs and meta-predictions from ALL participants
    // Get most recent submission for each agent (as per spec: score ALL historical participants)
    const { data: allSubmissions, error: allSubmissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id, belief, meta_prediction, epoch, updated_at')
      .eq('belief_id', belief_id)
      .order('updated_at', { ascending: false })

    if (allSubmissionsError) {
      throw new Error(`Failed to get all submissions for BTS: ${allSubmissionsError.message}`)
    }

    // Get most recent submission per agent for BTS scoring
    const agentBeliefs: Record<string, number> = {}
    const agentMetaPredictions: Record<string, number> = {}
    const seenAgents = new Set<string>()

    for (const submission of allSubmissions || []) {
      if (!seenAgents.has(submission.agent_id)) {
        // Use most recent submission for this agent
        agentBeliefs[submission.agent_id] = submission.belief
        agentMetaPredictions[submission.agent_id] = submission.meta_prediction
        seenAgents.add(submission.agent_id)
      }
    }

    console.log(`🎯 BTS Scoring: Including ${Object.keys(agentBeliefs).length} total participants (historical + current)`)
    console.log(`🎯 Active agents in current epoch: ${activeAgentIndicators.length}`)
    console.log(`🎯 Historical participants: ${Object.keys(agentBeliefs).length - activeAgentIndicators.length}`)

    // Get leave-one-out aggregates from aggregation step
    const btsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-bts-scoring', {
      belief_id: belief_id,
      agent_beliefs: agentBeliefs,
      leave_one_out_aggregates: aggregationData.leave_one_out_aggregates,
      leave_one_out_meta_aggregates: aggregationData.leave_one_out_meta_aggregates,
      normalized_weights: weightsData.weights,
      agent_meta_predictions: agentMetaPredictions
    })

    console.log(`🎯 Step 5: BTS scoring complete`)
    console.log(`🎯 Information scores calculated for ${Object.keys(btsData.information_scores).length} agents`)
    console.log(`🎯 Winners: ${btsData.winners.length} agents (${btsData.winners.map(id => id.substring(0, 8)).join(', ')})`)
    console.log(`🎯 Losers: ${btsData.losers.length} agents (${btsData.losers.map(id => id.substring(0, 8)).join(', ')})`)
    const scoresSummary = Object.entries(btsData.information_scores)
      .map(([id, score]) => `${id.substring(0, 8)}:${(score as number).toFixed(3)}`)
      .join(', ')
    console.log(`🎯 Information scores: ${scoresSummary}`)

    // Step 6: Stake Redistribution (ΔS = score × w_i)
    const redistributionData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-stake-redistribution', {
      belief_id: belief_id,
      information_scores: btsData.information_scores
    })

    console.log(`💰 Step 6: Stake redistribution complete`)
    console.log(`💰 Redistribution occurred: ${redistributionData.redistribution_occurred ? '✅ YES' : '❌ NO'}`)
    console.log(`💰 Slashing pool: $${redistributionData.slashing_pool.toFixed(2)}`)
    if (redistributionData.redistribution_occurred) {
      const totalRewards = Object.values(redistributionData.individual_rewards).reduce((a: number, b: number) => a + b, 0)
      const totalSlashes = Object.values(redistributionData.individual_slashes).reduce((a: number, b: number) => a + b, 0)
      console.log(`💰 Total rewards distributed: $${totalRewards.toFixed(2)}`)
      console.log(`💰 Total stakes slashed: $${totalSlashes.toFixed(2)}`)
      console.log(`💰 Zero-sum check: ${Math.abs(totalRewards - totalSlashes) < 0.01 ? '✅' : '❌'} (diff: $${Math.abs(totalRewards - totalSlashes).toFixed(4)})`)

      // Log individual changes
      Object.entries(redistributionData.individual_rewards).forEach(([id, reward]) => {
        if ((reward as number) > 0) console.log(`💰   ${id.substring(0, 8)}: +$${(reward as number).toFixed(2)} (reward)`)
      })
      Object.entries(redistributionData.individual_slashes).forEach(([id, slash]) => {
        if ((slash as number) > 0) console.log(`💰   ${id.substring(0, 8)}: -$${(slash as number).toFixed(2)} (slash)`)
      })
    }

    console.log(`\n✅ Belief ${belief_id.substring(0, 8)} processing complete`)

    // Return processing result
    const result: BeliefProcessingResult = {
      belief_id: belief_id,
      participant_count: participantAgents.length,
      aggregate: finalAggregate,
      certainty: aggregationData.certainty,
      jensen_shannon_disagreement_entropy: aggregationData.jensen_shannon_disagreement_entropy,
      redistribution_occurred: redistributionData.redistribution_occurred,
      slashing_pool: redistributionData.slashing_pool
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ BELIEF PROCESSING ERROR:', error)
    console.error('❌ Stack trace:', error.stack)
    return new Response(
      JSON.stringify({
        error: 'Belief processing failed',
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

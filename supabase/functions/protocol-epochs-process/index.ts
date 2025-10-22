/**
 * DEPRECATED: protocol-epochs-process (Global Epoch Processing)
 *
 * This function is DEPRECATED in favor of per-belief processing.
 *
 * NEW ARCHITECTURE:
 * - Use `protocol-belief-epoch-process` to process individual beliefs on-demand
 * - No global epochs - each pool has independent `current_epoch` counter
 * - Settlement is per-pool via `pool-settle-single` or POST /api/pools/settle
 *
 * This function remains for backward compatibility only.
 * It can still batch-process multiple beliefs, but this is not the recommended approach.
 *
 * ⚠️ WARNING: This function uses the OLD effective_stakes model (S/n).
 * After the belief weight refactor, this may produce incorrect results.
 * The refactored functions use belief_weights (w_i = 2% of last trade).
 *
 * @deprecated Use protocol-belief-epoch-process instead
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EpochProcessingRequest {
  current_epoch?: number
}

/**
 * @deprecated This interface uses effective_stakes which has been replaced by belief_weights.
 * This function is deprecated and should not be used.
 */
interface BeliefProcessingResult {
  belief_id: string
  participant_count: number
  weights: Record<string, number>
  effective_stakes: Record<string, number>  // DEPRECATED: Use belief_weights
  aggregate: number
  jensen_shannon_disagreement_entropy: number
  certainty: number
}

interface EpochProcessingResponse {
  processed_beliefs: BeliefProcessingResult[]
  expired_beliefs: string[]
  next_epoch: number
  errors: string[]
}

// Helper function to call internal functions
async function callInternalFunction(supabaseUrl: string, anonKey: string, functionName: string, payload: any) {
  console.log(`Calling ${functionName} with payload:`, JSON.stringify(payload));

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log(`Response from ${functionName}: status=${response.status}, headers=`, Object.fromEntries(response.headers));

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
      console.log(`Error JSON from ${functionName}:`, errorData);
    } catch (e) {
      const errorText = await response.text();
      console.log(`Error text from ${functionName}:`, errorText);
      throw new Error(`${functionName} failed (${response.status}): ${errorText}`);
    }
    throw new Error(`${functionName} failed: ${JSON.stringify(errorData)}`);
  }

  try {
    const result = await response.json();
    console.log(`Success result from ${functionName}:`, result);
    return result;
  } catch (e) {
    const responseText = await response.text();
    console.log(`Invalid JSON response from ${functionName}:`, responseText);
    throw new Error(`${functionName} returned invalid JSON: ${responseText}`);
  }
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
    let requestBody: EpochProcessingRequest = {};
    try {
      requestBody = await req.json() || {};
    } catch (e) {
      console.log('Warning: Failed to parse request body as JSON, using defaults:', e.message);
      requestBody = {};
    }
    const { current_epoch: inputEpoch } = requestBody;

    // 1. Get current epoch from system config
    const { data: epochData } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single()

    const currentEpoch = inputEpoch ?? parseInt(epochData?.value || '0')
    const nextEpoch = currentEpoch + 1

    console.log(`🚀 STARTING EPOCH PROCESSING`)
    console.log(`📅 Current epoch: ${currentEpoch} → Next epoch: ${nextEpoch}`)
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`)

    // 2. Get all active beliefs
    const { data: activeBeliefs, error: beliefsError } = await supabaseClient
      .from('beliefs')
      .select('id, expiration_epoch')
      .eq('status', 'active')

    if (beliefsError) {
      throw new Error(`Failed to get active beliefs: ${beliefsError.message}`)
    }

    const beliefs = activeBeliefs || []
    console.log(`📋 Found ${beliefs.length} active beliefs total`)
    if (beliefs.length > 0) {
      console.log(`📋 Active beliefs: ${beliefs.map(b => b.id.substring(0, 8)).join(', ')}`)
    }

    // 3. Check expiration (before processing)
    const expiredBeliefs = beliefs.filter(belief => belief.expiration_epoch <= currentEpoch)
    const remainingBeliefs = beliefs.filter(belief => belief.expiration_epoch > currentEpoch)

    console.log(`⏳ Belief expiration analysis:`)
    console.log(`   - ${expiredBeliefs.length} beliefs expired (will be deleted)`)
    console.log(`   - ${remainingBeliefs.length} beliefs remaining (will be processed)`)
    if (expiredBeliefs.length > 0) {
      console.log(`⏳ Expired beliefs: ${expiredBeliefs.map(b => b.id.substring(0, 8)).join(', ')}`)
    }

    const processedBeliefs: BeliefProcessingResult[] = []
    const errors: string[] = []

    // 4. Process remaining beliefs through simplified protocol chain
    for (const belief of remainingBeliefs) {
      try {
        console.log(`\n🔄 PROCESSING BELIEF ${belief.id.substring(0, 8)}...`)
        console.log(`🔄 Expiration epoch: ${belief.expiration_epoch} (${belief.expiration_epoch - currentEpoch} epochs remaining)`)

        // Get ALL participants who have ever submitted to this belief market
        const { data: submissions, error: submissionsError } = await supabaseClient
          .from('belief_submissions')
          .select('agent_id')
          .eq('belief_id', belief.id)

        if (submissionsError) {
          throw new Error(`Failed to get submissions: ${submissionsError.message}`)
        }

        if (!submissions || submissions.length === 0) {
          console.log(`⚠️  No submissions found for belief ${belief.id.substring(0, 8)}, skipping`)
          continue
        }

        if (submissions.length < 2) {
          console.log(`⚠️  Insufficient participants for belief ${belief.id.substring(0, 8)} (${submissions.length} < 2), skipping`)
          continue
        }

        const participantAgents = [...new Set(submissions.map(s => s.agent_id))] // Get unique participants
        console.log(`👥 Found ${participantAgents.length} unique participants (${submissions.length} total submissions)`)
        console.log(`👥 Participants: ${participantAgents.map(id => id.substring(0, 8)).join(', ')}`)

        // Step 1: Calculate epistemic weights
        const weightsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-weights-calculate', {
          belief_id: belief.id,
          participant_agents: participantAgents
        })

        console.log(`⚖️  Step 1: Calculated weights for ${Object.keys(weightsData.weights).length} agents`)
        const weightSummary = Object.entries(weightsData.weights)
          .map(([id, weight]) => `${id.substring(0, 8)}:${(weight * 100).toFixed(1)}%`)
          .join(', ')
        console.log(`⚖️  Weights: ${weightSummary}`)

        // Step 2: Try belief decomposition first, fall back to aggregation if it fails
        let aggregationData;
        let decompositionUsed = false;

        try {
          // Try decomposition first
          aggregationData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-decompose/decompose', {
            belief_id: belief.id,
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
            belief_id: belief.id,
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
          .eq('id', belief.id)

        if (beliefUpdateError) {
          throw new Error(`Failed to update belief: ${beliefUpdateError.message}`)
        }

        console.log(`📊 Belief table updated:`)
        console.log(`   - Absolute relevance: ${(finalAggregate * 100).toFixed(1)}%`)
        console.log(`   - Certainty: ${(aggregationData.certainty * 100).toFixed(1)}%`)

        // Calculate total stake from effective stakes
        const totalStake = Object.values(weightsData.effective_stakes as Record<string, number>)
          .reduce((sum: number, stake: number) => sum + stake, 0)

        // Record belief history for charts (absolute BD relevance)
        const { error: historyInsertError } = await supabaseClient
          .from('belief_relevance_history')
          .insert({
            belief_id: belief.id,
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
          // Don't throw - this is not critical to epoch processing
        } else {
          console.log(`📝 Belief history recorded: epoch ${currentEpoch}, relevance ${(finalAggregate * 100).toFixed(1)}%, ${participantAgents.length} participants, $${totalStake.toFixed(2)} total stake`)
        }

        // Step 4: Get active agent indicators for BTS scoring
        const { data: currentEpochSubmissions, error: currentSubmissionsError } = await supabaseClient
          .from('belief_submissions')
          .select('agent_id, is_active')
          .eq('belief_id', belief.id)
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

        let btsData = null
        let redistributionData = null

        // Step 5: BTS Scoring (always run)
        console.log(`\n💰 Proceeding with BTS scoring and redistribution`)

        // Collect agent beliefs and meta-predictions from ALL participants
        // Get most recent submission for each agent (as per spec: score ALL historical participants)
        const { data: allSubmissions, error: allSubmissionsError } = await supabaseClient
          .from('belief_submissions')
          .select('agent_id, belief, meta_prediction, epoch, updated_at')
          .eq('belief_id', belief.id)
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
        btsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-bts-scoring', {
          belief_id: belief.id,
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
          .map(([id, score]) => `${id.substring(0, 8)}:${score.toFixed(3)}`)
          .join(', ')
        console.log(`🎯 Information scores: ${scoresSummary}`)

        // Step 6: Stake Redistribution (always 100%)
        redistributionData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-stake-redistribution', {
          belief_id: belief.id,
          information_scores: btsData.information_scores,
          winners: btsData.winners,
          losers: btsData.losers,
          current_effective_stakes: weightsData.effective_stakes
        })

        console.log(`💰 Step 6: Stake redistribution complete`)
        console.log(`💰 Redistribution occurred: ${redistributionData.redistribution_occurred ? '✅ YES' : '❌ NO'}`)
        console.log(`💰 Slashing pool: $${redistributionData.slashing_pool.toFixed(2)}`)
        if (redistributionData.redistribution_occurred) {
          const totalRewards = Object.values(redistributionData.individual_rewards).reduce((a, b) => a + b, 0)
          const totalSlashes = Object.values(redistributionData.individual_slashes).reduce((a, b) => a + b, 0)
          console.log(`💰 Total rewards distributed: $${totalRewards.toFixed(2)}`)
          console.log(`💰 Total stakes slashed: $${totalSlashes.toFixed(2)}`)
          console.log(`💰 Zero-sum check: ${Math.abs(totalRewards - totalSlashes) < 0.01 ? '✅' : '❌'} (diff: $${Math.abs(totalRewards - totalSlashes).toFixed(4)})`)

          // Log individual changes
          Object.entries(redistributionData.individual_rewards).forEach(([id, reward]) => {
            if (reward > 0) console.log(`💰   ${id.substring(0, 8)}: +$${reward.toFixed(2)} (reward)`)
          })
          Object.entries(redistributionData.individual_slashes).forEach(([id, slash]) => {
            if (slash > 0) console.log(`💰   ${id.substring(0, 8)}: -$${slash.toFixed(2)} (slash)`)
          })
        }

        // Store processing result
        processedBeliefs.push({
          belief_id: belief.id,
          participant_count: participantAgents.length,
          weights: weightsData.weights,
          effective_stakes: weightsData.effective_stakes,
          aggregate: finalAggregate,
          jensen_shannon_disagreement_entropy: aggregationData.jensen_shannon_disagreement_entropy,
          certainty: aggregationData.certainty
        })

        console.log(`✅ Belief ${belief.id.substring(0, 8)} processing complete\n`)

      } catch (error) {
        const errorMsg = `Failed to process belief ${belief.id.substring(0, 8)}: ${error.message}`
        console.error(`❌ ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    // 5. Handle expired beliefs (delete completely)
    if (expiredBeliefs.length > 0) {
      console.log(`\n🗑️  CLEANING UP EXPIRED BELIEFS`)
    }
    for (const expiredBelief of expiredBeliefs) {
      try {
        console.log(`🗑️  Deleting expired belief ${expiredBelief.id.substring(0, 8)}...`)

        // First delete all related submissions
        const { error: submissionDeleteError } = await supabaseClient
          .from('belief_submissions')
          .delete()
          .eq('belief_id', expiredBelief.id)

        if (submissionDeleteError) {
          console.error(`🗑️  Warning: Failed to delete submissions for ${expiredBelief.id.substring(0, 8)}:`, submissionDeleteError)
        }

        // Then delete the belief record itself
        const { error: beliefDeleteError } = await supabaseClient
          .from('beliefs')
          .delete()
          .eq('id', expiredBelief.id)

        if (beliefDeleteError) {
          throw new Error(`Failed to delete belief: ${beliefDeleteError.message}`)
        }

        console.log(`🗑️  ✅ Deleted expired belief ${expiredBelief.id.substring(0, 8)} and its submissions`)
      } catch (error) {
        const errorMsg = `Failed to delete expired belief ${expiredBelief.id.substring(0, 8)}: ${error.message}`
        console.error(`🗑️  ❌ ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    // 6. Pool Settlement (if Solana is configured)
    // NOTE: Users can trigger settlement via /api/pools/settle immediately after BD completes
    // This step settles any remaining pools that users haven't settled yet
    console.log(`\n⚖️  POOL SETTLEMENT (AUTO)`)
    console.log(`⚖️  Users can settle pools immediately via /api/pools/settle - this settles remaining pools`)
    try {
      const settlementData = await callInternalFunction(supabaseUrl, anonKey, 'pool-settlement', {})

      if (settlementData.pools_settled !== undefined) {
        console.log(`✅ Pool settlement complete`)
        console.log(`⚖️  Pools settled: ${settlementData.pools_settled}`)
        console.log(`⚖️  Pools failed: ${settlementData.pools_failed}`)

        if (settlementData.failed_pools && settlementData.failed_pools.length > 0) {
          console.log(`⚠️  Failed pools:`)
          settlementData.failed_pools.forEach(f => {
            console.log(`   - ${f.pool_address}: ${f.error}`)
          })
        }

        if (settlementData.successful_pools) {
          console.log(`⚖️  Successfully settled ${settlementData.successful_pools.length} pools`)
          console.log(`⚖️  (Some pools may have been settled earlier by users)`)
        }
      } else {
        console.log(`⚠️  Pool settlement skipped: ${settlementData.message || 'No data returned'}`)
      }
    } catch (error) {
      console.error(`⚠️  Pool settlement failed (non-critical): ${error.message}`)
      // Don't add to errors array - pool settlement is optional (Solana may not be configured or users may have settled already)
    }

    // 7. Update global epoch
    console.log(`\n🔄 FINALIZING EPOCH TRANSITION`)
    const { error: epochUpdateError } = await supabaseClient
      .from('system_config')
      .update({ value: nextEpoch.toString() })
      .eq('key', 'current_epoch')

    if (epochUpdateError) {
      console.error(`❌ Failed to update epoch: ${epochUpdateError.message}`)
      errors.push(`Failed to update epoch: ${epochUpdateError.message}`)
    } else {
      console.log(`✅ Updated global epoch: ${currentEpoch} → ${nextEpoch}`)
    }

    // 8. Return processing summary
    console.log(`\n📊 EPOCH PROCESSING SUMMARY`)
    console.log(`📊 Processed beliefs: ${processedBeliefs.length}`)
    console.log(`📊 Expired beliefs: ${expiredBeliefs.length}`)
    console.log(`📊 Errors encountered: ${errors.length}`)
    console.log(`📊 Final epoch: ${nextEpoch}`)
    console.log(`📊 Processing completed at: ${new Date().toISOString()}`)

    if (errors.length > 0) {
      console.log(`📊 Errors summary:`)
      errors.forEach((error, i) => console.log(`   ${i + 1}. ${error}`))
    }

    const response: EpochProcessingResponse = {
      processed_beliefs: processedBeliefs,
      expired_beliefs: expiredBeliefs.map(b => b.id),
      next_epoch: nextEpoch,
      errors: errors
    }

    console.log(`🚀 EPOCH PROCESSING COMPLETE\n`)

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ CRITICAL EPOCH PROCESSING ERROR:', error)
    console.error('❌ Stack trace:', error.stack)
    return new Response(
      JSON.stringify({
        error: 'Epoch processing failed',
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EpochProcessingRequest {
  current_epoch?: number
}

interface BeliefProcessingResult {
  belief_id: string
  participant_count: number
  weights: Record<string, number>
  effective_stakes: Record<string, number>
  pre_mirror_descent_aggregate: number
  post_mirror_descent_aggregate: number
  jensen_shannon_disagreement_entropy: number
  post_mirror_descent_disagreement_entropy: number
  certainty: number
  learning_occurred: boolean
  economic_learning_rate: number
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

        // Step 2: Calculate belief aggregation
        const aggregationData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-aggregate', {
          belief_id: belief.id,
          weights: weightsData.weights
        })

        console.log(`📊 Step 2: Belief aggregation complete`)
        console.log(`📊 Pre-mirror descent aggregate: ${(aggregationData.pre_mirror_descent_aggregate * 100).toFixed(1)}%`)
        console.log(`📊 Jensen-Shannon entropy: ${aggregationData.jensen_shannon_disagreement_entropy.toFixed(4)}`)
        console.log(`📊 Certainty: ${(aggregationData.certainty * 100).toFixed(1)}%`)

        // Step 3: Get active agent indicators - only agents who submitted in current epoch are active
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

        console.log(`📋 Step 3: Active agents in current epoch: ${activeAgentIndicators.length}/${participantAgents.length}`)
        if (activeAgentIndicators.length > 0) {
          console.log(`📋 Active agents: ${activeAgentIndicators.map(id => id.substring(0, 8)).join(', ')}`)
        }

        // Step 4: Apply mirror descent
        const mirrorDescentData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-mirror-descent', {
          belief_id: belief.id,
          pre_mirror_descent_aggregate: aggregationData.pre_mirror_descent_aggregate,
          certainty: aggregationData.certainty,
          active_agent_indicators: activeAgentIndicators,
          weights: weightsData.weights
        })

        console.log(`🎯 Step 4: Mirror descent complete`)
        console.log(`🎯 Post-mirror descent aggregate: ${(mirrorDescentData.post_mirror_descent_aggregate * 100).toFixed(1)}%`)
        console.log(`🎯 Post-mirror descent entropy: ${mirrorDescentData.post_mirror_descent_disagreement_entropy.toFixed(4)}`)
        const entropyChange = aggregationData.jensen_shannon_disagreement_entropy - mirrorDescentData.post_mirror_descent_disagreement_entropy
        console.log(`🎯 Entropy change: ${entropyChange.toFixed(4)} (${entropyChange > 0 ? 'decreased' : 'increased'})`)

        // Step 5: Learning assessment
        const learningAssessmentData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-learning-assessment', {
          belief_id: belief.id,
          post_mirror_descent_disagreement_entropy: mirrorDescentData.post_mirror_descent_disagreement_entropy,
          post_mirror_descent_aggregate: mirrorDescentData.post_mirror_descent_aggregate
        })

        console.log(`🧠 Step 5: Learning assessment complete`)
        console.log(`🧠 Learning occurred: ${learningAssessmentData.learning_occurred ? '✅ YES' : '❌ NO'}`)
        console.log(`🧠 Economic learning rate: ${(learningAssessmentData.economic_learning_rate * 100).toFixed(1)}%`)
        if (learningAssessmentData.learning_occurred) {
          console.log(`🧠 Disagreement entropy reduction: ${learningAssessmentData.disagreement_entropy_reduction?.toFixed(4) || 'N/A'}`)
        }

        let btsData = null
        let redistributionData = null

        // Step 6: BTS Scoring (only if learning occurred)
        if (learningAssessmentData.learning_occurred) {
          console.log(`\n💰 LEARNING DETECTED - Proceeding with BTS scoring and redistribution`)

          // Collect post-mirror descent beliefs and meta-predictions from ALL participants
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
          const postMirrorDescentBeliefs: Record<string, number> = {}
          const agentMetaPredictions: Record<string, number> = {}
          const seenAgents = new Set<string>()

          for (const submission of allSubmissions || []) {
            if (!seenAgents.has(submission.agent_id)) {
              // Use most recent submission for this agent
              postMirrorDescentBeliefs[submission.agent_id] = submission.belief
              agentMetaPredictions[submission.agent_id] = submission.meta_prediction
              seenAgents.add(submission.agent_id)
            }
          }

          console.log(`🎯 BTS Scoring: Including ${Object.keys(postMirrorDescentBeliefs).length} total participants (historical + current)`)
          console.log(`🎯 Active agents in current epoch: ${activeAgentIndicators.length}`)
          console.log(`🎯 Historical participants: ${Object.keys(postMirrorDescentBeliefs).length - activeAgentIndicators.length}`)

          // Get leave-one-out aggregates from aggregation step
          btsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-bts-scoring', {
            belief_id: belief.id,
            post_mirror_descent_beliefs: postMirrorDescentBeliefs,
            leave_one_out_aggregates: aggregationData.leave_one_out_aggregates,
            leave_one_out_meta_aggregates: aggregationData.leave_one_out_meta_aggregates,
            normalized_weights: weightsData.weights,
            agent_meta_predictions: agentMetaPredictions
          })

          console.log(`🎯 Step 6: BTS scoring complete`)
          console.log(`🎯 Information scores calculated for ${Object.keys(btsData.information_scores).length} agents`)
          console.log(`🎯 Winners: ${btsData.winners.length} agents (${btsData.winners.map(id => id.substring(0, 8)).join(', ')})`)
          console.log(`🎯 Losers: ${btsData.losers.length} agents (${btsData.losers.map(id => id.substring(0, 8)).join(', ')})`)
          const scoresSummary = Object.entries(btsData.information_scores)
            .map(([id, score]) => `${id.substring(0, 8)}:${score.toFixed(3)}`)
            .join(', ')
          console.log(`🎯 Information scores: ${scoresSummary}`)

          // Step 7: Stake Redistribution
          redistributionData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-stake-redistribution', {
            belief_id: belief.id,
            learning_occurred: learningAssessmentData.learning_occurred,
            economic_learning_rate: learningAssessmentData.economic_learning_rate,
            information_scores: btsData.information_scores,
            winners: btsData.winners,
            losers: btsData.losers,
            current_effective_stakes: weightsData.effective_stakes
          })

          console.log(`💰 Step 7: Stake redistribution complete`)
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
        } else {
          console.log(`🧠 No learning occurred - skipping BTS scoring and stake redistribution`)
        }

        // Store processing result
        processedBeliefs.push({
          belief_id: belief.id,
          participant_count: participantAgents.length,
          weights: weightsData.weights,
          effective_stakes: weightsData.effective_stakes,
          pre_mirror_descent_aggregate: aggregationData.pre_mirror_descent_aggregate,
          post_mirror_descent_aggregate: mirrorDescentData.post_mirror_descent_aggregate,
          jensen_shannon_disagreement_entropy: aggregationData.jensen_shannon_disagreement_entropy,
          post_mirror_descent_disagreement_entropy: mirrorDescentData.post_mirror_descent_disagreement_entropy,
          certainty: aggregationData.certainty,
          learning_occurred: learningAssessmentData.learning_occurred,
          economic_learning_rate: learningAssessmentData.economic_learning_rate
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

    // 6. Update global epoch
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

    // 7. Return processing summary
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

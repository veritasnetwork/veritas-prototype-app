import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserActivityRequest {
  agent_ids?: string[]
  limit?: number
  offset?: number
}

interface AgentActivity {
  agent_id: string
  total_stake: number
  active_belief_count: number
  submissions: Array<{
    submission_id: string
    belief_id: string
    belief_value: number
    meta_prediction: number
    epoch: number
    is_active: boolean
    stake_allocated: number
    created_at: string
    updated_at: string
    belief_info: {
      creator_agent_id: string
      created_epoch: number
      expiration_epoch: number
      current_aggregate: number
      current_disagreement_entropy: number
      status: string
    }
  }>
}

interface UserActivityResponse {
  agent_activities: AgentActivity[]
  total_count: number
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
    const { agent_ids, limit = 50, offset = 0 }: UserActivityRequest = await req.json()

    // 1. Validate inputs
    if (limit > 100 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 100', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (offset < 0) {
      return new Response(
        JSON.stringify({ error: 'Offset must be non-negative', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Query agents with optional filtering
    let agentsQuery = supabaseClient
      .from('agents')
      .select('id, total_stake, active_belief_count, created_at')
      .order('created_at', { ascending: false })

    if (agent_ids && agent_ids.length > 0) {
      agentsQuery = agentsQuery.in('id', agent_ids)
    } else {
      agentsQuery = agentsQuery.range(offset, offset + limit - 1)
    }

    const { data: agentsData, error: agentsError, count: totalCount } = await agentsQuery

    if (agentsError) {
      console.error('Failed to query agents:', agentsError)
      return new Response(
        JSON.stringify({ error: 'Failed to query agents', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. For each agent, get their submissions and enrich data
    const agentActivities: AgentActivity[] = []

    for (const agent of agentsData || []) {
      // Get submissions for this agent
      const { data: submissionsData, error: submissionsError } = await supabaseClient
        .from('belief_submissions')
        .select('id, belief_id, belief, meta_prediction, epoch, is_active, created_at, updated_at')
        .eq('agent_id', agent.id)
        .order('updated_at', { ascending: false })

      if (submissionsError) {
        console.error(`Failed to get submissions for agent ${agent.id}:`, submissionsError)
        // Continue with other agents instead of failing completely
        continue
      }

      // Get belief info for all submissions (batch query)
      const beliefIds = submissionsData?.map(s => s.belief_id) || []
      let beliefsMap: Record<string, any> = {}

      if (beliefIds.length > 0) {
        const { data: beliefsData, error: beliefsError } = await supabaseClient
          .from('beliefs')
          .select('id, creator_agent_id, created_epoch, expiration_epoch, previous_aggregate, previous_disagreement_entropy, status')
          .in('id', beliefIds)

        if (!beliefsError && beliefsData) {
          beliefsMap = beliefsData.reduce((acc, belief) => {
            acc[belief.id] = belief
            return acc
          }, {} as Record<string, any>)
        }
      }

      // Calculate stakes for all submissions (batch call if possible)
      const enrichedSubmissions = []

      for (const submission of submissionsData || []) {
        let stakeAllocated = 0

        // Calculate stake using protocol weights function
        try {
          const stakeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-weights-calculate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              belief_id: submission.belief_id,
              participant_agents: [agent.id]
            })
          })

          if (stakeResponse.ok) {
            const stakeData = await stakeResponse.json()
            stakeAllocated = stakeData.effective_stakes[agent.id] || 0
          }
        } catch (error) {
          console.warn(`Failed to calculate stake for agent ${agent.id} belief ${submission.belief_id}:`, error)
          // Default to simple calculation if protocol function fails
          stakeAllocated = agent.active_belief_count > 0 ? agent.total_stake / agent.active_belief_count : 0
        }

        const beliefInfo = beliefsMap[submission.belief_id]

        enrichedSubmissions.push({
          submission_id: submission.id,
          belief_id: submission.belief_id,
          belief_value: submission.belief,
          meta_prediction: submission.meta_prediction,
          epoch: submission.epoch,
          is_active: submission.is_active,
          stake_allocated: stakeAllocated,
          created_at: submission.created_at,
          updated_at: submission.updated_at,
          belief_info: beliefInfo ? {
            creator_agent_id: beliefInfo.creator_agent_id,
            created_epoch: beliefInfo.created_epoch,
            expiration_epoch: beliefInfo.expiration_epoch,
            current_aggregate: beliefInfo.previous_aggregate,
            current_disagreement_entropy: beliefInfo.previous_disagreement_entropy,
            status: beliefInfo.status
          } : {
            creator_agent_id: '',
            created_epoch: 0,
            expiration_epoch: 0,
            current_aggregate: 0,
            current_disagreement_entropy: 0,
            status: 'unknown'
          }
        })
      }

      agentActivities.push({
        agent_id: agent.id,
        total_stake: agent.total_stake,
        active_belief_count: agent.active_belief_count,
        submissions: enrichedSubmissions
      })
    }

    const response: UserActivityResponse = {
      agent_activities: agentActivities,
      total_count: agent_ids ? agentActivities.length : (totalCount || 0)
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
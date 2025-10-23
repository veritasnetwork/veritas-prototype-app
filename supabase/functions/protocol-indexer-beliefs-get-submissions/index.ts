import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BeliefSubmissionsRequest {
  belief_id: string
}

interface BeliefSubmissionsResponse {
  belief_id: string
  belief_info: {
    creator_agent_id: string
    created_epoch: number
    previous_aggregate: number
    previous_disagreement_entropy: number
  }
  submissions: Array<{
    submission_id: string
    user: {
      id: string
      username: string
      display_name: string
    }
    agent_id: string
    belief: number
    meta_prediction: number
    epoch: number
    is_active: boolean
    stake_allocated: number
    created_at: string
    updated_at: string
  }>
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
    const { belief_id }: BeliefSubmissionsRequest = await req.json()

    // Validate belief_id format (basic UUID check)
    if (!belief_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(belief_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid belief_id format', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify belief exists and get belief info
    const { data: beliefData, error: beliefError } = await supabaseClient
      .from('beliefs')
      .select('*')
      .eq('id', belief_id)
      .single()

    if (beliefError || !beliefData) {
      return new Response(
        JSON.stringify({ error: 'Belief not found', code: 404 }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get all submissions for this belief (we'll join with users separately)
    const { data: submissionsData, error: submissionsError } = await supabaseClient
      .from('belief_submissions')
      .select(`
        id,
        agent_id,
        belief,
        meta_prediction,
        epoch,
        is_active,
        created_at,
        updated_at
      `)
      .eq('belief_id', belief_id)
      .order('created_at', { ascending: false })

    if (submissionsError) {
      console.error('Failed to fetch submissions:', submissionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch submissions', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get agent IDs and fetch user data
    const agentIds = submissionsData?.map(s => s.agent_id) || []
    let usersMap: Record<string, any> = {}

    if (agentIds.length > 0) {
      // Get users by agent_id
      const { data: usersData, error: usersError } = await supabaseClient
        .from('users')
        .select('id, username, display_name, agent_id')
        .in('agent_id', agentIds)

      if (!usersError && usersData) {
        // Create map for quick lookup by agent_id
        usersMap = usersData.reduce((acc, user) => {
          acc[user.agent_id] = user
          return acc
        }, {} as Record<string, any>)
      }
    }

    // Calculate stake allocations for each submission
    const enrichedSubmissions = []

    for (const submission of submissionsData || []) {
      let stakeAllocated = 0

      try {
        // Call epistemic weights function to calculate stake
        const stakeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-weights-calculate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            belief_id: belief_id,
            participant_agents: [submission.agent_id]
          })
        })

        if (stakeResponse.ok) {
          const stakeData = await stakeResponse.json()
          stakeAllocated = stakeData.belief_weights[submission.agent_id] || 0
        } else {
          console.warn(`Failed to calculate stake for agent ${submission.agent_id}`)
        }
      } catch (error) {
        console.warn(`Error calculating stake for agent ${submission.agent_id}:`, error)
      }

      const user = usersMap[submission.agent_id]

      enrichedSubmissions.push({
        submission_id: submission.id,
        user: {
          id: user?.id || 'unknown',
          username: user?.username || 'Unknown',
          display_name: user?.display_name || 'Unknown User'
        },
        agent_id: submission.agent_id,
        belief: submission.belief,
        meta_prediction: submission.meta_prediction,
        epoch: submission.epoch,
        is_active: submission.is_active,
        stake_allocated: stakeAllocated,
        created_at: submission.created_at,
        updated_at: submission.updated_at
      })
    }

    const response: BeliefSubmissionsResponse = {
      belief_id,
      belief_info: {
        creator_agent_id: beliefData.creator_agent_id,
        created_epoch: beliefData.created_epoch,
        previous_aggregate: beliefData.previous_aggregate,
        previous_disagreement_entropy: beliefData.previous_disagreement_entropy
      },
      submissions: enrichedSubmissions
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
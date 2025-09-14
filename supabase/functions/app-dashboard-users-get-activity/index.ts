import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DashboardUsersRequest {
  user_ids?: string[]
  limit?: number
  offset?: number
}

interface UserDashboardActivity {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  agent_id: string
  total_stake: number
  active_belief_count: number
  belief_participations: Array<{
    submission_id: string
    belief_id: string
    belief_value: number
    meta_prediction: number
    stake_allocated: number
    is_active: boolean
    created_at: string
    updated_at: string
    belief_info: {
      creator_agent_id: string
      created_epoch: number
      expiration_epoch: number
      current_aggregate: number
      status: string
    }
    post_context?: {
      post_id: string
      title: string
      content_preview: string
      created_at: string
      post_type: 'opinion'
    } | null
  }>
}

interface DashboardUsersResponse {
  users: UserDashboardActivity[]
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
    const { user_ids, limit = 20, offset = 0 }: DashboardUsersRequest = await req.json()

    // 1. Validate inputs
    if (limit > 50 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 50', code: 422 }),
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

    // 2. Get users with agent mapping
    let usersQuery = supabaseClient
      .from('users')
      .select('id, username, display_name, avatar_url, agent_id, total_stake, beliefs_created, beliefs_participated, created_at')
      .order('created_at', { ascending: false })

    if (user_ids && user_ids.length > 0) {
      usersQuery = usersQuery.in('id', user_ids)
    } else {
      usersQuery = usersQuery.range(offset, offset + limit - 1)
    }

    const { data: usersData, error: usersError, count: totalCount } = await usersQuery

    if (usersError) {
      console.error('Failed to query users:', usersError)
      return new Response(
        JSON.stringify({ error: 'Failed to query users', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!usersData || usersData.length === 0) {
      return new Response(
        JSON.stringify({ users: [], total_count: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Get protocol activity data
    const agentIds = usersData.map(user => user.agent_id).filter(id => id)

    const protocolResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-indexer-users-get-activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_ids: agentIds,
        limit: 100 // Get all agent data for the filtered users
      })
    })

    let protocolData: any = { agent_activities: [] }
    if (protocolResponse.ok) {
      protocolData = await protocolResponse.json()
    } else {
      console.warn('Failed to get protocol activity data:', await protocolResponse.text())
    }

    // 4. Map protocol data to agents
    const agentActivitiesMap = protocolData.agent_activities.reduce((acc: any, activity: any) => {
      acc[activity.agent_id] = activity
      return acc
    }, {})

    // 5. Get all belief IDs for post context lookup
    const allBeliefIds = new Set<string>()
    for (const activity of protocolData.agent_activities) {
      for (const submission of activity.submissions) {
        allBeliefIds.add(submission.belief_id)
      }
    }

    // 6. Batch query for post context
    const postContextMap: Record<string, any> = {}
    if (allBeliefIds.size > 0) {
      const { data: postsData, error: postsError } = await supabaseClient
        .from('posts')
        .select('id, title, content, created_at, opinion_belief_id')
        .in('opinion_belief_id', Array.from(allBeliefIds))

      if (!postsError && postsData) {
        for (const post of postsData) {
          postContextMap[post.opinion_belief_id] = {
            post_id: post.id,
            title: post.title || 'Untitled',
            content_preview: post.content ? post.content.substring(0, 200) : '',
            created_at: post.created_at,
            post_type: 'opinion'
          }
        }
      }
    }

    // 7. Format for dashboard consumption
    const dashboardUsers: UserDashboardActivity[] = []

    for (const user of usersData) {
      const agentActivity = agentActivitiesMap[user.agent_id]

      const beliefParticipations = agentActivity ? agentActivity.submissions.map((submission: any) => ({
        submission_id: submission.submission_id,
        belief_id: submission.belief_id,
        belief_value: submission.belief_value,
        meta_prediction: submission.meta_prediction,
        stake_allocated: submission.stake_allocated,
        is_active: submission.is_active,
        created_at: submission.created_at,
        updated_at: submission.updated_at,
        belief_info: {
          creator_agent_id: submission.belief_info.creator_agent_id,
          created_epoch: submission.belief_info.created_epoch,
          expiration_epoch: submission.belief_info.expiration_epoch,
          current_aggregate: submission.belief_info.current_aggregate,
          status: submission.belief_info.status
        },
        post_context: postContextMap[submission.belief_id] || null
      })) : []

      dashboardUsers.push({
        user_id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        agent_id: user.agent_id,
        total_stake: agentActivity ? agentActivity.total_stake : 0,
        active_belief_count: agentActivity ? agentActivity.active_belief_count : 0,
        belief_participations: beliefParticipations
      })
    }

    const response: DashboardUsersResponse = {
      users: dashboardUsers,
      total_count: user_ids ? dashboardUsers.length : (totalCount || 0)
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
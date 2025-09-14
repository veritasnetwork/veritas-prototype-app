import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserCreationRequest {
  username: string
  display_name?: string
  auth_provider?: string | null
  auth_id?: string | null
}

interface UserCreationResponse {
  user_id: string
  agent_id: string
  user: {
    id: string
    agent_id: string
    username: string
    display_name: string
    total_stake: number
    beliefs_created: number
    beliefs_participated: number
    created_at: string
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

    // Parse request body
    const { username, display_name, auth_provider, auth_id }: UserCreationRequest = await req.json()

    // Validate required fields
    if (!username || username.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Username is required', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const trimmedUsername = username.trim()
    
    // Validate username length
    if (trimmedUsername.length < 2 || trimmedUsername.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Username must be between 2 and 50 characters', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check username uniqueness
    const { data: existingUser, error: uniqueError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('username', trimmedUsername)
      .single()

    if (uniqueError && uniqueError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Failed to check username uniqueness:', uniqueError)
      return new Response(
        JSON.stringify({ error: 'Database error', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Username already exists', code: 409 }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get initial agent stake from system config
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'initial_agent_stake')
      .single()
    
    if (configError) {
      console.error('Failed to get initial_agent_stake:', configError)
      return new Response(
        JSON.stringify({ error: 'Configuration error', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const initialStake = parseFloat(configData.value)

    // BEGIN TRANSACTION: Create protocol agent first
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .insert({
        total_stake: initialStake,
        active_belief_count: 0
      })
      .select()
      .single()

    if (agentError) {
      console.error('Failed to create agent:', agentError)
      return new Response(
        JSON.stringify({ error: 'Database transaction failed', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create user record linked to agent
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .insert({
        agent_id: agent.id,
        auth_provider: auth_provider || null,
        auth_id: auth_id || null,
        username: trimmedUsername,
        display_name: display_name || trimmedUsername,
        total_stake: initialStake, // cached from agent
        beliefs_created: 0,
        beliefs_participated: 0
      })
      .select()
      .single()

    if (userError) {
      console.error('Failed to create user:', userError)
      
      // Rollback: delete the agent that was created
      await supabaseClient
        .from('agents')
        .delete()
        .eq('id', agent.id)

      return new Response(
        JSON.stringify({ error: 'Database transaction failed', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // COMMIT TRANSACTION successful
    const response: UserCreationResponse = {
      user_id: user.id,
      agent_id: agent.id,
      user: {
        id: user.id,
        agent_id: user.agent_id,
        username: user.username,
        display_name: user.display_name,
        total_stake: user.total_stake,
        beliefs_created: user.beliefs_created,
        beliefs_participated: user.beliefs_participated,
        created_at: user.created_at
      }
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AgentCreationRequest {
  initial_stake?: number
}

interface AgentCreationResponse {
  agent_id: string
  total_stake: number
  active_belief_count: number
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
    const { initial_stake }: AgentCreationRequest = await req.json()

    // Get initial stake from config or use provided value
    let stake = initial_stake
    if (stake === undefined || stake === null) {
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
      
      stake = parseFloat(configData.value)
    }

    // Validate stake
    if (stake < 0) {
      return new Response(
        JSON.stringify({ error: 'Initial stake must be non-negative', code: 400 }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create agent record
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .insert({
        total_stake: stake,
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

    const response: AgentCreationResponse = {
      agent_id: agent.id,
      total_stake: agent.total_stake,
      active_belief_count: agent.active_belief_count
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
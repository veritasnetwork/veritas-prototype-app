import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserCreationRequest {
  auth_provider: string
  auth_id: string
  solana_address: string
  username?: string
  display_name?: string
  avatar_url?: string | null
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
    // Initialize Supabase client with SERVICE_ROLE for user creation
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse request body
    const {
      auth_provider,
      auth_id,
      solana_address,
      username,
      display_name,
      avatar_url
    }: UserCreationRequest = await req.json()

    console.log('[app-user-creation] Request received:', {
      auth_provider,
      auth_id: auth_id?.slice(-8),
      solana_address: solana_address?.slice(0, 8),
      username,
      has_avatar: !!avatar_url
    })

    // Validate required fields
    if (!auth_provider || !auth_id || !solana_address) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: auth_provider, auth_id, solana_address',
          code: 'MISSING_REQUIRED_FIELDS'
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user already exists by auth credentials
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id, agent_id, username, display_name, avatar_url')
      .eq('auth_provider', auth_provider)
      .eq('auth_id', auth_id)
      .single()

    if (existingUser) {
      console.log('[app-user-creation] User exists, updating profile:', existingUser.id)

      // User exists - UPDATE mode (upsert behavior)
      const { data: updatedUser, error: updateError } = await supabaseClient
        .from('users')
        .update({
          username: username || existingUser.username,
          display_name: display_name || existingUser.display_name,
          avatar_url: avatar_url !== undefined ? avatar_url : existingUser.avatar_url,
        })
        .eq('id', existingUser.id)
        .select()
        .single()

      if (updateError) {
        console.error('[app-user-creation] Update failed:', updateError)
        return new Response(
          JSON.stringify({
            error: 'Failed to update user',
            code: 'UPDATE_FAILED',
            details: updateError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('[app-user-creation] ✅ User updated successfully')

      return new Response(
        JSON.stringify({
          user_id: updatedUser.id,
          agent_id: updatedUser.agent_id,
          user: {
            id: updatedUser.id,
            agent_id: updatedUser.agent_id,
            username: updatedUser.username,
            display_name: updatedUser.display_name,
            avatar_url: updatedUser.avatar_url,
            total_stake: updatedUser.total_stake,
            beliefs_created: updatedUser.beliefs_created,
            beliefs_participated: updatedUser.beliefs_participated,
            created_at: updatedUser.created_at
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // User doesn't exist - CREATE mode
    console.log('[app-user-creation] User not found, creating new user')

    // Generate username if not provided
    let finalUsername = username?.trim()
    if (!finalUsername) {
      // Use last 8 chars of auth_id as username
      finalUsername = `user_${auth_id.slice(-8)}`

      // Check if this generated username exists
      const { data: usernameCollision } = await supabaseClient
        .from('users')
        .select('id')
        .eq('username', finalUsername)
        .single()

      if (usernameCollision) {
        // Add random suffix if collision
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        finalUsername = `user_${auth_id.slice(-8)}_${randomSuffix}`
      }
    } else {
      // Validate provided username
      if (finalUsername.length < 3 || finalUsername.length > 20) {
        return new Response(
          JSON.stringify({
            error: 'Username must be between 3 and 20 characters',
            code: 'INVALID_USERNAME_LENGTH'
          }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Validate username format
      if (!/^[a-zA-Z0-9_]+$/.test(finalUsername)) {
        return new Response(
          JSON.stringify({
            error: 'Username can only contain letters, numbers, and underscores',
            code: 'INVALID_USERNAME_FORMAT'
          }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check username uniqueness
      const { data: existingUsername } = await supabaseClient
        .from('users')
        .select('id')
        .eq('username', finalUsername)
        .single()

      if (existingUsername) {
        return new Response(
          JSON.stringify({
            error: 'Username already exists',
            code: 'USERNAME_TAKEN'
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Check if agent with this Solana address already exists
    const { data: existingAgent } = await supabaseClient
      .from('agents')
      .select('id')
      .eq('solana_address', solana_address)
      .single()

    let agent_id: string

    if (existingAgent) {
      // Reuse existing agent (e.g., if they had an agent before auth)
      agent_id = existingAgent.id
    } else {
      // Create new agent with Solana address
      // Initial stake is $0 (will be synced from Solana custodian)
      const { data: newAgent, error: agentError } = await supabaseClient
        .from('agents')
        .insert({
          solana_address: solana_address,
          total_stake: 0,
          total_deposited: 0,
          total_withdrawn: 0
        })
        .select('id')
        .single()

      if (agentError) {
        console.error('[app-user-creation] Failed to create agent:', agentError)
        return new Response(
          JSON.stringify({
            error: 'Failed to create agent',
            code: 'AGENT_CREATION_FAILED',
            details: agentError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      agent_id = newAgent.id
    }

    // Create user record linked to agent
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .insert({
        agent_id: agent_id,
        auth_provider: auth_provider,
        auth_id: auth_id,
        username: finalUsername,
        display_name: display_name || finalUsername,
        avatar_url: avatar_url || null,
        total_stake: 0, // cached from agent
        beliefs_created: 0,
        beliefs_participated: 0
      })
      .select()
      .single()

    if (userError) {
      console.error('[app-user-creation] Failed to create user:', userError)

      // Rollback: delete the agent if we just created it
      if (!existingAgent) {
        console.log('[app-user-creation] Rolling back agent creation')
        await supabaseClient
          .from('agents')
          .delete()
          .eq('id', agent_id)
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to create user',
          code: 'USER_CREATION_FAILED',
          details: userError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // COMMIT TRANSACTION successful
    console.log('[app-user-creation] ✅ User created successfully:', user.id)

    const response: UserCreationResponse = {
      user_id: user.id,
      agent_id: agent_id,
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
    console.error('[app-user-creation] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

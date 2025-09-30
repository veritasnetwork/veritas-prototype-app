import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { auth_provider, auth_id, username, display_name, initial_stake, invite_code } = await req.json();

    // Validate authentication parameters
    if (!auth_provider || typeof auth_provider !== 'string' || auth_provider.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'auth_provider is required' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!auth_id || typeof auth_id !== 'string' || auth_id.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'auth_id is required' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check auth uniqueness
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id')
      .eq('auth_provider', auth_provider.trim())
      .eq('auth_id', auth_id.trim())
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User with these auth credentials already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate username if provided
    let finalUsername = username?.trim();
    if (finalUsername) {
      if (typeof finalUsername !== 'string' || finalUsername.length < 2 || finalUsername.length > 50) {
        return new Response(
          JSON.stringify({ error: 'username must be between 2 and 50 characters' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check username uniqueness
      const { data: existingUsername } = await supabaseClient
        .from('users')
        .select('id')
        .eq('username', finalUsername)
        .single();

      if (existingUsername) {
        return new Response(
          JSON.stringify({ error: 'Username already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Generate username - simpler approach to avoid collision issues
      if (invite_code && invite_code.trim()) {
        // Try clean invite code pattern first
        const cleanPattern = `user:${invite_code.trim()}`;
        const { data: collision } = await supabaseClient
          .from('users')
          .select('id')
          .eq('username', cleanPattern)
          .single();

        if (!collision) {
          finalUsername = cleanPattern;
        } else {
          // If collision, use UUID suffix for guaranteed uniqueness
          const crypto = globalThis.crypto || require('crypto');
          const uniqueId = crypto.randomUUID().slice(-8);
          finalUsername = `user:${invite_code.trim()}-${uniqueId}`;
        }
      } else {
        // Fallback to timestamp + random pattern for guaranteed uniqueness
        const timestamp = Date.now().toString().slice(-6);
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        finalUsername = `${auth_provider.toLowerCase()}${timestamp}${randomSuffix}`;
      }
    }

    // Create protocol agent
    const agentResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-agents-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify(initial_stake !== undefined ? { initial_stake } : {}),
    });

    if (!agentResponse.ok) {
      const agentError = await agentResponse.text();
      throw new Error(`Failed to create agent: ${agentError}`);
    }

    const { agent_id, total_stake } = await agentResponse.json();

    // Create user record
    const finalDisplayName = display_name || finalUsername;
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .insert({
        agent_id,
        auth_provider: auth_provider.trim(),
        auth_id: auth_id.trim(),
        username: finalUsername,
        display_name: finalDisplayName,
        total_stake,
        beliefs_created: 0,
        beliefs_participated: 0
      })
      .select('*')
      .single();

    if (userError) {
      throw new Error(`Failed to create user: ${userError.message}`);
    }

    return new Response(
      JSON.stringify({
        user_id: user.id,
        agent_id: agent_id,
        user: user
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('User creation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
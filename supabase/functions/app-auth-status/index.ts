import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.9.6/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT and validate with Privy JWKS
    const jwt = authHeader.slice(7);
    const PRIVY_APP_ID = Deno.env.get('PRIVY_APP_ID') ?? 'cmfmujde9004yl50ba40keo4a';

    let privyUserId: string;

    try {
      // Privy JWKS endpoint for your app
      const JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`;

      // Create JWKS instance
      const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

      // Verify JWT with Privy's public keys
      const { payload } = await jwtVerify(jwt, JWKS, {
        issuer: 'privy.io',
        audience: PRIVY_APP_ID
      });

      privyUserId = payload.sub as string;

      if (!privyUserId) {
        throw new Error('Missing user ID in JWT claims');
      }
    } catch (error) {
      console.error('JWT validation error:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JWT token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user exists in our database
    let { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, agent_id, auth_id, auth_provider')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // Auto-register user if they don't exist
    if (!user) {
      // Create agent first
      const { data: agent, error: agentError } = await supabaseClient
        .from('agents')
        .insert({
          total_stake: 0,
        })
        .select('id')
        .single();

      if (agentError) throw agentError;

      // Generate username from Privy ID
      const username = `user_${privyUserId.slice(-8)}`;

      // Create user
      const { data: newUser, error: createUserError } = await supabaseClient
        .from('users')
        .insert({
          auth_id: privyUserId,
          auth_provider: 'privy',
          agent_id: agent.id,
          username,
          display_name: username,
        })
        .select('id, agent_id, auth_id, auth_provider')
        .single();

      if (createUserError) throw createUserError;

      user = newUser;
    }

    return new Response(
      JSON.stringify({
        has_access: true,
        user,
        agent_id: user.agent_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auth status check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
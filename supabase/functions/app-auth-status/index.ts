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

    let privyUserId: string;

    try {
      // Privy JWKS endpoint for your app
      const JWKS_URL = 'https://auth.privy.io/api/v1/apps/cmfmujde9004yl50ba40keo4a/jwks.json';

      // Create JWKS instance
      const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

      // Verify JWT with Privy's public keys
      const { payload } = await jwtVerify(jwt, JWKS, {
        issuer: 'privy.io',
        audience: 'cmfmujde9004yl50ba40keo4a'
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
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // If user doesn't exist, they need to activate an invite
    if (!user) {
      return new Response(
        JSON.stringify({
          has_access: false,
          needs_invite: true,
          user: null,
          agent_id: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user access status
    const { data: access, error: accessError } = await supabaseClient
      .from('user_access')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (accessError && accessError.code !== 'PGRST116') {
      throw accessError;
    }

    const hasAccess = access?.status === 'activated';

    return new Response(
      JSON.stringify({
        has_access: hasAccess,
        needs_invite: !hasAccess,
        user: hasAccess ? user : null,
        agent_id: hasAccess ? user.agent_id : null,
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
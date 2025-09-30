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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code } = await req.json();
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Invite code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Verify invite code exists and is unused
    const { data: inviteCode, error: inviteError } = await supabaseClient
      .from('invite_codes')
      .select('id, status')
      .eq('code', code)
      .single();

    if (inviteError || !inviteCode) {
      return new Response(
        JSON.stringify({ error: 'Invalid invite code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inviteCode.status === 'used') {
      return new Response(
        JSON.stringify({ error: 'Invite code already used' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user through the app-users-create function
    const userResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/app-users-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        auth_provider: 'privy',
        auth_id: privyUserId,
        invite_code: code,
        display_name: `user:${code}` // Default display name using invite code
      }),
    });

    if (!userResponse.ok) {
      const userError = await userResponse.text();
      throw new Error(`Failed to create user: ${userError}`);
    }

    const { user_id: userId, agent_id: agentId } = await userResponse.json();

    // Mark invite code as used
    const { error: updateInviteError } = await supabaseClient
      .from('invite_codes')
      .update({
        status: 'used',
        used_by_user_id: userId,
        used_at: new Date().toISOString()
      })
      .eq('code', code);

    if (updateInviteError) {
      throw new Error(`Failed to update invite code: ${updateInviteError.message}`);
    }

    // Create user access record
    const { error: accessError } = await supabaseClient
      .from('user_access')
      .insert({
        user_id: userId,
        status: 'activated',
        invite_code_used: code,
        activated_at: new Date().toISOString()
      });

    if (accessError) {
      throw new Error(`Failed to create access record: ${accessError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          agent_id: agentId,
          auth_id: privyUserId,
          auth_provider: 'privy'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Invite activation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
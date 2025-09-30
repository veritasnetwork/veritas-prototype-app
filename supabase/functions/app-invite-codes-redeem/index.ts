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
      const JWKS_URL = 'https://auth.privy.io/api/v1/apps/cmfmujde9004yl50ba40keo4a/jwks.json';
      const JWKS = createRemoteJWKSet(new URL(JWKS_URL));
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

    // Get user
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Mark invite code as used
    const { error: updateInviteError } = await supabaseClient
      .from('invite_codes')
      .update({
        status: 'used',
        used_by_user_id: user.id,
        used_at: new Date().toISOString()
      })
      .eq('code', code);

    if (updateInviteError) {
      throw new Error(`Failed to update invite code: ${updateInviteError.message}`);
    }

    // Add or update user access record with special perks
    const { error: accessError } = await supabaseClient
      .from('user_access')
      .upsert({
        user_id: user.id,
        status: 'premium', // Special status for invite code users
        invite_code_used: code,
        activated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (accessError) {
      throw new Error(`Failed to update access record: ${accessError.message}`);
    }

    // Optionally grant bonus stake for invite code users
    const INVITE_BONUS = 5000; // Extra $5k for invite users
    const { error: bonusError } = await supabaseClient.rpc('add_agent_stake', {
      p_agent_id: user.agent_id,
      p_amount: INVITE_BONUS
    });

    if (bonusError) {
      console.error('Failed to grant invite bonus:', bonusError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invite code redeemed successfully',
        bonus_granted: !bonusError ? INVITE_BONUS : 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Invite redemption error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
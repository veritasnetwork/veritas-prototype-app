import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.9.6/index.ts';
import { createUser } from '../_shared/user-creation.ts';

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
    const PRIVY_APP_ID = Deno.env.get('PRIVY_APP_ID') ?? 'cmfmujde9004yl50ba40keo4a';

    let privyUserId: string;

    try {
      const JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`;
      const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

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

    // Check if user already exists (idempotency)
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();

    if (existingUser) {
      // User already exists - check if they have access
      const { data: access } = await supabaseClient
        .from('user_access')
        .select('status, invite_code_used')
        .eq('user_id', existingUser.id)
        .single();

      if (access?.status === 'activated') {
        // User already activated - return success (idempotent)
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: existingUser.id,
              agent_id: existingUser.agent_id,
              auth_id: privyUserId,
              auth_provider: 'privy'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // Use database transaction for atomicity
    // Note: Supabase doesn't support multi-statement transactions in edge functions
    // So we implement pseudo-transaction with status updates

    // Step 1: Mark invite as 'pending' to prevent race conditions
    const { error: pendingError } = await supabaseClient
      .from('invite_codes')
      .update({ status: 'pending' })
      .eq('code', code)
      .eq('status', 'unused'); // Only update if still unused

    if (pendingError) {
      return new Response(
        JSON.stringify({ error: 'Invite code already being used' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userId: string;
    let agentId: string;

    try {
      // Step 2: Create user if doesn't exist
      if (!existingUser) {
        const result = await createUser({
          supabaseClient,
          auth_provider: 'privy',
          auth_id: privyUserId,
          invite_code: code,
          display_name: `user:${code}`
        });

        userId = result.user_id;
        agentId = result.agent_id;
      } else {
        userId = existingUser.id;
        agentId = existingUser.agent_id;
      }

      // Step 3: Mark invite as used
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

      // Step 4: Create user access record
      const { error: accessError } = await supabaseClient
        .from('user_access')
        .insert({
          user_id: userId,
          status: 'activated',
          invite_code_used: code,
          activated_at: new Date().toISOString()
        });

      if (accessError) {
        // If access record already exists, update it
        if (accessError.code === '23505') { // Unique violation
          const { error: updateAccessError } = await supabaseClient
            .from('user_access')
            .update({
              status: 'activated',
              invite_code_used: code,
              activated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          if (updateAccessError) {
            throw new Error(`Failed to update access record: ${updateAccessError.message}`);
          }
        } else {
          throw new Error(`Failed to create access record: ${accessError.message}`);
        }
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
      // Rollback: Mark invite as unused on failure
      await supabaseClient
        .from('invite_codes')
        .update({ status: 'unused' })
        .eq('code', code);

      throw error;
    }

  } catch (error) {
    console.error('Invite activation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

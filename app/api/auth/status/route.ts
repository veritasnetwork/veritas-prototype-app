import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Extract and verify Privy JWT
    const jwt = authHeader.slice(7);
    const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!PRIVY_APP_ID) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    let privyUserId: string;

    try {
      // Verify JWT with Privy's public keys
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
    } catch (error: any) {
      console.error('JWT validation error:', error.message);
      return NextResponse.json(
        { error: 'Invalid JWT token', msg: error.message },
        { status: 401 }
      );
    }

    // Connect to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    let { data: user, error: userError } = await supabase
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
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({ total_stake: 0 })
        .select('id')
        .single();

      if (agentError) throw agentError;

      // Create user
      const username = `user_${privyUserId.slice(-8)}`;
      const { data: newUser, error: createUserError } = await supabase
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

    return NextResponse.json({
      has_access: true,
      user,
      agent_id: user.agent_id,
    });

  } catch (error: any) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { error: 'Internal server error', msg: error.message },
      { status: 500 }
    );
  }
}

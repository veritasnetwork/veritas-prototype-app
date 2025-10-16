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

    // Get Solana address from request body
    const body = await request.json();
    const solanaAddress = body.solana_address;

    if (!solanaAddress) {
      return NextResponse.json(
        { error: 'Solana address is required' },
        { status: 400 }
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
      .select('id, agent_id, auth_id, auth_provider, username, display_name, avatar_url')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // Auto-register user if they don't exist
    if (!user) {
      console.log('Creating new user for Privy ID:', privyUserId);

      // Call app-user-creation edge function
      const createUserResponse = await fetch(`${supabaseUrl}/functions/v1/app-user-creation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_provider: 'privy',
          auth_id: privyUserId,
          solana_address: solanaAddress,
        }),
      });

      if (!createUserResponse.ok) {
        const errorText = await createUserResponse.text();
        console.error('Failed to create user:', errorText);
        return NextResponse.json(
          { error: 'Failed to create user', details: errorText },
          { status: 500 }
        );
      }

      const createUserData = await createUserResponse.json();
      user = {
        id: createUserData.user_id,
        agent_id: createUserData.agent_id,
        auth_id: privyUserId,
        auth_provider: 'privy',
        username: createUserData.user?.username,
        display_name: createUserData.user?.display_name,
        avatar_url: createUserData.user?.avatar_url,
      };

      console.log('User created successfully:', user.id);
    }

    return NextResponse.json({
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

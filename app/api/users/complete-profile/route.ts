import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  console.log('[complete-profile] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[complete-profile] Starting profile completion request');

  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    console.log('[complete-profile] Auth header present:', !!authHeader);

    const privyUserId = await verifyAuthHeader(authHeader);
    console.log('[complete-profile] Privy user ID:', privyUserId);

    if (!privyUserId) {
      console.log('[complete-profile] ❌ Authentication failed');
      return NextResponse.json(
        { error: 'Invalid or missing authentication' },
        { status: 401 }
      );
    }

    // Check rate limit (50 updates per hour)
    try {
      const { success, headers } = await checkRateLimit(privyUserId, rateLimiters.profileUpdate);

      if (!success) {
        console.log('[complete-profile] Rate limit exceeded for user:', privyUserId);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can update your profile up to 50 times per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      console.error('[complete-profile] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    // Parse request body
    const body = await request.json();
    const { username, display_name, avatar_url } = body;
    console.log('[complete-profile] Request body:', {
      username,
      display_name,
      avatar_url: avatar_url ? 'PROVIDED' : 'NULL',
      solana_address: body.solana_address || 'MISSING'
    });

    // Validate username
    if (!username) {
      console.log('[complete-profile] ❌ Username missing');
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      console.log('[complete-profile] ❌ Username length invalid:', username.length);
      return NextResponse.json(
        { error: 'Username must be 3-20 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log('[complete-profile] ❌ Username contains invalid characters');
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    console.log('[complete-profile] ✅ Username validation passed');

    // Connect to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('[complete-profile] ❌ Missing Supabase env vars');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log('[complete-profile] Supabase client ready');

    // Get Solana address (required for user creation)
    const solanaAddress = body.solana_address;

    if (!solanaAddress) {
      console.log('[complete-profile] ❌ Solana address missing');
      return NextResponse.json(
        { error: 'Solana address is required' },
        { status: 400 }
      );
    }

    console.log('[complete-profile] Solana address:', solanaAddress);
    console.log('[complete-profile] Calling edge function...');

    // Always call edge function - it handles both create and update (upsert)
    const edgeFunctionPayload = {
      auth_provider: 'privy',
      auth_id: privyUserId,
      solana_address: solanaAddress,
      username,
      display_name: display_name || username,
      avatar_url: avatar_url || null,
    };

    console.log('[complete-profile] Edge function payload:', edgeFunctionPayload);

    const createUserResponse = await fetch(`${supabaseUrl}/functions/v1/app-user-creation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edgeFunctionPayload),
    });

    console.log('[complete-profile] Edge function response status:', createUserResponse.status);

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[complete-profile] ❌ Edge function failed:', {
        status: createUserResponse.status,
        statusText: createUserResponse.statusText,
        error: errorData
      });

      // Pass through specific error codes from edge function
      if (errorData.code === 'UPDATE_FAILED' || errorData.code === 'MISSING_REQUIRED_FIELDS') {
        return NextResponse.json(
          { error: errorData.error, details: errorData.details },
          { status: createUserResponse.status }
        );
      }

      return NextResponse.json(
        { error: 'Failed to complete profile', details: errorData },
        { status: createUserResponse.status }
      );
    }

    const createUserData = await createUserResponse.json();
    console.log('[complete-profile] Edge function response data:', createUserData);

    const finalUser = {
      id: createUserData.user_id,
      agent_id: createUserData.agent_id,
      auth_id: privyUserId,
      auth_provider: 'privy',
      username: createUserData.user.username,
      display_name: createUserData.user.display_name,
      avatar_url: createUserData.user.avatar_url || null,
    };

    console.log('[complete-profile] ✅ Profile completed successfully');
    console.log('[complete-profile] User ID:', finalUser.id);
    console.log('[complete-profile] Agent ID:', finalUser.agent_id);

    return NextResponse.json({
      user: finalUser,
      message: 'Profile completed successfully',
    });

  } catch (error) {
    console.error('[complete-profile] ❌ Uncaught error:', error);
    if (error instanceof Error) {
      console.error('[complete-profile] Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        msg: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

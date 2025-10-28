import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {

  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');

    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json(
        { error: 'Invalid or missing authentication' },
        { status: 401 }
      );
    }

    // Check rate limit (50 updates per hour)
    try {
      const { success, headers } = await checkRateLimit(privyUserId, rateLimiters.profileUpdate);

      if (!success) {
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

    // Validate username
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
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


    // Get Solana address (required for user creation)
    const solanaAddress = body.solana_address;

    if (!solanaAddress) {
      return NextResponse.json(
        { error: 'Solana address is required' },
        { status: 400 }
      );
    }


    // Always call edge function - it handles both create and update (upsert)
    const edgeFunctionPayload = {
      auth_provider: 'privy',
      auth_id: privyUserId,
      solana_address: solanaAddress,
      username,
      display_name: display_name || username,
      avatar_url: avatar_url || null,
    };


    const createUserResponse = await fetch(`${supabaseUrl}/functions/v1/app-user-creation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edgeFunctionPayload),
    });


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

    const finalUser = {
      id: createUserData.user_id,
      agent_id: createUserData.agent_id,
      auth_id: privyUserId,
      auth_provider: 'privy',
      username: createUserData.user.username,
      display_name: createUserData.user.display_name,
      avatar_url: createUserData.user.avatar_url || null,
    };


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

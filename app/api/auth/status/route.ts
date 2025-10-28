import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const solanaAddress = body.solana_address;


    // Verify authentication using centralized helper
    const authHeader = request.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json(
        { error: 'Invalid or missing authentication' },
        { status: 401 }
      );
    }


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

    const supabase = getSupabaseServiceRole();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id, auth_id, auth_provider, username, display_name, avatar_url')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();


    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // If user doesn't exist, they need onboarding
    if (!user) {
      return NextResponse.json({
        needsOnboarding: true,
        solana_address: solanaAddress,
      });
    }

    // User exists and is fully set up (username is NOT NULL in schema)
    return NextResponse.json({
      user,
      agent_id: user.agent_id,
    });

  } catch (error) {
    console.error('[auth/status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', msg: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

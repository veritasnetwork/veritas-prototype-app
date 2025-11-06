/**
 * Super simple debug endpoint - GET /api/debug-holdings
 * Test with: https://app.veritas.computer/api/debug-holdings?username=joshvc
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || 'joshvc';

  const steps: string[] = [];

  try {
    steps.push('1. Starting request');

    // Check environment
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    steps.push(`2. Config check - URL: ${hasSupabaseUrl}, Key: ${hasSupabaseKey}`);

    if (!hasSupabaseUrl || !hasSupabaseKey) {
      return NextResponse.json({
        error: 'Missing configuration',
        steps,
        hasSupabaseUrl,
        hasSupabaseKey
      }, { status: 500 });
    }

    // Try to import and create Supabase client
    steps.push('3. Importing Supabase');
    const { getSupabaseServiceRole } = await import('@/lib/supabase-server');

    steps.push('4. Creating Supabase client');
    const supabase = getSupabaseServiceRole();

    steps.push('5. Querying users table');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single();

    if (userError) {
      return NextResponse.json({
        error: 'User query failed',
        details: userError.message,
        code: userError.code,
        steps,
        username
      }, { status: 404 });
    }

    steps.push(`6. Found user: ${user?.id}`);

    // Query holdings
    steps.push('7. Querying user_pool_balances');
    const { data: balances, error: balancesError } = await supabase
      .from('user_pool_balances')
      .select('token_type, token_balance, pool_address')
      .eq('user_id', user.id)
      .gt('token_balance', 0);

    if (balancesError) {
      return NextResponse.json({
        error: 'Balances query failed',
        details: balancesError.message,
        code: balancesError.code,
        steps,
        userId: user.id
      }, { status: 500 });
    }

    steps.push(`8. Found ${balances?.length || 0} holdings`);

    return NextResponse.json({
      success: true,
      steps,
      user: {
        id: user.id,
        username: user.username
      },
      holdings: {
        count: balances?.length || 0,
        data: balances || []
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : String(error),
      type: error?.constructor?.name,
      steps
    }, { status: 500 });
  }
}
/**
 * Test endpoint for holdings - simplified version to debug issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    console.log('[Holdings Test] Starting test for username:', username);

    const supabase = getSupabaseServiceRole();

    // Step 1: Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single();

    if (userError) {
      console.error('[Holdings Test] User lookup failed:', userError);
      return NextResponse.json({
        step: 'user_lookup',
        error: userError.message,
        username
      }, { status: 404 });
    }

    console.log('[Holdings Test] Found user:', user);

    // Step 2: Get basic holdings without joins
    const { data: holdings, error: holdingsError } = await supabase
      .from('user_pool_balances')
      .select('*')
      .eq('user_id', user.id)
      .gt('token_balance', 0);

    if (holdingsError) {
      console.error('[Holdings Test] Holdings query failed:', holdingsError);
      return NextResponse.json({
        step: 'holdings_query',
        error: holdingsError.message,
        userId: user.id
      }, { status: 500 });
    }

    console.log('[Holdings Test] Found holdings count:', holdings?.length || 0);

    // Step 3: Try RPC function
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_user_holdings_with_entry_price', { p_user_id: user.id });

    const rpcStatus = rpcError ? 'failed' : 'success';
    console.log('[Holdings Test] RPC function status:', rpcStatus, rpcError?.message);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      },
      holdings: {
        count: holdings?.length || 0,
        data: holdings || []
      },
      rpc: {
        status: rpcStatus,
        error: rpcError?.message,
        dataCount: rpcData?.length || 0
      }
    });

  } catch (error) {
    console.error('[Holdings Test] Unexpected error:', error);
    return NextResponse.json({
      step: 'unexpected',
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name
    }, { status: 500 });
  }
}
/**
 * Locked Stake API Route
 * GET /api/users/[username]/locked-stake
 * Returns the total locked stake for a user (sum of all belief_lock values)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { microToUsdc, asMicroUsdc } from '@/lib/units';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username || username === 'undefined') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // First, get the user ID from username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Query user_pool_balances to sum all belief_lock values where token_balance > 0
    const { data, error } = await supabase
      .from('user_pool_balances')
      .select('belief_lock')
      .eq('user_id', user.id)
      .gt('token_balance', 0);

    if (error) {
      console.error('Error fetching locked stake:', error);
      return NextResponse.json(
        { error: 'Failed to fetch locked stake' },
        { status: 500 }
      );
    }

    // Sum all belief_lock values (they're stored in micro-USDC)
    // Round each value in case database has decimals
    const totalLockedMicro = (data || []).reduce(
      (sum, row) => sum + Math.round(Number(row.belief_lock) || 0),
      0
    );


    // Convert from micro-USDC to USDC
    const totalLocked = totalLockedMicro > 0 ? microToUsdc(asMicroUsdc(totalLockedMicro)) : 0;

    return NextResponse.json({
      total_locked: totalLocked,
      total_locked_micro: totalLockedMicro,
    });

  } catch (error) {
    console.error('Locked stake API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

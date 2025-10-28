/**
 * POST /api/pools/deploy-market
 * Validates market deployment request (phase 2 of pool deployment)
 *
 * Client-side flow:
 * 1. POST here to validate (auth, pool exists)
 * 2. Client builds deploy_market transaction using SDK
 * 3. Client signs + sends transaction
 * 4. Client calls /api/pools/record to update DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    const { poolAddress, initialDeposit } = body;

    if (!poolAddress || !initialDeposit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    // Get user_id from Privy ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', 'privy')
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify pool exists in DB (should have been created in phase 1)
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('id, post_id, deployed_by_agent_id')
      .eq('pool_address', poolAddress)
      .single();

    if (poolError || !poolDeployment) {
      return NextResponse.json({ error: 'Pool not found. Create pool first.' }, { status: 404 });
    }

    // Validation passed - client can proceed with deploy_market transaction
    return NextResponse.json({
      success: true,
      poolAddress,
      poolDeploymentId: poolDeployment.id,
    });
  } catch (error) {
    console.error('[/api/pools/deploy-market] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

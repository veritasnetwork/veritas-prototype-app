/**
 * POST /api/pools/record
 * Records a successful pool deployment in the database
 *
 * Called AFTER on-chain transaction confirmation
 * Single-phase: create_pool + deploy_market happen in one transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  console.log('[/api/pools/record] Record request received');
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    const {
      postId,
      poolAddress,
      signature,
      initialDeposit,
      longAllocation,
      sLongSupply, // Actual minted LONG tokens (on-manifold)
      sShortSupply, // Actual minted SHORT tokens (on-manifold)
      longMintAddress,
      shortMintAddress,
      usdcVaultAddress,
      f,
      betaNum,
      betaDen,
      sqrtLambdaX96,
      sqrtPriceLongX96,
      sqrtPriceShortX96,
    } = body;

    if (!postId || !poolAddress || !signature || !initialDeposit || longAllocation === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (sLongSupply === undefined || sShortSupply === undefined) {
      return NextResponse.json({ error: 'Missing token supply fields (on-manifold deployment)' }, { status: 400 });
    }

    if (!longMintAddress || !shortMintAddress || !usdcVaultAddress) {
      return NextResponse.json({ error: 'Missing token mint addresses' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from Privy ID or mock ID
    // Check if this is mock auth (auth_id starts with 'mock-user-')
    const isMockAuth = privyUserId.startsWith('mock-user-');
    const authProvider = isMockAuth ? 'mock' : 'privy';

    console.log('[/api/pools/record] Querying user with auth_id:', privyUserId, 'auth_provider:', authProvider);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', authProvider)
      .single();

    if (userError || !user) {
      console.log('[/api/pools/record] User not found. Error:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get post to retrieve belief_id
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, belief_id')
      .eq('id', postId)
      .single();

    if (postError || !post || !post.belief_id) {
      return NextResponse.json({ error: 'Post or belief not found' }, { status: 404 });
    }

    // Check if already exists (idempotency)
    const { data: existing } = await supabase
      .from('pool_deployments')
      .select('id')
      .eq('pool_address', poolAddress)
      .single();

    if (existing) {
      console.log('[/api/pools/record] Pool already recorded');
      return NextResponse.json({ success: true, recordId: existing.id });
    }

    // Calculate short allocation
    const shortAllocation = initialDeposit * 1_000_000 - longAllocation;

    // Insert pool_deployment record with full state
    // NOTE: With on-manifold deployment, token supplies (s_long_supply, s_short_supply)
    // are no longer equal to USDC allocations. They are calculated via the bonding curve.
    const { data: deployment, error: insertError } = await supabase
      .from('pool_deployments')
      .insert({
        post_id: postId,
        belief_id: post.belief_id,
        pool_address: poolAddress,
        deployed_by_agent_id: user.agent_id,
        deployment_tx_signature: signature,
        market_deployment_tx_signature: signature, // Same signature for combined tx
        deployed_at: new Date().toISOString(),
        market_deployed_at: new Date().toISOString(),
        initial_usdc: initialDeposit * 1_000_000,
        initial_long_allocation: longAllocation,
        initial_short_allocation: shortAllocation,
        s_long_supply: sLongSupply, // Actual minted tokens (from on-chain event)
        s_short_supply: sShortSupply, // Actual minted tokens (from on-chain event)
        long_mint_address: longMintAddress,
        short_mint_address: shortMintAddress,
        vault_balance: initialDeposit * 1_000_000, // Total vault balance
        f: f ?? 1, // Default ICBS growth exponent (changed from 2 to 1)
        beta_num: betaNum ?? 1, // Default β numerator
        beta_den: betaDen ?? 2, // Default β denominator (β = 0.5)
        sqrt_lambda_long_x96: sqrtLambdaX96,
        sqrt_lambda_short_x96: sqrtLambdaX96, // Same for both sides (global λ)
        sqrt_price_long_x96: sqrtPriceLongX96,
        sqrt_price_short_x96: sqrtPriceShortX96,
        status: 'market_deployed', // Pool is fully deployed after combined tx
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[/api/pools/record] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to record deployment' }, { status: 500 });
    }

    console.log('[/api/pools/record] Pool deployment recorded:', deployment.id);
    return NextResponse.json({ success: true, recordId: deployment.id });

  } catch (error) {
    console.error('[/api/pools/record] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

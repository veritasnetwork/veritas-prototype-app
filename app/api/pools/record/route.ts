/**
 * POST /api/pools/record
 * Records a successful pool deployment in the database
 *
 * Called AFTER on-chain transaction confirmation
 * Single-phase: create_pool + deploy_market happen in one transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

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
    const supabase = getSupabaseServiceRole();

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

    // Call atomic RPC function with advisory lock
    // This prevents race conditions when multiple requests try to deploy the same pool
    const { data: result, error: rpcError } = await supabase.rpc('deploy_pool_with_lock', {
      p_post_id: postId,
      p_pool_address: poolAddress,
      p_belief_id: post.belief_id,
      p_long_mint_address: longMintAddress,
      p_short_mint_address: shortMintAddress,
      p_deployment_tx_signature: signature,
    });

    if (rpcError) {
      console.error('[/api/pools/record] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to record deployment', details: rpcError.message },
        { status: 500 }
      );
    }

    if (!result?.success) {
      if (result?.error === 'LOCKED') {
        return NextResponse.json(
          { error: 'Pool deployment already in progress for this post' },
          { status: 409 }
        );
      }
      if (result?.error === 'EXISTS') {
        console.log('[/api/pools/record] Pool already recorded:', result.pool_address);
        return NextResponse.json({
          success: true,
          poolAddress: result.pool_address,
          note: 'Pool already recorded'
        });
      }
      return NextResponse.json(
        { error: result?.message || 'Deployment recording failed' },
        { status: 500 }
      );
    }

    console.log('[/api/pools/record] Pool deployment recorded via RPC:', result.pool_address);

    // Calculate short allocation for implied relevance tracking
    const shortAllocation = initialDeposit * 1_000_000 - longAllocation;

    // Record initial implied relevance (50/50 split at deployment)
    const initialReserveLong = (initialDeposit * 1_000_000) / 2;
    const initialReserveShort = (initialDeposit * 1_000_000) / 2;
    const initialImpliedRelevance = 0.5; // 50/50 = neutral

    const { error: impliedError } = await supabase
      .from('implied_relevance_history')
      .insert({
        post_id: postId,
        belief_id: post.belief_id,
        implied_relevance: initialImpliedRelevance,
        reserve_long: initialReserveLong,
        reserve_short: initialReserveShort,
        event_type: 'deployment',
        event_reference: signature, // Use tx signature for idempotency
        confirmed: false,
        recorded_by: 'server',
      });

    if (impliedError) {
      // Ignore unique constraint violations (event indexer already recorded)
      if (impliedError.code !== '23505') {
        console.error('[/api/pools/record] Failed to record implied relevance:', impliedError);
      }
      // Don't fail the request - implied relevance is supplementary data
    } else {
      console.log('[/api/pools/record] Initial implied relevance recorded: 0.5');
    }

    return NextResponse.json({ success: true, poolAddress: result.pool_address });

  } catch (error) {
    console.error('[/api/pools/record] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

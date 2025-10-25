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
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';
import { displayToAtomic, asDisplay } from '@/lib/units';

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
      f = 3,
      betaNum = 1,
      betaDen = 2,
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

    // Call the deploy_pool_with_lock function with all parameters
    // This will insert the pool and calculate the correct implied relevance
    const { error: deployError } = await supabase.rpc('deploy_pool_with_lock', {
      p_post_id: postId,
      p_belief_id: post.belief_id,
      p_pool_address: poolAddress,
      p_token_supply: initialDeposit * 1_000_000, // Initial deposit in micro-USDC
      p_reserve: initialDeposit * 1_000_000, // Initial reserve in micro-USDC
      p_f: f,
      p_beta_num: betaNum,
      p_beta_den: betaDen,
      p_long_mint_address: longMintAddress,
      p_short_mint_address: shortMintAddress,
      p_s_long_supply: displayToAtomic(asDisplay(sLongSupply || 0)), // Convert from display to atomic units
      p_s_short_supply: displayToAtomic(asDisplay(sShortSupply || 0)), // Convert from display to atomic units
      p_sqrt_price_long_x96: sqrtPriceLongX96 || '0',
      p_sqrt_price_short_x96: sqrtPriceShortX96 || '0',
      p_vault_balance: initialDeposit * 1_000_000,
      p_deployment_tx_signature: signature,
      p_deployer_user_id: user.id, // Pass deployer's user ID to create initial holdings
    });

    if (deployError) {
      // Check if it's a duplicate deployment (already exists)
      if (deployError.message?.includes('already deployed')) {
        console.log('[/api/pools/record] Pool already deployed, returning success');
        return NextResponse.json({
          success: true,
          poolAddress: poolAddress,
          note: 'Pool already deployed'
        });
      }

      console.error('[/api/pools/record] Deploy error:', deployError);
      return NextResponse.json(
        { error: 'Failed to record deployment', details: deployError.message },
        { status: 500 }
      );
    }

    console.log('[/api/pools/record] Pool deployment recorded successfully');

    // The deploy_pool_with_lock function now handles implied relevance calculation
    // It calculates the actual implied relevance based on the pool's reserves
    // No need to manually insert into implied_relevance_history here

    // Record initial "deployment" trade entry so the trade history chart has initial price data
    // At deployment, prices are 1.0 for both LONG and SHORT (equal allocation)
    const { error: tradeError } = await supabase
      .from('trades')
      .insert({
        pool_address: poolAddress,
        post_id: postId,
        user_id: user.id,
        wallet_address: null, // System deployment, not a user trade
        trade_type: 'buy', // Use 'buy' for compatibility with chart types
        token_amount: 0,
        usdc_amount: 0,
        tx_signature: signature,
        side: 'LONG', // Use 'LONG' for color-coding compatibility
        price_long: 1.0,
        price_short: 1.0,
        recorded_by: 'server',
        confirmed: true,
      });

    if (tradeError) {
      // Ignore unique constraint violations (tx_signature already recorded)
      if (tradeError.code !== '23505') {
        console.error('[/api/pools/record] Failed to record initial trade entry:', tradeError);
      }
    } else {
      console.log('[/api/pools/record] Initial trade entry recorded with deployment prices');
    }

    return NextResponse.json({ success: true, poolAddress: poolAddress });

  } catch (error) {
    console.error('[/api/pools/record] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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
  try {
    console.log('[POST /api/pools/record] Starting pool recording...');
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);
    console.log('[POST /api/pools/record] Auth verified:', privyUserId);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[POST /api/pools/record] Request body:', {
      postId: body.postId,
      poolAddress: body.poolAddress,
      initialDeposit: body.initialDeposit,
      longAllocation: body.longAllocation,
      sLongSupply: body.sLongSupply,
      sShortSupply: body.sShortSupply,
    });
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
      sScaleLongQ64,        // NEW
      sScaleShortQ64,       // NEW
      sqrtPriceLongX96,
      sqrtPriceShortX96,
    } = body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [POOL RECORD] Data from Smart Contract:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Supplies (whole tokens):');
    console.log('  sLongSupply:', sLongSupply);
    console.log('  sShortSupply:', sShortSupply);
    console.log('Sqrt Prices (X96 format):');
    console.log('  sqrtPriceLongX96:', sqrtPriceLongX96);
    console.log('  sqrtPriceShortX96:', sqrtPriceShortX96);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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


    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', authProvider)
      .single();

    console.log('[POST /api/pools/record] User lookup:', { userId: user?.id, userError: userError?.message });

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's Solana address from agents table
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', user.agent_id)
      .single();

    console.log('[POST /api/pools/record] Agent lookup:', { agentId: user.agent_id, solanaAddress: agent?.solana_address, agentError: agentError?.message });

    if (agentError || !agent) {
      return NextResponse.json({ error: 'User agent not found' }, { status: 404 });
    }

    const solanaAddress = agent.solana_address;
    if (!solanaAddress) {
      return NextResponse.json({ error: 'User Solana address not found' }, { status: 404 });
    }

    // Get post to retrieve belief_id
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, belief_id')
      .eq('id', postId)
      .single();

    console.log('[POST /api/pools/record] Post lookup:', {
      postId,
      found: !!post,
      beliefId: post?.belief_id,
      error: postError?.message
    });

    if (postError || !post || !post.belief_id) {
      console.error('[POST /api/pools/record] Post or belief not found:', { postId, postError: postError?.message, hasBelief: !!post?.belief_id });
      return NextResponse.json({ error: 'Post or belief not found' }, { status: 404 });
    }

    // Call the deploy_pool_with_lock function with all parameters
    // This will insert the pool and calculate the correct implied relevance
    // IMPORTANT: On-chain stores supplies as whole numbers (e.g., 24 = 24 tokens)
    // Database also stores as whole numbers - do NOT convert to atomic units
    const sLongSupplyConverted = asDisplay(sLongSupply || 0);
    const sShortSupplyConverted = asDisplay(sShortSupply || 0);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 [POOL RECORD] Storing to Database:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Supply conversion:');
    console.log('  sLongSupply_raw:', sLongSupply);
    console.log('  sLongSupply_converted:', sLongSupplyConverted);
    console.log('  sShortSupply_raw:', sShortSupply);
    console.log('  sShortSupply_converted:', sShortSupplyConverted);
    console.log('Sqrt Prices (unchanged):');
    console.log('  sqrtPriceLongX96:', sqrtPriceLongX96 || '0');
    console.log('  sqrtPriceShortX96:', sqrtPriceShortX96 || '0');
    console.log('Vault:');
    console.log('  initialDeposit:', initialDeposit, 'USDC');
    console.log('  vault_balance (micro-USDC):', initialDeposit * 1_000_000);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('[POST /api/pools/record] Calling deploy_pool_with_lock...');
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
      p_s_long_supply: sLongSupplyConverted, // Whole tokens (no conversion needed)
      p_s_short_supply: sShortSupplyConverted, // Whole tokens (no conversion needed)
      p_sqrt_price_long_x96: sqrtPriceLongX96 || '0',
      p_sqrt_price_short_x96: sqrtPriceShortX96 || '0',
      p_s_scale_long_q64: sScaleLongQ64 || null,   // NEW
      p_s_scale_short_q64: sScaleShortQ64 || null, // NEW
      p_vault_balance: initialDeposit * 1_000_000,
      p_deployment_tx_signature: signature,
      p_deployer_user_id: user.id, // Pass deployer's user ID to create initial holdings
    });

    if (deployError) {
      // Check if it's a duplicate deployment (already exists)
      if (deployError.message?.includes('already deployed')) {
        console.log('[POST /api/pools/record] Pool already deployed:', poolAddress);
        return NextResponse.json({
          success: true,
          poolAddress: poolAddress,
          note: 'Pool already deployed'
        });
      }

      console.error('[POST /api/pools/record] Deploy error:', { error: deployError, message: deployError.message, details: deployError });
      return NextResponse.json(
        { error: 'Failed to record deployment', details: deployError.message },
        { status: 500 }
      );
    }

    console.log('[POST /api/pools/record] Pool deployed successfully:', poolAddress);


    // The deploy_pool_with_lock function now handles implied relevance calculation
    // It calculates the actual implied relevance based on the pool's reserves
    // No need to manually insert into implied_relevance_history here

    // NOTE: We don't insert a synthetic "deployment" trade anymore.
    // The trading chart will be empty until the first real trade occurs.
    // Initial prices (1.0 for both LONG/SHORT) can be derived from pool_deployments if needed.

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [/api/pools/record] Pool recording completed successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({ success: true, poolAddress: poolAddress });

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [/api/pools/record] ERROR!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[/api/pools/record] Error:', error);
    if (error instanceof Error) {
      console.error('[/api/pools/record] Error message:', error.message);
      console.error('[/api/pools/record] Error stack:', error.stack);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

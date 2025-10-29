/**
 * POST /api/pools/recover
 * Recovers a pool that exists on-chain but not in database
 *
 * This handles the case where:
 * - Pool was successfully deployed on Solana
 * - Database recording failed or was interrupted
 * - We need to sync the pool state from chain to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    const { postId, poolAddress } = body;

    if (!postId || !poolAddress) {
      return NextResponse.json({ error: 'Missing required fields: postId and poolAddress' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();

    // Verify user exists
    const isMockAuth = privyUserId.startsWith('mock-user-');
    const authProvider = isMockAuth ? 'mock' : 'privy';

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', authProvider)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get post and belief_id
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, belief_id, user_id')
      .eq('id', postId)
      .single();

    if (postError || !post || !post.belief_id) {
      return NextResponse.json({ error: 'Post or belief not found' }, { status: 404 });
    }

    // Verify user owns the post
    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if pool already exists in database
    const { data: existingPool } = await supabase
      .from('pool_deployments')
      .select('pool_address')
      .eq('post_id', postId)
      .single();

    if (existingPool) {
      return NextResponse.json({
        success: true,
        poolAddress: existingPool.pool_address,
        note: 'Pool already recorded in database'
      });
    }

    // Fetch pool data from chain
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899');

    const { Keypair } = await import('@solana/web3.js');
    const dummyKeypair = Keypair.generate();
    const wallet = {
      publicKey: dummyKeypair.publicKey,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
        if ('sign' in tx && typeof tx.sign === 'function') {
          (tx.sign as (signers: anchor.web3.Signer[]) => void)([dummyKeypair]);
        }
        return tx;
      },
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return txs.map(tx => {
          if ('sign' in tx && typeof tx.sign === 'function') {
            (tx.sign as (signers: anchor.web3.Signer[]) => void)([dummyKeypair]);
          }
          return tx;
        });
      },
    };

    const provider = new anchor.AnchorProvider(connection, wallet as anchor.Wallet, {});
    const idl = await import('@/lib/solana/target/idl/veritas_curation.json');
    const program = new anchor.Program(idl.default as anchor.Idl, provider);

    const poolPda = new PublicKey(poolAddress);
    const poolData = await (program.account as unknown as { contentPool: { fetch: (key: typeof poolPda) => Promise<{ vault?: { toBase58: () => string }; sLong?: { toNumber: () => number }; sShort?: { toNumber: () => number }; f?: number; betaNum?: number; betaDen?: number; longMint?: { toBase58: () => string }; shortMint?: { toBase58: () => string }; sqrtPriceLongX96?: { toString: () => string }; sqrtPriceShortX96?: { toString: () => string } }> } }).contentPool.fetch(poolPda);


    // Verify pool is actually deployed (has vault)
    if (!poolData.vault || poolData.vault.toBase58() === '11111111111111111111111111111111') {
      return NextResponse.json({ error: 'Pool is not fully deployed on-chain' }, { status: 400 });
    }

    // Insert pool record into database using the RPC function
    const { error: deployError } = await supabase.rpc('deploy_pool_with_lock', {
      p_post_id: postId,
      p_belief_id: post.belief_id,
      p_pool_address: poolAddress,
      p_token_supply: ((poolData.sLong?.toNumber() || 0) + (poolData.sShort?.toNumber() || 0)) * 1_000_000,
      p_reserve: 0, // Will be synced from chain
      p_f: poolData.f || 3,
      p_beta_num: poolData.betaNum || 1,
      p_beta_den: poolData.betaDen || 2,
      p_long_mint_address: poolData.longMint?.toBase58() || '',
      p_short_mint_address: poolData.shortMint?.toBase58() || '',
      p_s_long_supply: (poolData.sLong?.toNumber() || 0) * 1_000_000, // Convert from on-manifold to micro-units
      p_s_short_supply: (poolData.sShort?.toNumber() || 0) * 1_000_000, // Convert from on-manifold to micro-units
      p_sqrt_price_long_x96: poolData.sqrtPriceLongX96?.toString() || '0',
      p_sqrt_price_short_x96: poolData.sqrtPriceShortX96?.toString() || '0',
      p_vault_balance: 0, // Will be fetched from vault
      p_deployment_tx_signature: null, // Unknown for recovered pools
    });

    if (deployError) {
      // Check if already exists (race condition)
      if (deployError.message?.includes('already deployed')) {
        return NextResponse.json({
          success: true,
          poolAddress: poolAddress,
          note: 'Pool recovered (concurrent recovery detected)'
        });
      }

      console.error('[/api/pools/recover] Failed to record pool:', deployError);
      return NextResponse.json(
        { error: 'Failed to record pool in database', details: deployError.message },
        { status: 500 }
      );
    }

    // Sync additional state from chain
    await syncPoolFromChain(poolAddress, connection);

    return NextResponse.json({
      success: true,
      poolAddress: poolAddress,
      recovered: true
    });

  } catch (error) {
    console.error('[/api/pools/recover] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

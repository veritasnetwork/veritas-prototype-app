/**
 * POST /api/settlements/record
 * Records a successful settlement after on-chain transaction confirmation
 *
 * Architecture: Manual recording + idempotent event indexer confirmation
 * - Client calls this immediately after settlement tx confirms
 * - Event indexer will later confirm/update when blockchain events arrive
 * - Idempotent: safe to call multiple times with same tx_signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';

interface RecordSettlementRequest {
  postId: string;
  poolAddress: string;
  signature: string;
  epoch: number;
  bdScore: number;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body: RecordSettlementRequest = await req.json();
    const { postId, poolAddress, signature, epoch, bdScore } = body;


    // Validate required fields
    if (!postId || !poolAddress || !signature || epoch === undefined || bdScore === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();

    // Verify the transaction actually succeeded by parsing it
    let settlementVerified = false;
    try {
      const { Connection } = await import('@solana/web3.js');
      const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
      const connection = new Connection(rpcEndpoint, 'confirmed');

      const txDetails = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });

      if (!txDetails) {
        console.warn('[/api/settlements/record] Transaction not found on-chain:', signature);
        return NextResponse.json({ error: 'Transaction not found on-chain' }, { status: 404 });
      }

      if (txDetails.meta?.err) {
        console.error('[/api/settlements/record] Transaction failed on-chain:', txDetails.meta.err);
        return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
      }

      settlementVerified = true;
      console.log('[/api/settlements/record] ✅ Transaction verified on-chain');

    } catch (verifyError) {
      console.warn('[/api/settlements/record] ⚠️  Could not verify transaction, proceeding anyway:', verifyError);
      // Continue anyway - we trust the client for now
    }

    // Get pool deployment and belief_id
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('post_id, belief_id, current_epoch')
      .eq('pool_address', poolAddress)
      .single();

    if (poolError || !poolDeployment) {
      console.error('[/api/settlements/record] Pool not found:', poolError);
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    if (poolDeployment.post_id !== postId) {
      console.error('[/api/settlements/record] Pool does not belong to this post');
      return NextResponse.json({ error: 'Pool does not belong to this post' }, { status: 400 });
    }

    // Check if settlement already recorded (idempotent)
    const { data: existing } = await supabase
      .from('settlements')
      .select('id')
      .eq('tx_signature', signature)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        settlementId: existing.id,
        note: 'Settlement already recorded',
      });
    }

    // Insert settlement record (optimistic - will be confirmed by event indexer)
    const { data: settlement, error: settlementError } = await supabase
      .from('settlements')
      .insert({
        pool_address: poolAddress,
        post_id: postId,
        belief_id: poolDeployment.belief_id,
        epoch: epoch,
        bd_relevance_score: bdScore,
        tx_signature: signature,
        timestamp: new Date().toISOString(),
        recorded_by: 'server',
        confirmed: false,
        // Note: Other fields like settlement_factor_long/short, reserves before/after
        // will be filled in by the event indexer when it processes the actual event
      })
      .select('id')
      .single();

    if (settlementError) {
      // Check for duplicate (race condition with event indexer)
      if (settlementError.code === '23505') {
        return NextResponse.json({
          success: true,
          note: 'Settlement already recorded by event indexer',
        });
      }

      console.error('[/api/settlements/record] Failed to record settlement:', settlementError);
      return NextResponse.json(
        { error: 'Failed to record settlement', details: settlementError.message },
        { status: 500 }
      );
    }


    // Update pool_deployments with new epoch
    const { error: updateError } = await supabase
      .from('pool_deployments')
      .update({
        current_epoch: epoch,
        last_settlement_epoch: epoch,
        last_settlement_tx: signature,
        last_synced_at: new Date().toISOString(),
      })
      .eq('pool_address', poolAddress);

    if (updateError) {
      console.error('[/api/settlements/record] Failed to update pool epoch:', updateError);
      // Don't fail the request - settlement is recorded
    }

    // Sync pool state from chain after settlement (forceUpdate to get scaled reserves/supplies)
    let poolState: any = null;
    try {
      poolState = await syncPoolFromChain(poolAddress, undefined, 5000, true);
      if (poolState) {
        console.log('[/api/settlements/record] ✅ Pool state synced from chain');
      } else {
        console.warn('[/api/settlements/record] Failed to sync pool state');
      }
    } catch (syncError) {
      console.error('[/api/settlements/record] Exception syncing pool state:', syncError);
      // Don't fail the request
    }

    // Record implied relevance after settlement (server-side optimistic + event indexer confirmation)
    if (poolState) {
      try {
        const rLong = poolState.r_long || 0;
        const rShort = poolState.r_short || 0;
        const totalReserve = rLong + rShort;
        const impliedRelevance = totalReserve > 0 ? rLong / totalReserve : 0.5;

        const { error: impliedError } = await supabase.rpc('upsert_implied_relevance_server', {
          p_post_id: postId,
          p_belief_id: poolDeployment.belief_id,
          p_implied_relevance: impliedRelevance,
          p_reserve_long: rLong,
          p_reserve_short: rShort,
          p_event_type: 'rebase',
          p_event_reference: signature,
          p_recorded_at: new Date().toISOString(),
        });

        if (impliedError) {
          console.error('[/api/settlements/record] Failed to record implied relevance:', impliedError);
        } else {
          console.log('[/api/settlements/record] ✅ Implied relevance recorded');
        }
      } catch (impliedError) {
        console.warn('[/api/settlements/record] Failed to record implied relevance:', impliedError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      settlementId: settlement.id,
      message: 'Settlement recorded successfully',
    });

  } catch (error) {
    console.error('[/api/settlements/record] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settlements/record
 * Records a successful settlement after on-chain transaction confirmation
 *
 * Architecture: Manual recording + idempotent event indexer confirmation
 * - Client calls this immediately after settlement tx confirms
 * - Event indexer will later confirm/update when blockchain events arrive
 * - Idempotent: safe to call multiple times with same tx_signature
 *
 * CRITICAL: This endpoint triggers protocol processing (BD + BTS + redistribution)
 * AFTER the settlement tx is confirmed. This ensures:
 * 1. Settlement transaction is verified on-chain before any state changes
 * 2. Epoch increments only after successful settlement
 * 3. BTS/redistribution happens after pool is actually settled
 * 4. If tx fails, no protocol state is modified
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
  console.log(`\n========== SETTLEMENT RECORD START ==========`);
  console.log(`[settlement] Timestamp: ${new Date().toISOString()}`);

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      console.log(`[settlement] ❌ Authentication failed`);
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }
    console.log(`[settlement] ✅ Authenticated user: ${privyUserId}`);

    const body: RecordSettlementRequest = await req.json();
    const { postId, poolAddress, signature, epoch, bdScore } = body;

    console.log(`[settlement] Request params:`, {
      postId,
      poolAddress,
      signature,
      epoch,
      bdScore
    });

    // Validate required fields
    if (!postId || !poolAddress || !signature || epoch === undefined || bdScore === undefined) {
      console.log(`[settlement] ❌ Missing required fields`);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();

    // Verify the transaction and extract settlement event data
    let settlementVerified = false;
    let settlementEventData: any = null;
    try {
      const { Connection, PublicKey } = await import('@solana/web3.js');
      const { BorshCoder, EventParser } = await import('@coral-xyz/anchor');
      const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
      const connection = new Connection(rpcEndpoint, 'confirmed');

      const txDetails = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });

      if (!txDetails) {
        console.warn('[/api/settlements/record] ⚠️  Transaction not found on-chain (RPC may not have indexed it yet):', signature);
        console.warn('[/api/settlements/record] Proceeding anyway - settlement will be verified by event indexer');
        // Don't return error - continue with settlement recording
        // The event indexer will verify and potentially override this later
      } else {

      if (txDetails.meta?.err) {
        console.error('[/api/settlements/record] Transaction failed on-chain:', txDetails.meta.err);
        return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
      }

      settlementVerified = true;
      console.log('[/api/settlements/record] ✅ Transaction verified on-chain');

      // Parse settlement event from transaction logs
      try {
        const idl = await import('@/lib/solana/target/idl/veritas_curation.json');
        const coder = new BorshCoder(idl as any);
        // Use program ID from environment or Anchor.toml
        const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID || 'GUUnua8NmaJQKvseg1oGXcZn3Ddh1RGrDnaiXRzQUvew';
        const eventParser = new EventParser(new PublicKey(programId), coder);

        if (txDetails.meta?.logMessages) {
          const events = eventParser.parseLogs(txDetails.meta.logMessages);
          for (const event of events) {
            if (event.name === 'SettlementEvent') {
              console.log('[/api/settlements/record] Raw event data:', event.data);
              const Q64_ONE = BigInt(1) << BigInt(64);

              // Event fields use snake_case
              const hasRequiredFields = event.data.market_prediction_q !== undefined &&
                                       event.data.f_long !== undefined &&
                                       event.data.f_short !== undefined;

              if (!hasRequiredFields) {
                console.warn('[/api/settlements/record] ⚠️  Settlement event missing required fields');
                break; // Don't set settlementEventData, will fall through to manual path
              }

              // NOTE: market_prediction_q, f_long, f_short are in MILLIONTHS format (0-1,000,000)
              // NOT Q64 format! They represent percentages.
              settlementEventData = {
                marketPredictionQ: Number(event.data.market_prediction_q) / 1_000_000, // Convert millionths to decimal
                fLong: Number(event.data.f_long) / 1_000_000, // Convert millionths to decimal
                fShort: Number(event.data.f_short) / 1_000_000, // Convert millionths to decimal
                rLongBefore: Number(event.data.r_long_before || 0),
                rShortBefore: Number(event.data.r_short_before || 0),
                rLongAfter: Number(event.data.r_long_after || 0),
                rShortAfter: Number(event.data.r_short_after || 0),
                sScaleLongBefore: event.data.s_scale_long_before?.toString() || '0',
                sScaleLongAfter: event.data.s_scale_long_after?.toString() || '0',
                sScaleShortBefore: event.data.s_scale_short_before?.toString() || '0',
                sScaleShortAfter: event.data.s_scale_short_after?.toString() || '0',
              };
              console.log('[/api/settlements/record] ✅ Parsed settlement event data:', settlementEventData);
              break;
            }
          }
        }
      } catch (parseError) {
        console.warn('[/api/settlements/record] ⚠️  Could not parse settlement event:', parseError);
      }
      } // end else (txDetails exists)

    } catch (verifyError) {
      console.warn('[/api/settlements/record] ⚠️  Could not verify transaction, proceeding anyway:', verifyError);
      // Continue anyway - we trust the client for now
    }

    // If we couldn't parse the event, sync pool state anyway and skip settlement record
    // The event indexer will create the settlement record later
    if (!settlementEventData) {
      console.log(`[settlement] ⚠️  No settlement event data found, syncing pool state only`);

      // CRITICAL: Sync pool state from chain (force update to get scaled reserves)
      // Do this BEFORE updating epoch to maintain consistency
      console.log(`[settlement] Syncing pool state from chain (force update)...`);
      try {
        const poolState = await syncPoolFromChain(poolAddress, undefined, 5000, true);
        if (poolState) {
          console.log('[settlement] ✅ Pool state synced from chain:', {
            r_long: poolState.r_long,
            r_short: poolState.r_short
          });

          // Get the updated pool state and record implied relevance
          const { data: updatedPool } = await supabase
            .from('pool_deployments')
            .select('r_long, r_short, belief_id')
            .eq('pool_address', poolAddress)
            .single();

          if (updatedPool && updatedPool.r_long && updatedPool.r_short) {
            const rLong = updatedPool.r_long;
            const rShort = updatedPool.r_short;
            const totalReserve = rLong + rShort;

            // Calculate implied relevance from actual on-chain reserves (NO fallback to 0.5!)
            if (totalReserve > 0) {
              const impliedRelevance = rLong / totalReserve;

              console.log(`[settlement] Recording implied relevance from chain:`, {
                impliedRelevance,
                rLong,
                rShort
              });

              // Record implied relevance based on on-chain data
              // This is SEPARATE from BD relevance and should always be recorded
              const { error: impliedError } = await supabase.rpc('upsert_implied_relevance_server', {
                p_post_id: postId,
                p_belief_id: updatedPool.belief_id,
                p_implied_relevance: impliedRelevance,
                p_reserve_long: rLong,
                p_reserve_short: rShort,
                p_event_type: 'rebase',
                p_event_reference: signature,
                p_recorded_at: new Date().toISOString(),
              });

              if (impliedError) {
                console.error('[settlement] ❌ Failed to record implied relevance:', impliedError);
              } else {
                console.log('[settlement] ✅ Implied relevance recorded from chain data');
              }
            } else {
              console.warn('[settlement] ⚠️  Total reserve is zero, cannot calculate implied relevance');
            }
          } else {
            console.warn('[settlement] ⚠️  No r_long/r_short in updated pool');
          }
        } else {
          console.warn('[settlement] ⚠️  Pool state sync failed');
        }
      } catch (syncError) {
        console.error('[settlement] ❌ Exception syncing pool state:', syncError);
      }

      // Get belief_id for protocol processing
      const { data: poolInfo } = await supabase
        .from('pool_deployments')
        .select('belief_id, r_long, r_short')
        .eq('pool_address', poolAddress)
        .single();

      if (poolInfo?.belief_id) {
        // CRITICAL: Trigger protocol processing even when we can't parse event data
        // Must be synchronous to ensure BD score is written before client refetches
        // IMPORTANT: If this fails, we MUST abort the settlement
        console.log(`[settlement] Running protocol processing for belief ${poolInfo.belief_id}...`);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/protocol-belief-epoch-process`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              belief_id: poolInfo.belief_id,
              current_epoch: epoch // Process submissions for the new epoch (users forecast the next epoch)
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[settlement] ❌ Protocol processing failed: ${errorText}`);
            return NextResponse.json(
              {
                error: 'Belief processing failed',
                details: `protocol-belief-epoch-process failed: ${errorText}`,
                code: 500
              },
              { status: 500 }
            );
          }

          const result = await response.json();
          console.log(`[settlement] ✅ Protocol processing completed:`, {
            participant_count: result.participant_count,
            redistribution_occurred: result.redistribution_occurred,
            slashing_pool: result.slashing_pool
          });

          // NOW it's safe to update the pool epoch (after protocol processing succeeded)
          console.log(`[settlement] Updating pool epoch to ${epoch}...`);
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
            console.error('[settlement] ❌ Failed to update pool epoch:', updateError);
            // This is non-critical - epoch will be updated by event indexer
          } else {
            console.log('[settlement] ✅ Pool epoch updated');
          }
        } catch (protocolError) {
          console.error(`[settlement] ❌ Protocol processing error:`, protocolError);
          return NextResponse.json(
            {
              error: 'Belief processing error',
              details: protocolError instanceof Error ? protocolError.message : String(protocolError),
              code: 500
            },
            { status: 500 }
          );
        }
      }

      console.log(`========== SETTLEMENT RECORD END (NO EVENT DATA) ==========\n`);
      return NextResponse.json({
        success: true,
        note: 'Pool state synced, settlement will be recorded by event indexer',
      });
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
      console.log('[settlement] Settlement already recorded, checking if protocol processing needed...');

      // Check if belief was already processed for this epoch
      const { data: belief } = await supabase
        .from('beliefs')
        .select('last_processed_epoch')
        .eq('id', poolDeployment.belief_id)
        .single();

      // When settling to epoch N, we process submissions from epoch N
      // (users submit forecasts for the future epoch)
      const targetEpoch = epoch;

      if (!belief || belief.last_processed_epoch === null || belief.last_processed_epoch < targetEpoch) {
        console.log(`[settlement] Belief not processed for epoch ${targetEpoch}, running protocol processing...`);

        // Settlement recorded but protocol processing may have failed - retry it synchronously
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/protocol-belief-epoch-process`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              belief_id: poolDeployment.belief_id,
              current_epoch: targetEpoch // Same as epoch
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[settlement] ❌ Protocol processing failed on retry: ${errorText}`);
            return NextResponse.json(
              {
                error: 'Belief processing failed on retry',
                details: `protocol-belief-epoch-process failed: ${errorText}`,
                code: 500
              },
              { status: 500 }
            );
          }

          const result = await response.json();
          console.log(`[settlement] ✅ Protocol processing completed on retry:`, {
            participant_count: result.participant_count,
            redistribution_occurred: result.redistribution_occurred,
            slashing_pool: result.slashing_pool
          });
        } catch (protocolError) {
          console.error(`[settlement] ❌ Protocol processing error on retry:`, protocolError);
          return NextResponse.json(
            {
              error: 'Belief processing error on retry',
              details: protocolError instanceof Error ? protocolError.message : String(protocolError),
              code: 500
            },
            { status: 500 }
          );
        }
      } else {
        console.log(`[settlement] Belief already processed for epoch ${targetEpoch}, skipping protocol processing`);
      }

      return NextResponse.json({
        success: true,
        settlementId: existing.id,
        note: 'Settlement already recorded',
      });
    }

    // Fetch prices BEFORE inserting settlement (they'll be updated after sync)
    // This is a placeholder - real prices come after syncPoolFromChain
    let sqrtPriceLongX96: string | null = null;
    let sqrtPriceShortX96: string | null = null;
    let priceLong: number | null = null;
    let priceShort: number | null = null;

    // Insert settlement record with all event data
    const { data: settlement, error: settlementError } = await supabase
      .from('settlements')
      .insert({
        pool_address: poolAddress,
        post_id: postId,
        belief_id: poolDeployment.belief_id,
        epoch: epoch,
        bd_relevance_score: bdScore,
        market_prediction_q: settlementEventData.marketPredictionQ,
        f_long: settlementEventData.fLong,
        f_short: settlementEventData.fShort,
        reserve_long_before: settlementEventData.rLongBefore,
        reserve_short_before: settlementEventData.rShortBefore,
        reserve_long_after: settlementEventData.rLongAfter,
        reserve_short_after: settlementEventData.rShortAfter,
        s_scale_long_before: settlementEventData.sScaleLongBefore,
        s_scale_long_after: settlementEventData.sScaleLongAfter,
        s_scale_short_before: settlementEventData.sScaleShortBefore,
        s_scale_short_after: settlementEventData.sScaleShortAfter,
        tx_signature: signature,
        timestamp: new Date().toISOString(),
        recorded_by: 'manual',
        confirmed: true,
        // Prices will be updated after syncPoolFromChain
        sqrt_price_long_x96_after: sqrtPriceLongX96,
        sqrt_price_short_x96_after: sqrtPriceShortX96,
        price_long_after: priceLong,
        price_short_after: priceShort,
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


    // CRITICAL: Sync pool state from chain FIRST to get post-settlement reserves
    // RETRY LOGIC: RPC nodes may have stale cache, so retry until we see the new epoch
    console.log('[settlement] Syncing pool state from chain (force update)...');
    let poolState: any = null;
    const MAX_SYNC_RETRIES = 5;
    const SYNC_RETRY_DELAY_MS = 500;

    for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
      try {
        // Add delay before retry (except first attempt)
        if (attempt > 1) {
          console.log(`[settlement] Retry ${attempt}/${MAX_SYNC_RETRIES} after ${SYNC_RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, SYNC_RETRY_DELAY_MS));
        }

        poolState = await syncPoolFromChain(poolAddress, undefined, 5000, true);
        if (poolState) {
          console.log('[/api/settlements/record] ✅ Pool state synced from chain:', {
            r_long: poolState.r_long,
            r_short: poolState.r_short,
            attempt
          });
          break; // Success - stop retrying
        } else {
          console.warn(`[/api/settlements/record] Sync returned null (attempt ${attempt}/${MAX_SYNC_RETRIES})`);
        }
      } catch (syncError) {
        console.error(`[/api/settlements/record] Exception syncing pool state (attempt ${attempt}/${MAX_SYNC_RETRIES}):`, syncError);
        if (attempt === MAX_SYNC_RETRIES) {
          // Last attempt failed - continue anyway
          console.error('[/api/settlements/record] All sync attempts failed, continuing with stale data');
        }
      }
    }

    // Fetch prices from pool_deployments (now updated by syncPoolFromChain)
    const { data: poolWithPrices, error: priceError } = await supabase
      .from('pool_deployments')
      .select('sqrt_price_long_x96, sqrt_price_short_x96')
      .eq('pool_address', poolAddress)
      .single();

    if (priceError || !poolWithPrices) {
      console.error('[settlement] Failed to fetch prices after sync:', priceError);
      // Continue anyway - prices will be null in settlement record
    } else if (poolWithPrices?.sqrt_price_long_x96 && poolWithPrices?.sqrt_price_short_x96) {
      // Calculate human-readable prices
      const { sqrtPriceX96ToPrice } = await import('@/lib/solana/sqrt-price-helpers');
      sqrtPriceLongX96 = poolWithPrices.sqrt_price_long_x96;
      sqrtPriceShortX96 = poolWithPrices.sqrt_price_short_x96;
      priceLong = sqrtPriceX96ToPrice(poolWithPrices.sqrt_price_long_x96);
      priceShort = sqrtPriceX96ToPrice(poolWithPrices.sqrt_price_short_x96);

      console.log('[settlement] Calculated settlement prices:', {
        priceLong,
        priceShort,
        sqrtPriceLongX96,
        sqrtPriceShortX96
      });

      // Update settlement record with prices
      const { error: priceUpdateError } = await supabase
        .from('settlements')
        .update({
          sqrt_price_long_x96_after: sqrtPriceLongX96,
          sqrt_price_short_x96_after: sqrtPriceShortX96,
          price_long_after: priceLong,
          price_short_after: priceShort,
        })
        .eq('tx_signature', signature);

      if (priceUpdateError) {
        console.error('[settlement] Failed to update settlement prices:', priceUpdateError);
        // Non-critical - continue
      } else {
        console.log('[settlement] ✅ Settlement prices updated');
      }
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

    // Trigger full protocol processing (BD + BTS + redistribution) synchronously
    // IMPORTANT: We MUST wait for this to complete before returning, otherwise
    // the client will refetch history before BD score is written to the database
    // CRITICAL: If protocol processing fails, we must abort - cannot settle without BD score
    console.log(`[settlement] Running protocol processing for belief ${poolDeployment.belief_id}...`);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/protocol-belief-epoch-process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          belief_id: poolDeployment.belief_id,
          current_epoch: epoch // Process submissions for the new epoch (users forecast the next epoch)
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[settlement] ❌ Protocol processing failed: ${errorText}`);
        return NextResponse.json(
          {
            error: 'Belief processing failed',
            details: `protocol-belief-epoch-process failed: ${errorText}`,
            code: 500
          },
          { status: 500 }
        );
      }

      const result = await response.json();
      console.log(`[settlement] ✅ Protocol processing completed:`, {
        participant_count: result.participant_count,
        redistribution_occurred: result.redistribution_occurred,
        slashing_pool: result.slashing_pool
      });
    } catch (protocolError) {
      console.error(`[settlement] ❌ Protocol processing error:`, protocolError);
      return NextResponse.json(
        {
          error: 'Belief processing error',
          details: protocolError instanceof Error ? protocolError.message : String(protocolError),
          code: 500
        },
        { status: 500 }
      );
    }

    // Record implied relevance after protocol processing succeeds
    // This is on-chain data and should ALWAYS be recorded (independent of BD score)
    if (poolState) {
      try {
        const rLong = poolState.r_long || 0;
        const rShort = poolState.r_short || 0;
        const totalReserve = rLong + rShort;

        // Only record if we have actual reserves (NO 50% fallback!)
        if (totalReserve > 0) {
          const impliedRelevance = rLong / totalReserve;

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
            console.log('[/api/settlements/record] ✅ Implied relevance recorded from chain');
          }
        } else {
          console.warn('[/api/settlements/record] ⚠️  Total reserve is zero, skipping implied relevance');
        }
      } catch (impliedError) {
        console.warn('[/api/settlements/record] Failed to record implied relevance:', impliedError);
        // Don't fail the request
      }
    }

    console.log('[settlement] ✅ Settlement recorded successfully');
    console.log(`========== SETTLEMENT RECORD END ==========\n`);

    return NextResponse.json({
      success: true,
      settlementId: settlement.id,
      message: 'Settlement recorded successfully',
    });

  } catch (error) {
    console.error('[settlement] ❌ ERROR:', error);
    console.log(`========== SETTLEMENT RECORD END (ERROR) ==========\n`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

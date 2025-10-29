/**
 * Event Processor Service
 *
 * Shared logic for processing blockchain events from both:
 * - WebSocket subscriptions (local/devnet)
 * - Helius webhooks (mainnet)
 *
 * Implements idempotent deduplication with server-side trade recording.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { PublicKey } from '@solana/web3.js';
import { fetchPoolData } from '@/lib/solana/fetch-pool-data';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import {
  DisplayUnits,
  AtomicUnits,
  MicroUSDC,
  asDisplay,
  asAtomic,
  asMicroUsdc,
  displayToAtomic,
  poolDisplayToAtomic,
  microToUsdc
} from '@/lib/units';
import { validateAndUpdate } from '@/lib/db-validation';
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';

// Event type definitions matching Rust smart contract events
export interface TradeEventData {
  pool: PublicKey;
  trader: PublicKey;
  side: { long?: object } | { short?: object };
  tradeType: { buy?: object } | { sell?: object };

  // Trade amounts
  usdcAmount: bigint;       // Total USDC (including skim)
  usdcToTrade: bigint;      // After skim
  usdcToStake: bigint;      // Skim amount
  tokensTraded: bigint;     // Tokens bought or sold

  // ICBS State Snapshots (BEFORE trade)
  sLongBefore: bigint;
  sShortBefore: bigint;
  sqrtPriceLongX96Before: bigint;  // u128
  sqrtPriceShortX96Before: bigint; // u128

  // ICBS State Snapshots (AFTER trade)
  sLongAfter: bigint;
  sShortAfter: bigint;
  sqrtPriceLongX96After: bigint;  // u128
  sqrtPriceShortX96After: bigint; // u128

  // Virtual reserves (AFTER)
  rLongAfter: bigint;
  rShortAfter: bigint;
  vaultBalanceAfter: bigint;

  timestamp: bigint;
}

export interface SettlementEventData {
  pool: PublicKey;
  settler: PublicKey;
  epoch: bigint;            // Pool's current epoch after settlement
  bdScore: number;          // Q32.32 fixed point
  marketPredictionQ: bigint;
  fLong: bigint;
  fShort: bigint;
  rLongBefore: bigint;
  rShortBefore: bigint;
  rLongAfter: bigint;
  rShortAfter: bigint;
  sScaleLongBefore: bigint;   // NEW
  sScaleLongAfter: bigint;    // NEW
  sScaleShortBefore: bigint;  // NEW
  sScaleShortAfter: bigint;   // NEW
  timestamp: bigint;
}

export interface MarketDeployedEventData {
  pool: PublicKey;
  deployer: PublicKey;
  initialDeposit: bigint;
  longAllocation: bigint;
  shortAllocation: bigint;
  initialQ: number;
  longTokens: bigint;
  shortTokens: bigint;
  timestamp: bigint;
}

export interface DepositEventData {
  depositor: PublicKey;
  amount: bigint;
  timestamp: bigint;
}

export interface WithdrawEventData {
  recipient: PublicKey;
  amount: bigint;
  authority: PublicKey;
  timestamp: bigint;
}

export interface LiquidityAddedEventData {
  pool: PublicKey;
  user: PublicKey;
  usdcAmount: bigint;
  longTokensOut: bigint;
  shortTokensOut: bigint;
  newRLong: bigint;
  newRShort: bigint;
  newSLong: bigint;
  newSShort: bigint;
}

export class EventProcessor {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseServiceRole();
  }

  /**
   * Helper: Convert sqrt_price_x96 to human-readable price
   */
  private sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    const Q96 = 2n ** 96n;
    const priceX192 = sqrtPriceX96 * sqrtPriceX96;
    const price = Number(priceX192) / Number(Q96 * Q96);
    // Convert from lamports to USDC (6 decimals)
    return price / 1_000_000;
  }

  /**
   * Process a TradeEvent from the blockchain
   */
  async handleTradeEvent(
    event: TradeEventData,
    signature: string,
    blockTime?: number,
    slot?: number
  ): Promise<void> {

    // Extract data from event
    const poolAddress = event.pool.toString();
    const walletAddress = event.trader.toString();
    const side = 'long' in event.side ? 'LONG' : 'SHORT';
    const tradeType = 'buy' in event.tradeType ? 'buy' : 'sell';

    // Keep amounts in micro units for database storage
    const usdcToTradeMicro = Number(event.usdcToTrade);  // Keep in micro-USDC for DB
    const usdcToTradeDisplay = usdcToTradeMicro / 1_000_000;  // For display/logging only
    const tokensTraded = Number(event.tokensTraded) / 1_000_000;  // Convert to display units
    const skimAmountMicro = Number(event.usdcToStake);  // Keep in micro-USDC
    const skimAmountDisplay = skimAmountMicro / 1_000_000;  // For display/logging only

    // ICBS state snapshots - on-chain stores in DISPLAY units
    const sLongBefore = asDisplay(Number(event.sLongBefore));
    const sLongAfter = asDisplay(Number(event.sLongAfter));
    const sShortBefore = asDisplay(Number(event.sShortBefore));
    const sShortAfter = asDisplay(Number(event.sShortAfter));

    // Sqrt prices (keep as string for precision)
    const sqrtPriceLongX96 = event.sqrtPriceLongX96After.toString();
    const sqrtPriceShortX96 = event.sqrtPriceShortX96After.toString();

    // Calculate human-readable prices from sqrt_price_x96
    const priceLong = this.sqrtPriceX96ToPrice(event.sqrtPriceLongX96After);
    const priceShort = this.sqrtPriceX96ToPrice(event.sqrtPriceShortX96After);

    // Virtual reserves (convert from lamports to USDC)
    const rLongAfter = Number(event.rLongAfter) / 1_000_000;
    const rShortAfter = Number(event.rShortAfter) / 1_000_000;
    const vaultBalance = Number(event.vaultBalanceAfter) / 1_000_000;

    // Check if server already recorded this
    const { data: existing } = await this.supabase
      .from('trades')
      .select('*')
      .eq('tx_signature', signature)
      .single();


    if (existing) {

      // Validate server data against on-chain event
      const amountsMatch =
        Math.abs(Number(existing.usdc_amount) - usdcToTradeMicro) < 1 && // Allow 1 micro-USDC diff
        Math.abs(Number(existing.token_amount) - tokensTraded) < 0.01;

      if (amountsMatch) {
        // Server data correct - just mark as confirmed
        await this.supabase
          .from('trades')
          .update({
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
            slot,
          })
          .eq('tx_signature', signature);


        // Record the skim as a custodian deposit if there is one
        if (skimAmountMicro > 0) {
          await this.recordSkimDeposit(walletAddress, skimAmountMicro, signature, blockTime, slot, Number(event.timestamp));
        }
      } else {
        // Server data INCORRECT - overwrite with on-chain truth
        console.warn(`⚠️  Server data mismatch for ${signature}:`);
        console.warn(`   Server: usdc=${existing.usdc_amount}, tokens=${existing.token_amount}`);
        console.warn(`   On-chain: usdc=${usdcToTradeMicro}, tokens=${tokensTraded}`);

        await this.supabase
          .from('trades')
          .update({
            usdc_amount: usdcToTradeMicro,
            token_amount: tokensTraded,
            server_amount: existing.usdc_amount,
            indexer_corrected: true,
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
            slot,
          })
          .eq('tx_signature', signature);


        // Record the skim as a custodian deposit if there is one
        if (skimAmountMicro > 0) {
          await this.recordSkimDeposit(walletAddress, skimAmountMicro, signature, blockTime, slot, Number(event.timestamp));
        }
      }
    } else {
      // Server didn't record this (or failed) - insert from indexer

      // Get pool deployment to find post_id and ICBS parameters
      const { data: pool } = await this.supabase
        .from('pool_deployments')
        .select('post_id, f, beta_num, beta_den')
        .eq('pool_address', poolAddress)
        .single();

      if (!pool) {
        console.error(`❌ Pool not found for address: ${poolAddress}`);
        return;
      }

      // Get user_id from wallet address
      const { data: user } = await this.supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      if (!user) {
        console.error(`❌ User not found for wallet: ${walletAddress}`);
        return;
      }

      // Insert complete trade record with all ICBS fields
      const { data: insertedTrade, error: insertError } = await this.supabase
        .from('trades')
        .insert({
          tx_signature: signature,
          pool_address: poolAddress,
          post_id: pool.post_id,
          user_id: user.id,
          wallet_address: walletAddress,
          trade_type: tradeType,
          side: side,  // ✅ NOW INCLUDED
          token_amount: tokensTraded,
          usdc_amount: usdcToTradeMicro,  // Store in micro-USDC (atomic units)
          // ICBS snapshots BEFORE
          s_long_before: sLongBefore,
          s_short_before: sShortBefore,
          // ICBS snapshots AFTER
          s_long_after: sLongAfter,
          s_short_after: sShortAfter,
          // Virtual reserves AFTER
          r_long_after: rLongAfter,
          r_short_after: rShortAfter,
          // Sqrt prices
          sqrt_price_long_x96: sqrtPriceLongX96,
          sqrt_price_short_x96: sqrtPriceShortX96,
          // Human-readable prices
          price_long: priceLong,
          price_short: priceShort,
          // ICBS parameters
          f: pool.f,
          beta_num: pool.beta_num,
          beta_den: pool.beta_den,
          // Metadata
          recorded_by: 'indexer',
          confirmed: true,
          confirmed_at: new Date().toISOString(),
          block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
          slot,
          indexed_at: new Date().toISOString(),
        })
        .select();

      if (insertError) {
        console.error('[EventIndexer] ❌ Failed to insert trade:', insertError);
      } else {
      }

      // BUG FIX #3: Update user pool balances
      // When indexer records a missed trade, we must update balances
      const { data: existingBalance } = await this.supabase
        .from('user_pool_balances')
        .select('token_balance, belief_lock')
        .eq('user_id', user.id)
        .eq('pool_address', poolAddress)
        .eq('token_type', side)
        .single();

      let newBalance: number;
      let newLock: number;

      if (tradeType === 'buy') {
        newBalance = (existingBalance?.token_balance || 0) + tokensTraded;
        // For buys: set lock to 2% of USDC amount (in micro-USDC)
        newLock = Math.floor(usdcToTradeMicro * 0.02);  // Store in micro-USDC
      } else {
        // Sell
        newBalance = (existingBalance?.token_balance || 0) - tokensTraded;

        // BUG FIX #2: Proportionally reduce lock on sells
        if (existingBalance?.token_balance && existingBalance.token_balance > 0) {
          const proportionRemaining = newBalance / existingBalance.token_balance;
          newLock = Math.floor((existingBalance.belief_lock || 0) * proportionRemaining);  // Keep in micro-USDC
        } else {
          newLock = 0;
        }
      }

      await this.supabase
        .from('user_pool_balances')
        .upsert({
          user_id: user.id,
          pool_address: poolAddress,
          post_id: pool.post_id,
          token_balance: newBalance,
          token_type: side,
          belief_lock: newLock,
        }, {
          onConflict: 'user_id,pool_address,token_type'
        });

      // Update agent's total_stake by summing all belief_locks for this user
      // This keeps agents.total_stake in sync with actual locked stakes (same logic as record_trade_atomic)
      const { data: totalStakeData } = await this.supabase
        .from('user_pool_balances')
        .select('belief_lock')
        .eq('user_id', user.id);

      const totalStake = totalStakeData?.reduce((sum, row) => sum + (row.belief_lock || 0), 0) || 0;

      const { data: agentForStake } = await this.supabase
        .from('users')
        .select('agent_id')
        .eq('id', user.id)
        .single();

      if (agentForStake?.agent_id) {
        await this.supabase
          .from('agents')
          .update({ total_stake: totalStake })
          .eq('id', agentForStake.agent_id);
      }

      // BUG FIX #5: Add belief submission when indexer records trade
      const { data: poolData } = await this.supabase
        .from('pool_deployments')
        .select('belief_id')
        .eq('pool_address', poolAddress)
        .single();

      const { data: agentData } = await this.supabase
        .from('users')
        .select('agent_id')
        .eq('id', user.id)
        .single();

      if (poolData?.belief_id && agentData?.agent_id) {
        await this.supabase
          .from('belief_submissions')
          .upsert({
            belief_id: poolData.belief_id,
            agent_id: agentData.agent_id,
            belief: 0.5,  // Default neutral belief for indexer-recorded trades
            meta_prediction: 0.5,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'belief_id,agent_id'
          });

      }

      // Record the skim as a custodian deposit if there is one
      if (skimAmountMicro > 0) {
        await this.recordSkimDeposit(walletAddress, skimAmountMicro, signature, blockTime, slot, Number(event.timestamp));
      }
    }

    // Update pool state with type-safe unit conversion
    // On-chain state stores supplies in display units, DB expects atomic units
    const poolStateAtomic = poolDisplayToAtomic({
      sLong: sLongAfter,
      sShort: sShortAfter,
      vaultBalance: asMicroUsdc(vaultBalance),
    });

    // Validate units before database update
    const poolUpdate = validateAndUpdate('pool_deployments', {
      s_long_supply: poolStateAtomic.sLongSupply,
      s_short_supply: poolStateAtomic.sShortSupply,
      vault_balance: poolStateAtomic.vaultBalance,
      r_long: rLongAfter,
      r_short: rShortAfter,
      sqrt_price_long_x96: sqrtPriceLongX96,
      sqrt_price_short_x96: sqrtPriceShortX96,
      last_synced_at: new Date().toISOString(),
    });

    await this.supabase
      .from('pool_deployments')
      .update(poolUpdate)
      .eq('pool_address', poolAddress);


    // Update total volume cache on posts table
    const { data: totalVolumeData } = await this.supabase
      .from('trades')
      .select('usdc_amount')
      .eq('pool_address', poolAddress);

    if (totalVolumeData) {
      // usdc_amount is stored in micro-USDC (atomic units)
      const totalVolumeMicro = totalVolumeData.reduce((sum, trade) => sum + Number(trade.usdc_amount || 0), 0);
      const totalVolume = microToUsdc(asMicroUsdc(totalVolumeMicro));

      // Get pool to find post_id
      const { data: poolData } = await this.supabase
        .from('pool_deployments')
        .select('post_id')
        .eq('pool_address', poolAddress)
        .single();

      if (poolData?.post_id) {
        await this.supabase
          .from('posts')
          .update({ total_volume_usdc: totalVolume })
          .eq('id', poolData.post_id);

      }
    }

    // Record implied relevance from reserves after trade
    await this.recordImpliedRelevance({
      poolAddress,
      eventType: 'trade',
      eventReference: signature,
      reserveLong: rLongAfter,
      reserveShort: rShortAfter,
      blockTime,
    });
  }

  /**
   * Record implied relevance from reserve ratios
   * Called after trades, deployments, and settlements
   */
  private async recordImpliedRelevance({
    poolAddress,
    eventType,
    eventReference,
    reserveLong,
    reserveShort,
    blockTime,
  }: {
    poolAddress: string;
    eventType: 'trade' | 'deployment' | 'rebase';
    eventReference: string;
    reserveLong: number;
    reserveShort: number;
    blockTime?: number;
  }): Promise<void> {
    try {
      // Calculate implied relevance
      const totalReserve = reserveLong + reserveShort;
      const impliedRelevance = totalReserve > 0 ? reserveLong / totalReserve : 0.5;

      // Get post_id and belief_id from pool
      const { data: pool } = await this.supabase
        .from('pool_deployments')
        .select('post_id, belief_id')
        .eq('pool_address', poolAddress)
        .single();

      if (!pool || !pool.belief_id) {
        console.warn(`⚠️  No pool/belief found for ${poolAddress}, skipping implied relevance`);
        return;
      }

      // Atomically upsert implied relevance with proper recorded_by handling
      const { error } = await this.supabase.rpc('upsert_implied_relevance_indexer', {
        p_post_id: pool.post_id,
        p_belief_id: pool.belief_id,
        p_implied_relevance: impliedRelevance,
        p_reserve_long: reserveLong,
        p_reserve_short: reserveShort,
        p_event_type: eventType,
        p_event_reference: eventReference,
        p_recorded_at: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(),
      });

      if (error) {
        console.error(`❌ Failed to record implied relevance:`, error);
      } else {
      }
    } catch (error) {
      console.error(`❌ Error in recordImpliedRelevance:`, error);
    }
  }

  /**
   * Record a trade skim as a custodian deposit AND update agent total_stake
   * @param skimAmount - Amount in micro-USDC
   */
  private async recordSkimDeposit(
    walletAddress: string,
    skimAmount: number,  // micro-USDC
    signature: string,
    blockTime: number | undefined,
    slot: number | undefined,
    timestamp: number
  ): Promise<void> {
    // Check if we already recorded this skim deposit
    const { data: existing } = await this.supabase
      .from('custodian_deposits')
      .select('id')
      .eq('tx_signature', signature)
      .eq('deposit_type', 'trade_skim')
      .single();

    if (existing) {
      return;
    }

    // Ensure agent exists and get agent_id
    let agentId: string;
    const { data: agent } = await this.supabase
      .from('agents')
      .select('id')
      .eq('solana_address', walletAddress)
      .single();

    if (!agent) {
      const { data: newAgent, error: agentError } = await this.supabase
        .from('agents')
        .insert({
          solana_address: walletAddress,
          created_at: new Date(timestamp * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (agentError || !newAgent) {
        console.error('Failed to create agent:', agentError);
        throw agentError;
      }
      agentId = newAgent.id;
    } else {
      agentId = agent.id;
    }

    // Insert the skim as a custodian deposit
    const { error } = await this.supabase
      .from('custodian_deposits')
      .insert({
        tx_signature: signature,
        depositor_address: walletAddress,
        amount_usdc: skimAmount,
        deposit_type: 'trade_skim',
        recorded_by: 'indexer',
        confirmed: true,
        slot,
        block_time: blockTime,
        indexed_at: new Date().toISOString(),
        timestamp: new Date(timestamp * 1000).toISOString(),
      });

    if (error) {
      console.error('Failed to record skim deposit:', error);
      throw error;
    }

    // Update agent's total_stake using the database function
    const { error: stakeError } = await this.supabase
      .rpc('add_agent_stake', {
        p_agent_id: agentId,
        p_amount: skimAmount,
      });

    if (stakeError) {
      console.error('Failed to update agent stake:', stakeError);
      throw stakeError;
    }

  }

  /**
   * Process a SettlementEvent from the blockchain
   */
  async handleSettlementEvent(
    event: SettlementEventData,
    signature: string,
    blockTime?: number,
    slot?: number
  ): Promise<void> {

    const poolAddress = event.pool.toString();
    const epoch = Number(event.epoch);
    const bdScore = Number(event.bdScore) / 1_000_000; // Convert from millionths format
    const Q64_ONE = BigInt(1) << BigInt(64);

    // Get pool and associated belief/post
    const { data: pool, error: poolError } = await this.supabase
      .from('pool_deployments')
      .select('id, post_id, belief_id, current_epoch')
      .eq('pool_address', poolAddress)
      .single();

    if (poolError || !pool) {
      console.error('Failed to find pool for settlement:', poolError);
      return;
    }

    // Validate epoch increment (should be exactly +1 from previous)
    if (pool.current_epoch !== null && epoch !== pool.current_epoch + 1) {
      console.warn(`⚠️  Epoch jump detected for pool ${poolAddress}: ${pool.current_epoch} → ${epoch} (expected ${pool.current_epoch + 1})`);
    }

    // 1. Insert settlement record
    const { error: settlementError } = await this.supabase
      .from('settlements')
      .insert({
        pool_address: poolAddress,
        post_id: pool.post_id,
        belief_id: pool.belief_id,
        epoch: epoch,
        bd_relevance_score: bdScore,  // ✅ FIX: Correct column name
        market_prediction_q: Number(event.marketPredictionQ) / Number(Q64_ONE),  // ✅ FIX: Correct column name
        f_long: Number(event.fLong) / Number(Q64_ONE),  // ✅ FIX: Correct column name
        f_short: Number(event.fShort) / Number(Q64_ONE),  // ✅ FIX: Correct column name
        reserve_long_before: Number(event.rLongBefore),  // ✅ FIX: Correct column name (stored as bigint lamports in DB)
        reserve_short_before: Number(event.rShortBefore),  // ✅ FIX: Correct column name (stored as bigint lamports in DB)
        reserve_long_after: Number(event.rLongAfter),  // ✅ FIX: Correct column name (stored as bigint lamports in DB)
        reserve_short_after: Number(event.rShortAfter),  // ✅ FIX: Correct column name (stored as bigint lamports in DB)
        s_scale_long_before: event.sScaleLongBefore.toString(),   // NEW
        s_scale_long_after: event.sScaleLongAfter.toString(),     // NEW
        s_scale_short_before: event.sScaleShortBefore.toString(), // NEW
        s_scale_short_after: event.sScaleShortAfter.toString(),   // NEW
        tx_signature: signature,
        timestamp: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(),  // ✅ FIX: Correct column name
        recorded_by: 'indexer',
        confirmed: true,
      });

    if (settlementError) {
      // Check if it's a duplicate (UNIQUE constraint violation)
      if (settlementError.code === '23505') {
      } else {
        console.error('Failed to insert settlement record:', settlementError);
        return; // Don't update pool if settlement insert failed
      }
    } else {
    }

    // 2. Update pool_deployments with new epoch
    const { error: updateError } = await this.supabase
      .from('pool_deployments')
      .update({
        current_epoch: epoch,
        last_settlement_epoch: epoch,
        last_settlement_tx: signature,
        last_synced_at: new Date().toISOString(),
      })
      .eq('pool_address', poolAddress);

    if (updateError) {
      console.error('Failed to update pool epoch:', updateError);
    } else {
    }

    // 2.5. Sync full pool state from chain after settlement (FORCE UPDATE to get scaled reserves)
    let priceLong: number | null = null;
    let priceShort: number | null = null;
    let sqrtPriceLongX96: string | null = null;
    let sqrtPriceShortX96: string | null = null;

    try {
      const poolState = await syncPoolFromChain(poolAddress, undefined, 5000, true);
      if (poolState) {
        console.log(`✅ Synced pool state after settlement (epoch ${epoch})`);

        // Fetch prices from pool_deployments (now updated by syncPoolFromChain)
        const { data: poolWithPrices } = await this.supabase
          .from('pool_deployments')
          .select('sqrt_price_long_x96, sqrt_price_short_x96')
          .eq('pool_address', poolAddress)
          .single();

        if (poolWithPrices?.sqrt_price_long_x96 && poolWithPrices?.sqrt_price_short_x96) {
          sqrtPriceLongX96 = poolWithPrices.sqrt_price_long_x96;
          sqrtPriceShortX96 = poolWithPrices.sqrt_price_short_x96;

          // Calculate human-readable prices
          priceLong = this.sqrtPriceX96ToPrice(BigInt(sqrtPriceLongX96));
          priceShort = this.sqrtPriceX96ToPrice(BigInt(sqrtPriceShortX96));

          console.log(`[event-indexer] Calculated settlement prices:`, {
            priceLong,
            priceShort
          });

          // Update settlement record with prices
          await this.supabase
            .from('settlements')
            .update({
              sqrt_price_long_x96_after: sqrtPriceLongX96,
              sqrt_price_short_x96_after: sqrtPriceShortX96,
              price_long_after: priceLong,
              price_short_after: priceShort,
            })
            .eq('tx_signature', signature);

          console.log(`✅ Settlement prices updated for tx ${signature}`);
        }
      } else {
        console.warn(`⚠️  Failed to sync pool state after settlement`);
      }
    } catch (syncError) {
      console.error(`❌ Exception syncing pool state after settlement:`, syncError);
    }

    // 3. Also store BD score in bd_scores table (legacy/backup)
    await this.supabase
      .from('bd_scores')
      .upsert({
        pool_address: poolAddress,
        score: bdScore,
        triggered_by: event.settler.toString(),
        tx_signature: signature,
        block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
        slot,
      }, {
        onConflict: 'tx_signature'
      });

    // 4. Record implied relevance after settlement
    // After settlement, reserves are scaled by BD score
    const rLongAfter = Number(event.rLongAfter) / 1_000_000;  // Convert from lamports to USDC
    const rShortAfter = Number(event.rShortAfter) / 1_000_000;

    await this.recordImpliedRelevance({
      poolAddress,
      eventType: 'rebase',
      eventReference: signature,
      reserveLong: rLongAfter,
      reserveShort: rShortAfter,
      blockTime,
    });

    // 5. CRITICAL: Trigger protocol processing (BD + BTS + redistribution)
    // This is the BACKUP path - manual recording is primary, but if that fails,
    // Helius webhook will trigger processing. Idempotency prevents double-processing.
    console.log(`[event-indexer] Triggering protocol processing for belief ${pool.belief_id}, epoch ${epoch - 1}...`);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      (async () => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/protocol-belief-epoch-process`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              belief_id: pool.belief_id,
              current_epoch: epoch - 1 // Process the epoch that just ended
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[event-indexer] ⚠️  Protocol processing failed: ${errorText}`);
          } else {
            const result = await response.json();
            console.log(`[event-indexer] ✅ Protocol processing completed:`, {
              participant_count: result.participant_count,
              redistribution_occurred: result.redistribution_occurred,
              slashing_pool: result.slashing_pool
            });
          }
        } catch (asyncError) {
          console.error(`[event-indexer] ⚠️  Protocol processing error:`, asyncError);
        }
      })();
    } else {
      console.warn('[event-indexer] ⚠️  Supabase URL/key not configured, skipping protocol processing');
    }

  }

  /**
   * Process a MarketDeployedEvent from the blockchain
   */
  async handleMarketDeployedEvent(
    event: MarketDeployedEventData,
    signature: string,
    blockTime?: number,
    slot?: number
  ): Promise<void> {

    const poolAddress = event.pool.toString();

    // Fetch pool data from chain to get mint addresses and post_id
    try {
      const poolData = await fetchPoolData(poolAddress, getRpcEndpoint());

      if (!poolData) {
        console.error('❌ Could not fetch pool data for', poolAddress);
        return;
      }

      const { contentId, longMint, shortMint } = poolData;

      // Convert content_id (32 bytes) to UUID for post_id
      const postId = `${contentId.slice(0, 8)}-${contentId.slice(8, 12)}-${contentId.slice(12, 16)}-${contentId.slice(16, 20)}-${contentId.slice(20, 32)}`;

      // Get post to get belief_id
      const { data: post } = await this.supabase
        .from('posts')
        .select('belief_id')
        .eq('id', postId)
        .single();

      if (!post?.belief_id) {
        console.error('❌ Post not found for pool', poolAddress);
        return;
      }

      // Use the same atomic RPC function as the API for idempotency
      // Pass all required parameters from on-chain data
      const { data: result, error: rpcError } = await this.supabase.rpc('deploy_pool_with_lock', {
        p_post_id: postId,
        p_belief_id: post.belief_id,
        p_pool_address: poolAddress,
        p_token_supply: poolData._raw.vaultBalanceMicro, // Initial deposit
        p_reserve: poolData._raw.vaultBalanceMicro, // Initial reserve equals initial deposit
        p_f: poolData.f,
        p_beta_num: poolData.betaNum,
        p_beta_den: poolData.betaDen,
        p_long_mint_address: longMint.toString(),
        p_short_mint_address: shortMint.toString(),
        p_s_long_supply: poolData._raw.sLongAtomic,
        p_s_short_supply: poolData._raw.sShortAtomic,
        p_sqrt_price_long_x96: poolData._raw.sqrtPriceLongX96,
        p_sqrt_price_short_x96: poolData._raw.sqrtPriceShortX96,
        p_vault_balance: poolData._raw.vaultBalanceMicro,
        p_deployment_tx_signature: signature,
        p_deployer_user_id: null, // Indexer doesn't know who deployed, leave null
      });

      if (rpcError) {
        console.error('❌ RPC error recording pool deployment:', rpcError);
        return;
      }


      // Whether it's new or existing, update the pool state with fresh on-chain data
      // This ensures sqrt_price, supplies, and vault_balance are all accurate
      // poolData._raw contains the properly converted atomic units for DB storage
      const { error: updateError } = await this.supabase
        .from('pool_deployments')
        .update({
          s_long_supply: poolData._raw.sLongAtomic,
          s_short_supply: poolData._raw.sShortAtomic,
          vault_balance: poolData._raw.vaultBalanceMicro,
          sqrt_price_long_x96: poolData._raw.sqrtPriceLongX96,
          sqrt_price_short_x96: poolData._raw.sqrtPriceShortX96,
          sqrt_lambda_long_x96: poolData.sqrtLambdaLongX96,
          sqrt_lambda_short_x96: poolData.sqrtLambdaShortX96,
          f: poolData.f,
          beta_num: poolData.betaNum,
          beta_den: poolData.betaDen,
          r_long: poolData.marketCapLong,  // Market cap LONG (display USDC) = s × p
          r_short: poolData.marketCapShort,  // Market cap SHORT (display USDC) = s × p
          market_deployment_tx_signature: signature,
          market_deployed_at: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(),
          status: 'market_deployed',
          last_synced_at: new Date().toISOString(),
        })
        .eq('pool_address', poolAddress);

      if (updateError) {
        console.error('❌ Failed to update pool state after deployment:', updateError);
        return;
      }

      if (result?.success) {
      } else if (result?.error === 'EXISTS') {
      } else {
        console.error('❌ Failed to record pool deployment:', result?.message);
        return;
      }
    } catch (fetchError) {
      console.error('❌ Error fetching pool data:', fetchError);
      return;
    }

    // Record initial implied relevance (50/50 deployment)
    const totalDeposit = Number(event.initialDeposit) / 1_000_000;  // Convert from lamports to USDC
    const reserveLong = totalDeposit / 2;
    const reserveShort = totalDeposit / 2;

    await this.recordImpliedRelevance({
      poolAddress,
      eventType: 'deployment',
      eventReference: signature,
      reserveLong,
      reserveShort,
      blockTime,
    });
  }

  /**
   * Handle custodian deposit events (direct deposits, not trade skims)
   */
  async handleDepositEvent(
    event: DepositEventData,
    txSignature: string,
    slot: number,
    blockTime: number | null
  ): Promise<void> {
    const depositorAddress = event.depositor.toBase58();
    const amountMicro = Number(event.amount); // Keep in micro-USDC for database
    const amountUsdc = amountMicro / 1_000_000; // Display USDC for logging


    // Ensure agent exists and get agent_id
    let agentId: string;
    const { data: agent } = await this.supabase
      .from('agents')
      .select('id')
      .eq('solana_address', depositorAddress)
      .single();

    if (!agent) {
      const { data: newAgent, error: agentError } = await this.supabase
        .from('agents')
        .insert({
          solana_address: depositorAddress,
          created_at: new Date(Number(event.timestamp) * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (agentError || !newAgent) {
        console.error('Failed to create agent:', agentError);
        throw agentError;
      }
      agentId = newAgent.id;
    } else {
      agentId = agent.id;
    }

    // Check if this deposit was already recorded by server
    const { data: existing } = await this.supabase
      .from('custodian_deposits')
      .select('*')
      .eq('tx_signature', txSignature)
      .single();

    if (existing) {
      // Deposit already recorded (by server or previous indexer run)
      // Just mark as confirmed
      const { error: updateError } = await this.supabase
        .from('custodian_deposits')
        .update({
          confirmed: true,
          slot,
          block_time: blockTime,
          indexed_at: new Date().toISOString(),
        })
        .eq('tx_signature', txSignature);

      if (updateError) {
        console.error('Failed to update deposit:', updateError);
        throw updateError;
      }

      // Only add stake if it wasn't already credited
      // (Server might have crashed before marking agent_credited=true)
      if (!existing.agent_credited) {
        const { error: stakeError } = await this.supabase
          .rpc('add_agent_stake', {
            p_agent_id: agentId,
            p_amount: amountMicro,
          });

        if (stakeError) {
          console.error('Failed to update agent stake on confirmation:', stakeError);
          throw stakeError;
        }

        // Mark as credited
        await this.supabase
          .from('custodian_deposits')
          .update({
            agent_credited: true,
            credited_at: new Date().toISOString(),
          })
          .eq('tx_signature', txSignature);
      }
    } else {
      // Insert new deposit record from indexer
      const { error: insertError } = await this.supabase
        .from('custodian_deposits')
        .insert({
          tx_signature: txSignature,
          depositor_address: depositorAddress,
          amount_usdc: amountMicro,  // Store in micro-USDC
          deposit_type: 'direct',
          recorded_by: 'indexer',
          confirmed: true,
          agent_credited: false, // Will be set to true after updating stake
          slot,
          block_time: blockTime,
          indexed_at: new Date().toISOString(),
          timestamp: new Date(Number(event.timestamp) * 1000).toISOString(),
        });

      if (insertError) {
        console.error('Failed to insert deposit:', insertError);
        throw insertError;
      }

      // Update agent's total_stake using the database function
      const { error: stakeError } = await this.supabase
        .rpc('add_agent_stake', {
          p_agent_id: agentId,
          p_amount: amountMicro,  // Pass micro-USDC
        });

      if (stakeError) {
        console.error('Failed to update agent stake:', stakeError);
        throw stakeError;
      }

      // Mark as credited
      await this.supabase
        .from('custodian_deposits')
        .update({
          agent_credited: true,
          credited_at: new Date().toISOString(),
        })
        .eq('tx_signature', txSignature);
    }

  }

  /**
   * Handle custodian withdrawal events
   */
  async handleWithdrawEvent(
    event: WithdrawEventData,
    txSignature: string,
    slot: number,
    blockTime: number | null
  ): Promise<void> {
    const recipientAddress = event.recipient.toBase58();
    const authorityAddress = event.authority.toBase58();
    const amountMicro = Number(event.amount); // Keep in micro-USDC for database
    const amountUsdc = amountMicro / 1_000_000; // Display USDC for logging


    // Ensure agent exists and get agent_id
    let agentId: string;
    const { data: agent } = await this.supabase
      .from('agents')
      .select('id')
      .eq('solana_address', recipientAddress)
      .single();

    if (!agent) {
      const { data: newAgent, error: agentError } = await this.supabase
        .from('agents')
        .insert({
          solana_address: recipientAddress,
          created_at: new Date(Number(event.timestamp) * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (agentError || !newAgent) {
        console.error('Failed to create agent:', agentError);
        throw agentError;
      }
      agentId = newAgent.id;
    } else {
      agentId = agent.id;
    }

    // Check if this withdrawal was already recorded by server
    const { data: existing } = await this.supabase
      .from('custodian_withdrawals')
      .select('*')
      .eq('tx_signature', txSignature)
      .single();

    if (existing) {

      const { error: updateError } = await this.supabase
        .from('custodian_withdrawals')
        .update({
          confirmed: true,
          slot,
          block_time: blockTime,
          indexed_at: new Date().toISOString(),
        })
        .eq('tx_signature', txSignature);

      if (updateError) {
        console.error('Failed to update withdrawal:', updateError);
        throw updateError;
      }
    } else {
      // Insert new withdrawal record from indexer
      const { error: insertError } = await this.supabase
        .from('custodian_withdrawals')
        .insert({
          tx_signature: txSignature,
          recipient_address: recipientAddress,
          authority_address: authorityAddress,
          amount_usdc: amountMicro,  // Store in micro-USDC
          recorded_by: 'indexer',
          confirmed: true,
          slot,
          block_time: blockTime,
          indexed_at: new Date().toISOString(),
          timestamp: new Date(Number(event.timestamp) * 1000).toISOString(),
        });

      if (insertError) {
        console.error('Failed to insert withdrawal:', insertError);
        throw insertError;
      }

      // Subtract from agent's total_stake using the database function (negative amount)
      const { error: stakeError } = await this.supabase
        .rpc('add_agent_stake', {
          p_agent_id: agentId,
          p_amount: -amountMicro, // Negative micro-USDC to subtract
        });

      if (stakeError) {
        console.error('Failed to update agent stake:', stakeError);
        throw stakeError;
      }
    }

  }

  /**
   * Handle LiquidityAdded events - create two position records (Long and Short)
   * These are NOT treated as belief submissions for the protocol
   */
  async handleLiquidityAddedEvent(
    event: LiquidityAddedEventData,
    signature: string,
    blockTime?: number,
    slot?: number
  ): Promise<void> {

    const poolAddress = event.pool.toString();
    const walletAddress = event.user.toString();
    const longTokens = Number(event.longTokensOut) / 1_000_000;
    const shortTokens = Number(event.shortTokensOut) / 1_000_000;
    const totalUsdc = Number(event.usdcAmount) / 1_000_000;

    // Get pool deployment to find post_id
    const { data: pool } = await this.supabase
      .from('pool_deployments')
      .select('post_id')
      .eq('pool_address', poolAddress)
      .single();

    if (!pool) {
      console.error(`❌ Pool not found for address: ${poolAddress}`);
      return;
    }

    // Get user_id from wallet address
    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    if (!user) {
      console.error(`❌ User not found for wallet: ${walletAddress}`);
      return;
    }

    // Check if already recorded
    const { data: existing } = await this.supabase
      .from('trades')
      .select('*')
      .eq('tx_signature', signature)
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    // Create TWO position records: one for Long, one for Short
    // These are marked as 'liquidity_provision' not 'trade'
    // and do NOT have an associated belief_id

    // Insert Long position
    const { error: longError } = await this.supabase
      .from('trades')
      .insert({
        tx_signature: signature,
        pool_address: poolAddress,
        post_id: pool.post_id,
        user_id: user.id,
        wallet_address: walletAddress,
        trade_type: 'liquidity_provision',
        side: 'LONG',
        token_amount: longTokens,
        usdc_amount: (totalUsdc * longTokens) / (longTokens + shortTokens), // Proportional USDC
        recorded_by: 'indexer',
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
        slot,
        indexed_at: new Date().toISOString(),
        // No belief_id - this is not a predictive trade
      });

    if (longError) {
      console.error('Failed to record Long liquidity position:', longError);
      throw longError;
    }

    // Insert Short position (use different signature to avoid unique constraint)
    const { error: shortError } = await this.supabase
      .from('trades')
      .insert({
        tx_signature: `${signature}-short`, // Append to make unique
        pool_address: poolAddress,
        post_id: pool.post_id,
        user_id: user.id,
        wallet_address: walletAddress,
        trade_type: 'liquidity_provision',
        side: 'SHORT',
        token_amount: shortTokens,
        usdc_amount: (totalUsdc * shortTokens) / (longTokens + shortTokens), // Proportional USDC
        recorded_by: 'indexer',
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
        slot,
        indexed_at: new Date().toISOString(),
        // No belief_id - this is not a predictive trade
      });

    if (shortError) {
      console.error('Failed to record Short liquidity position:', shortError);
      throw shortError;
    }

    // Update pool state from liquidity event
    const newSLong = Number(event.newSLong) / 1_000_000;
    const newSShort = Number(event.newSShort) / 1_000_000;
    const newRLong = Number(event.newRLong) / 1_000_000;
    const newRShort = Number(event.newRShort) / 1_000_000;

    await this.supabase
      .from('pool_deployments')
      .update({
        token_supply: newSLong + newSShort,
        reserve: newRLong + newRShort,
        last_synced_at: new Date().toISOString(),
      })
      .eq('pool_address', poolAddress);

  }
}

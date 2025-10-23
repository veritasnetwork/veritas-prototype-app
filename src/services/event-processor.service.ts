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
    console.log('📥 Processing trade event:', signature);

    // Extract data from event
    const poolAddress = event.pool.toString();
    const walletAddress = event.trader.toString();
    const side = 'long' in event.side ? 'LONG' : 'SHORT';
    const tradeType = 'buy' in event.tradeType ? 'buy' : 'sell';

    // Convert from lamports to decimal units (6 decimals)
    const usdcToTrade = Number(event.usdcToTrade) / 1_000_000;
    const tokensTraded = Number(event.tokensTraded) / 1_000_000;
    const skimAmount = Number(event.usdcToStake) / 1_000_000;

    // ICBS state snapshots
    const sLongBefore = Number(event.sLongBefore);
    const sLongAfter = Number(event.sLongAfter);
    const sShortBefore = Number(event.sShortBefore);
    const sShortAfter = Number(event.sShortAfter);

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
      console.log(`🔄 Trade ${signature} already recorded by ${existing.recorded_by}`);

      // Validate server data against on-chain event
      const amountsMatch =
        Math.abs(Number(existing.usdc_amount) - usdcToTrade) < 0.01 && // Allow tiny floating point diff
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

        console.log(`✅ Validated server record: ${signature}`);

        // Record the skim as a custodian deposit if there is one
        if (skimAmount > 0) {
          await this.recordSkimDeposit(walletAddress, skimAmount, signature, blockTime, slot, Number(event.timestamp));
        }
      } else {
        // Server data INCORRECT - overwrite with on-chain truth
        console.warn(`⚠️  Server data mismatch for ${signature}:`);
        console.warn(`   Server: usdc=${existing.usdc_amount}, tokens=${existing.token_amount}`);
        console.warn(`   On-chain: usdc=${usdcToTrade}, tokens=${tokensTraded}`);

        await this.supabase
          .from('trades')
          .update({
            usdc_amount: usdcToTrade,
            token_amount: tokensTraded,
            server_amount: existing.usdc_amount,
            indexer_corrected: true,
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            block_time: blockTime ? new Date(blockTime * 1000).toISOString() : null,
            slot,
          })
          .eq('tx_signature', signature);

        console.log(`🔧 Corrected server record with on-chain data: ${signature}`);

        // Record the skim as a custodian deposit if there is one
        if (skimAmount > 0) {
          await this.recordSkimDeposit(walletAddress, skimAmount, signature, blockTime, slot, Number(event.timestamp));
        }
      }
    } else {
      // Server didn't record this (or failed) - insert from indexer
      console.log(`📝 Server missed this trade, indexer recording: ${signature}`);

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
      await this.supabase
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
          usdc_amount: usdcToTrade,
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
        });

      console.log(`✅ Indexer recorded trade: ${signature}`);

      // Record the skim as a custodian deposit if there is one
      if (skimAmount > 0) {
        await this.recordSkimDeposit(walletAddress, skimAmount, signature, blockTime, slot, Number(event.timestamp));
      }
    }

    // Update pool state with CORRECT field names
    await this.supabase
      .from('pool_deployments')
      .update({
        s_long_supply: sLongAfter,           // ✅ Correct field name
        s_short_supply: sShortAfter,         // ✅ Correct field name
        vault_balance: vaultBalance,         // ✅ Correct field name
        r_long: rLongAfter,
        r_short: rShortAfter,
        sqrt_price_long_x96: sqrtPriceLongX96,
        sqrt_price_short_x96: sqrtPriceShortX96,
        last_synced_at: new Date().toISOString(),
      })
      .eq('pool_address', poolAddress);

    console.log(`📊 Updated pool state: s_long=${sLongAfter}, s_short=${sShortAfter}, vault=${vaultBalance}`);

    // Update total volume cache on posts table
    const { data: totalVolumeData } = await this.supabase
      .from('trades')
      .select('usdc_amount')
      .eq('pool_address', poolAddress);

    if (totalVolumeData) {
      const totalVolume = totalVolumeData.reduce((sum, trade) => sum + Number(trade.usdc_amount || 0), 0);

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

        console.log(`💰 Updated total volume for post ${poolData.post_id}: $${totalVolume.toFixed(2)}`);
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

      // Upsert implied relevance (indexer can correct server data)
      const { error } = await this.supabase
        .from('implied_relevance_history')
        .upsert(
          {
            post_id: pool.post_id,
            belief_id: pool.belief_id,
            implied_relevance: impliedRelevance,
            reserve_long: reserveLong,
            reserve_short: reserveShort,
            event_type: eventType,
            event_reference: eventReference,
            confirmed: true,
            recorded_by: 'indexer',
            recorded_at: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(),
          },
          {
            onConflict: 'event_reference',
            ignoreDuplicates: false, // Update if server already recorded
          }
        );

      if (error) {
        console.error(`❌ Failed to record implied relevance:`, error);
      } else {
        console.log(`📈 Implied relevance recorded: ${impliedRelevance.toFixed(4)} (${eventType})`);
      }
    } catch (error) {
      console.error(`❌ Error in recordImpliedRelevance:`, error);
    }
  }

  /**
   * Record a trade skim as a custodian deposit AND update agent total_stake
   */
  private async recordSkimDeposit(
    walletAddress: string,
    skimAmount: number,
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
      console.log(`💰 Skim deposit already recorded for ${signature}`);
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

    console.log(`💰 Recorded trade skim deposit: ${skimAmount} USDC from ${walletAddress}, updated total_stake`);
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
    console.log('📊 Processing settlement event:', signature);

    const poolAddress = event.pool.toString();
    const epoch = Number(event.epoch);
    const bdScore = Number(event.bdScore) / Math.pow(2, 32); // Convert from Q32.32
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
        bd_score: bdScore,
        market_prediction: Number(event.marketPredictionQ) / Number(Q64_ONE),
        settlement_factor_long: Number(event.fLong) / Number(Q64_ONE),
        settlement_factor_short: Number(event.fShort) / Number(Q64_ONE),
        s_long_before: Number(event.rLongBefore),
        s_short_before: Number(event.rShortBefore),
        s_long_after: Number(event.rLongAfter),
        s_short_after: Number(event.rShortAfter),
        tx_signature: signature,
        settled_at: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(),
        event_slot: slot,
        event_signature: signature,
      });

    if (settlementError) {
      // Check if it's a duplicate (UNIQUE constraint violation)
      if (settlementError.code === '23505') {
        console.log(`ℹ️  Settlement already recorded for pool ${poolAddress} epoch ${epoch}`);
      } else {
        console.error('Failed to insert settlement record:', settlementError);
        return; // Don't update pool if settlement insert failed
      }
    } else {
      console.log(`✅ Recorded settlement for pool ${poolAddress} epoch ${epoch}`);
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
      console.log(`✅ Updated pool ${poolAddress} to epoch ${epoch}`);
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

    console.log(`✅ Settlement event processed completely for pool ${poolAddress}`);
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
    console.log('🚀 Processing market deployed event:', signature);

    const poolAddress = event.pool.toString();

    // Derive the content_id from pool address to get mint addresses
    // The pool PDA is derived from [b"content_pool", content_id]
    // We need to fetch the pool account to get the content_id
    // For now, we'll store what we have and update mints separately

    // Update pool deployment with initial state
    const { error } = await this.supabase
      .from('pool_deployments')
      .update({
        token_supply: Number(event.longTokens) + Number(event.shortTokens),
        reserve: Number(event.initialDeposit),
        last_synced_at: new Date().toISOString(),
        deployment_tx_signature: signature, // Also store the deployment signature
      })
      .eq('pool_address', poolAddress);

    if (error) {
      console.error('Failed to update pool deployment:', error);
    } else {
      console.log(`✅ Updated pool ${poolAddress} with initial market state`);
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
    const amountUsdc = Number(event.amount) / 1_000_000; // Convert from lamports to USDC

    console.log(`💵 Processing direct deposit: ${depositorAddress} deposited ${amountUsdc} USDC`);

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
      console.log('Deposit already recorded, updating with blockchain data');

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
    } else {
      // Insert new deposit record from indexer
      const { error: insertError } = await this.supabase
        .from('custodian_deposits')
        .insert({
          tx_signature: txSignature,
          depositor_address: depositorAddress,
          amount_usdc: amountUsdc,
          deposit_type: 'direct',
          recorded_by: 'indexer',
          confirmed: true,
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
          p_amount: amountUsdc,
        });

      if (stakeError) {
        console.error('Failed to update agent stake:', stakeError);
        throw stakeError;
      }
    }

    console.log(`✅ Recorded direct custodian deposit: ${amountUsdc} USDC, updated total_stake`);
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
    const amountUsdc = Number(event.amount) / 1_000_000; // Convert from lamports to USDC

    console.log(`💸 Processing withdrawal: ${recipientAddress} withdrew ${amountUsdc} USDC`);

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
      console.log('Withdrawal already recorded, updating with blockchain data');

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
          amount_usdc: amountUsdc,
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
          p_amount: -amountUsdc, // Negative to subtract
        });

      if (stakeError) {
        console.error('Failed to update agent stake:', stakeError);
        throw stakeError;
      }
    }

    console.log(`✅ Recorded custodian withdrawal: ${amountUsdc} USDC, updated total_stake`);
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
    console.log('💧 Processing liquidity added event:', signature);

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
      console.log(`🔄 Liquidity provision ${signature} already recorded`);
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

    console.log(`✅ Recorded bilateral liquidity provision: ${longTokens} LONG + ${shortTokens} SHORT`);
    console.log(`📊 Updated pool state: supply=${newSLong + newSShort}, reserve=${newRLong + newRShort}`);
  }
}

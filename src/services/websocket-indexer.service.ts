/**
 * WebSocket Event Indexer
 *
 * Subscribes to Solana program logs via WebSocket connection.
 * Used for local/devnet environments where Helius is not available.
 */

import { Connection, PublicKey, Logs } from '@solana/web3.js';
import { Program, BorshCoder, EventParser, Event } from '@coral-xyz/anchor';
import { EventProcessor } from './event-processor.service';

export class WebSocketIndexer {
  private connection: Connection;
  private program: Program;
  private eventParser: EventParser;
  private eventProcessor: EventProcessor;
  private subscriptionId: number | null = null;

  constructor(connection: Connection, program: Program) {
    this.connection = connection;
    this.program = program;
    this.eventParser = new EventParser(
      program.programId,
      new BorshCoder(program.idl)
    );
    this.eventProcessor = new EventProcessor();
  }

  async start() {
    const network = process.env.SOLANA_NETWORK || 'localnet';

    if (network === 'mainnet-beta') {
      throw new Error(
        'WebSocket indexer should not run on mainnet. Use Helius webhooks instead.'
      );
    }


    // First, sync historical transactions
    await this.syncHistoricalTransactions();

    // Then subscribe to new program logs
    this.subscriptionId = this.connection.onLogs(
      this.program.programId,
      async (logs: Logs, ctx) => {
        try {
          await this.processLogs(logs.logs, logs.signature, ctx.slot);
        } catch (error) {
          console.error('Error processing logs:', error);
        }
      },
      'confirmed'
    );

  }

  /**
   * Sync unindexed pools on startup
   * Fetches current on-chain state for pools that weren't properly indexed
   * Works on all networks (localnet/devnet/mainnet) regardless of tx history
   */
  private async syncHistoricalTransactions() {

    try {
      const { getSupabaseServiceRole } = await import('@/lib/supabase-server');
      const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
      const supabase = getSupabaseServiceRole();

      // Find pools that have NULL sqrt_price (not indexed)
      const { data: pools, error } = await supabase
        .from('pool_deployments')
        .select('pool_address')
        .is('sqrt_price_long_x96', null)
        .limit(50);

      if (error) {
        console.error('   Failed to query pools:', error);
        return;
      }

      if (!pools || pools.length === 0) {
        return;
      }


      // For each pool, fetch current on-chain state and update database
      const rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';

      for (const pool of pools) {
        try {

          const poolData = await fetchPoolData(pool.pool_address, rpcUrl);

          if (!poolData) {
            console.warn(`   ⚠️  Could not fetch data for ${pool.pool_address}`);
            continue;
          }

          // Update database with on-chain state
          const { error: updateError } = await supabase
            .from('pool_deployments')
            .update({
              sqrt_price_long_x96: poolData._raw.sqrtPriceLongX96,
              sqrt_price_short_x96: poolData._raw.sqrtPriceShortX96,
              sqrt_lambda_long_x96: poolData.sqrtLambdaLongX96,
              sqrt_lambda_short_x96: poolData.sqrtLambdaShortX96,
              vault_balance: Number(poolData.vaultBalance * 1_000_000),
              s_long_supply: Number(poolData.supplyLong * 1_000_000),
              s_short_supply: Number(poolData.supplyShort * 1_000_000),
              r_long: Number(poolData.marketCapLong * 1_000_000),
              r_short: Number(poolData.marketCapShort * 1_000_000),
              f: poolData.f,
              beta_num: poolData.betaNum,
              beta_den: poolData.betaDen,
              last_synced_at: new Date().toISOString(),
            })
            .eq('pool_address', pool.pool_address);

          if (updateError) {
            console.error(`   ❌ Failed to update ${pool.pool_address}:`, updateError);
          } else {
          }
        } catch (err) {
          console.warn(`   Failed to sync pool ${pool.pool_address}:`, err);
        }
      }

    } catch (err) {
      console.error('❌ Failed to sync pools:', err);
    }
  }

  async stop() {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
    }
  }

  private async processLogs(logs: string[], signature: string, slot: number) {
    const events = this.parseEvents(logs);

    if (events.length === 0) {
      return; // No events in this transaction
    }


    // Get block time from transaction (if available)
    let blockTime: number | undefined;
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      blockTime = tx?.blockTime ?? undefined;
    } catch (err) {
      console.warn(`Could not fetch block time for ${signature}:`, err);
    }

    // Process each event
    for (const event of events) {
      try {
        await this.processEvent(event, signature, blockTime, slot);
      } catch (error) {
        console.error(`Failed to process event ${event.name}:`, error);
      }
    }
  }

  private async processEvent(
    event: Event,
    signature: string,
    blockTime?: number,
    slot?: number
  ) {
    switch (event.name) {
      case 'TradeEvent':
        await this.eventProcessor.handleTradeEvent(
          event.data,
          signature,
          blockTime,
          slot
        );
        break;

      case 'SettlementEvent':
        await this.eventProcessor.handleSettlementEvent(
          event.data,
          signature,
          blockTime,
          slot
        );
        break;

      case 'MarketDeployedEvent':
        await this.eventProcessor.handleMarketDeployedEvent(
          event.data,
          signature,
          blockTime,
          slot
        );
        break;

      case 'DepositEvent':
        await this.eventProcessor.handleDepositEvent(
          event.data,
          signature,
          slot || 0,
          blockTime || null
        );
        break;

      case 'WithdrawEvent':
        await this.eventProcessor.handleWithdrawEvent(
          event.data,
          signature,
          slot || 0,
          blockTime || null
        );
        break;

      case 'LiquidityAdded':
        await this.eventProcessor.handleLiquidityAddedEvent(
          event.data,
          signature,
          blockTime,
          slot
        );
        break;

      case 'PoolInitializedEvent':
        break;

      case 'PoolClosedEvent':
        break;

      default:
    }
  }

  private parseEvents(logs: string[]): Event[] {
    const events: Event[] = [];

    for (const log of logs) {
      // Anchor events are in logs that start with "Program data: "
      if (log.startsWith('Program data: ')) {
        try {
          const parsed = this.eventParser.parseLogs([log]);
          if (parsed && parsed.length > 0) {
            events.push(...parsed);
          }
        } catch (err) {
          // Not all "Program data:" logs are events, ignore parse errors
          continue;
        }
      }
    }

    return events;
  }

  isRunning(): boolean {
    return this.subscriptionId !== null;
  }
}

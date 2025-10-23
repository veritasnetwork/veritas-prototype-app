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

    console.log(`🚀 Starting WebSocket indexer for ${network}...`);
    console.log(`   Program ID: ${this.program.programId.toString()}`);

    // Subscribe to program logs
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

    console.log(`✅ WebSocket indexer started (subscription ID: ${this.subscriptionId})`);
  }

  async stop() {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
      console.log('🛑 WebSocket indexer stopped');
    }
  }

  private async processLogs(logs: string[], signature: string, slot: number) {
    const events = this.parseEvents(logs);

    if (events.length === 0) {
      return; // No events in this transaction
    }

    console.log(`📦 Found ${events.length} event(s) in tx: ${signature}`);

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
        console.log('ℹ️  Pool initialized:', event.data.pool.toString());
        break;

      case 'PoolClosedEvent':
        console.log('ℹ️  Pool closed:', event.data.pool.toString());
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event.name}`);
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

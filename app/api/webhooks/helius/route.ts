/**
 * Helius Webhook Handler
 *
 * Receives blockchain event webhooks from Helius for mainnet.
 * Parses Anchor events from transaction logs and processes them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventProcessor } from '@/services/event-processor.service';
import { Program, BorshCoder, EventParser } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

const eventProcessor = new EventProcessor();

export async function POST(req: NextRequest) {
  console.log('📥 Received Helius webhook');

  try {
    const payload = await req.json();
    const events = Array.isArray(payload) ? payload : [payload];

    console.log(`Processing ${events.length} event(s) from Helius`);

    // Get program ID from environment
    const programId = process.env.NEXT_PUBLIC_CONTENT_POOL_PROGRAM_ID;
    if (!programId) {
      throw new Error('NEXT_PUBLIC_CONTENT_POOL_PROGRAM_ID not set');
    }

    // Create event parser
    const eventParser = new EventParser(
      new PublicKey(programId),
      new BorshCoder(idl as any)
    );

    for (const heliusEvent of events) {
      const signature = heliusEvent.signature;
      const blockTime = heliusEvent.blockTime;
      const slot = heliusEvent.slot;

      console.log(`🔍 Processing Helius event: ${signature}`);

      // Parse Anchor events from transaction logs
      const logMessages = heliusEvent.meta?.logMessages || heliusEvent.logs || [];
      const anchorEvents = eventParser.parseLogs(logMessages);

      if (anchorEvents.length === 0) {
        console.log(`   No events found in tx: ${signature}`);
        continue;
      }

      console.log(`   Found ${anchorEvents.length} Anchor event(s)`);

      // Process each event
      for (const event of anchorEvents) {
        try {
          switch (event.name) {
            case 'TradeEvent':
              await eventProcessor.handleTradeEvent(
                event.data,
                signature,
                blockTime,
                slot
              );
              break;

            case 'SettlementEvent':
              await eventProcessor.handleSettlementEvent(
                event.data,
                signature,
                blockTime,
                slot
              );
              break;

            case 'MarketDeployedEvent':
              await eventProcessor.handleMarketDeployedEvent(
                event.data,
                signature,
                blockTime,
                slot
              );
              break;

            case 'DepositEvent':
              await eventProcessor.handleDepositEvent(
                event.data,
                signature,
                slot || 0,
                blockTime || null
              );
              break;

            case 'WithdrawEvent':
              await eventProcessor.handleWithdrawEvent(
                event.data,
                signature,
                slot || 0,
                blockTime || null
              );
              break;

            case 'LiquidityAdded':
              await eventProcessor.handleLiquidityAddedEvent(
                event.data,
                signature,
                blockTime,
                slot
              );
              break;

            case 'PoolInitializedEvent':
              console.log('   ℹ️  Pool initialized:', event.data.pool.toString());
              break;

            case 'PoolClosedEvent':
              console.log('   ℹ️  Pool closed:', event.data.pool.toString());
              break;

            default:
              console.log(`   ℹ️  Unhandled event type: ${event.name}`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to process event ${event.name}:`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: events.length,
    });

  } catch (error) {
    console.error('💥 Helius webhook error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'helius-webhook',
    network: process.env.SOLANA_NETWORK,
  });
}

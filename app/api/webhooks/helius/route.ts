/**
 * Helius Webhook Handler
 *
 * Receives blockchain event webhooks from Helius for mainnet.
 * Parses Anchor events from transaction logs and processes them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventProcessor } from '@/services/event-processor.service';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

const eventProcessor = new EventProcessor();


export async function POST(req: NextRequest) {

  // Get raw body for signature verification
  const rawBody = await req.text();

  // Verify webhook authentication
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error('❌ Invalid webhook authentication');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('⚠️  HELIUS_WEBHOOK_SECRET not set - authentication disabled');
  }

  try {
    const payload = JSON.parse(rawBody);
    const events = Array.isArray(payload) ? payload : [payload];


    // Get program ID from environment
    const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;
    if (!programId) {
      throw new Error('NEXT_PUBLIC_VERITAS_PROGRAM_ID not set');
    }

    // Create event parser
    const eventParser = new EventParser(
      new PublicKey(programId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new BorshCoder(idl as any)
    );

    for (const heliusEvent of events) {
      const signature = heliusEvent.signature;
      const blockTime = heliusEvent.blockTime;
      const slot = heliusEvent.slot;


      // Parse Anchor events from transaction logs
      const logMessages = heliusEvent.meta?.logMessages || heliusEvent.logs || [];
      const anchorEvents = Array.from(eventParser.parseLogs(logMessages));

      if (anchorEvents.length === 0) {
        continue;
      }


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
              break;

            case 'PoolClosedEvent':
              break;

            default:
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

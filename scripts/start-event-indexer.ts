#!/usr/bin/env tsx
/**
 * Start Event Indexer
 *
 * Standalone script to run the WebSocket event indexer for local/devnet development.
 * This must run separately from the Next.js app due to bundling limitations.
 *
 * Usage:
 *   npx tsx scripts/start-event-indexer.ts
 *   or
 *   npm run indexer
 */

import { startEventIndexer } from '../src/lib/event-indexer.server';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 VERITAS EVENT INDEXER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Check environment
  const network = process.env.SOLANA_NETWORK || 'localnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
  const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;

  console.log('Configuration:');
  console.log(`  Network: ${network}`);
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  Program ID: ${programId || 'NOT SET'}`);
  console.log('');

  // Prevent running on mainnet - use Helius webhooks instead
  if (network === 'mainnet-beta') {
    console.error('❌ WebSocket indexer cannot run on mainnet');
    console.error('');
    console.error('   For mainnet, use Helius webhooks instead.');
    console.error('   See: docs/HELIUS_WEBHOOK_FLOW.md');
    console.error('');
    console.error('   Webhook endpoint: /api/webhooks/helius');
    console.error('');
    process.exit(1);
  }

  if (!programId) {
    console.error('❌ Missing NEXT_PUBLIC_VERITAS_PROGRAM_ID environment variable');
    console.error('   Make sure .env.local is properly configured');
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Starting event indexer...');
  console.log('');

  try {
    const indexer = await startEventIndexer();

    if (!indexer) {
      console.error('❌ Failed to start indexer');
      process.exit(1);
    }

    console.log('');
    console.log('✅ Event indexer is running');
    console.log('   Listening for blockchain events...');
    console.log('   Press Ctrl+C to stop');
    console.log('');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('');
      console.log('🛑 Shutting down event indexer...');
      await indexer.stop();
      console.log('✅ Indexer stopped');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('');
      console.log('🛑 Shutting down event indexer...');
      await indexer.stop();
      console.log('✅ Indexer stopped');
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error starting indexer:', error);
    process.exit(1);
  }
}

main();

/**
 * Next.js Instrumentation
 * Runs once when the server starts
 *
 * This is the proper place to initialize server-side services like event indexers
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startEventIndexer } = await import('@/lib/event-indexer');

    // Start event indexer for local/devnet
    const network = process.env.SOLANA_NETWORK || 'localnet';

    if (network !== 'mainnet-beta') {
      console.log('🔧 [Instrumentation] Initializing event indexer...');

      try {
        await startEventIndexer();
        console.log('✅ [Instrumentation] Event indexer started successfully');
      } catch (error) {
        console.error('❌ [Instrumentation] Failed to start event indexer:', error);
      }
    } else {
      console.log('📡 [Instrumentation] Mainnet mode - event indexer will use Helius webhooks');
    }
  }
}

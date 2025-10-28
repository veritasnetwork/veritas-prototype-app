/**
 * Next.js Instrumentation
 * Runs once when the server starts
 */

export async function register() {

  // Only run event indexer setup on Node.js server
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Skip WebSocket indexer on Vercel - use webhooks instead
  if (process.env.VERCEL === '1') {
    return;
  }

}

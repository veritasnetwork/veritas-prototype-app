/**
 * Protocol Authority Loader
 *
 * Loads the protocol authority keypair from environment variable.
 * This keypair is used to sign transactions server-side.
 */

import { Keypair } from '@solana/web3.js';

/**
 * Load protocol authority keypair from base64-encoded environment variable
 *
 * The keypair is stored as a base64-encoded JSON array in PROTOCOL_AUTHORITY_KEYPAIR.
 *
 * @returns Protocol authority keypair
 * @throws Error if env var not set or invalid format
 */
export function loadProtocolAuthority(): Keypair {
  const keypairBase64 = process.env.PROTOCOL_AUTHORITY_KEYPAIR;

  if (!keypairBase64) {
    throw new Error(
      'PROTOCOL_AUTHORITY_KEYPAIR environment variable not set.\n\n' +
      'For local development:\n' +
      '  1. Ensure you have an authority keypair at solana/veritas-curation/keys/authority.json\n' +
      '  2. Run: ./scripts/export-authority-to-env.sh\n' +
      '  3. Add the output to your .env.local file\n\n' +
      'For production:\n' +
      '  1. Generate a production keypair: solana-keygen new --outfile prod-auth.json\n' +
      '  2. Encode to base64: cat prod-auth.json | base64 | tr -d \'\\n\'\n' +
      '  3. Set PROTOCOL_AUTHORITY_KEYPAIR in Vercel environment variables'
    );
  }

  try {
    // Decode base64 to get JSON string
    const keypairBytes = Buffer.from(keypairBase64, 'base64');
    const keypairJson = keypairBytes.toString('utf-8');

    // Parse JSON array
    const keypairArray = JSON.parse(keypairJson);

    // Validate it's an array of the right length
    if (!Array.isArray(keypairArray) || keypairArray.length !== 64) {
      throw new Error('Keypair must be a JSON array of 64 bytes');
    }

    // Create keypair from secret key
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairArray));

    // Verify the keypair was created successfully
    if (!keypair || !keypair.publicKey) {
      console.error('[loadProtocolAuthority] Keypair creation failed - got:', typeof keypair, keypair);
      throw new Error('Keypair.fromSecretKey returned invalid object');
    }

    return keypair;
  } catch (error) {
    console.error('[loadProtocolAuthority] Error details:', error);
    throw new Error(
      `Failed to load protocol authority keypair: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
      'The PROTOCOL_AUTHORITY_KEYPAIR must be a base64-encoded JSON array of 64 bytes.\n' +
      'Example format: WzU4LDE0MCwyMjgsMzMs...'
    );
  }
}

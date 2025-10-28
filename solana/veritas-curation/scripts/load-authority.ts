/**
 * Protocol Authority Loader for Solana Scripts
 *
 * Loads the protocol authority keypair from PROTOCOL_AUTHORITY_KEYPAIR environment variable.
 * This is the single source of truth for the protocol authority.
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
      'To set it:\n' +
      '  1. Generate a keypair: solana-keygen new --outfile authority.json --no-bip39-passphrase\n' +
      '  2. Encode to base64: cat authority.json | base64\n' +
      '  3. Add to .env.local: PROTOCOL_AUTHORITY_KEYPAIR=<base64-output>\n' +
      '  4. Run this script with: source .env.local && npx ts-node scripts/<script-name>.ts'
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

    console.log('✅ Loaded protocol authority from environment');
    console.log('   Public key:', keypair.publicKey.toBase58());

    return keypair;
  } catch (error) {
    throw new Error(
      `Failed to load protocol authority keypair: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
      'The PROTOCOL_AUTHORITY_KEYPAIR must be a base64-encoded JSON array of 64 bytes.'
    );
  }
}
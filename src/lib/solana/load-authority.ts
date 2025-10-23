/**
 * Protocol Authority Loader
 *
 * Loads the protocol authority keypair from the filesystem.
 * This keypair is used to sign transactions server-side.
 */

import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

/**
 * Load protocol authority keypair from file
 *
 * The key path is specified in the PROTOCOL_AUTHORITY_KEY_PATH environment variable.
 *
 * @returns Protocol authority keypair
 * @throws Error if key path not set or file not found
 */
export function loadProtocolAuthority(): Keypair {
  const keyPath = process.env.PROTOCOL_AUTHORITY_KEY_PATH;

  if (!keyPath) {
    throw new Error('PROTOCOL_AUTHORITY_KEY_PATH not set in environment');
  }

  const fullPath = path.resolve(keyPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Protocol authority key file not found: ${fullPath}`);
  }

  const keyData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  return Keypair.fromSecretKey(Uint8Array.from(keyData));
}

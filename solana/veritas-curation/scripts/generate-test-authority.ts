/**
 * Generate Test Authority Keypair
 *
 * This script generates the same deterministic keypair used by the tests
 * and saves it so it can be used for local deployment.
 */

import { Keypair } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function deterministicKeypair(seed: string): Keypair {
  const hash = crypto.createHash('sha256').update(seed).digest();
  return Keypair.fromSeed(hash);
}

// Generate the same keypair that tests use
const TEST_POOL_AUTHORITY = deterministicKeypair("test-pool-authority-v1");

console.log('🔑 Generated Test Authority Keypair:');
console.log('   Public Key:', TEST_POOL_AUTHORITY.publicKey.toBase58());

// Save to keys directory
const keysDir = path.join(__dirname, '../keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const keypairPath = path.join(keysDir, 'authority.json');
fs.writeFileSync(
  keypairPath,
  JSON.stringify(Array.from(TEST_POOL_AUTHORITY.secretKey))
);

console.log('   Saved to:', keypairPath);

// Also print base64 for env var
const base64 = Buffer.from(JSON.stringify(Array.from(TEST_POOL_AUTHORITY.secretKey))).toString('base64');
console.log('\n📋 To use in .env.local:');
console.log(`PROTOCOL_AUTHORITY_KEYPAIR=${base64}`);
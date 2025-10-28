/**
 * Server-only Event Indexer Initialization
 *
 * IMPORTANT:
 * - This file MUST only be imported in server-side code
 * - WebSocket indexer is for LOCAL/DEVNET only
 * - For MAINNET, use Helius webhooks instead (see docs/HELIUS_WEBHOOK_FLOW.md)
 *
 * Usage:
 *   npm run indexer    (runs scripts/start-event-indexer.ts)
 */

import 'server-only';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { WebSocketIndexer } from '@/services/websocket-indexer.service';
import idl from '@/lib/solana/target/idl/veritas_curation.json';
import fs from 'fs';
import path from 'path';

/**
 * Simple Node-only wallet implementation for server-side operations.
 * Matches the Wallet interface expected by Anchor.
 */
class NodeWallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map(tx => this.signTransaction(tx)));
  }

  get publicKey() {
    return this.payer.publicKey;
  }
}

/**
 * Global singleton indexer instance
 */
let indexer: WebSocketIndexer | null = null;

/**
 * Start the event indexer for local/devnet development
 * Uses WebSocket connection to monitor blockchain events
 */
export async function startEventIndexer(): Promise<WebSocketIndexer | null> {

  // Get environment variables
  const network = process.env.SOLANA_NETWORK || 'localnet';
  const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;
  const rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';

  // Safety check: prevent running on mainnet
  if (network === 'mainnet-beta') {
    console.error('❌ [EventIndexer] WebSocket indexer is not supported on mainnet');
    console.error('   Use Helius webhooks instead: /api/webhooks/helius');
    return null;
  }

  if (!programId) {
    console.error('❌ [EventIndexer] Missing NEXT_PUBLIC_VERITAS_PROGRAM_ID');
    return null;
  }


  // WebSocket endpoint: for solana-test-validator, WS port is RPC port + 1
  // e.g., RPC on 8899 → WS on 8900
  const wsUrl = rpcUrl.replace('http://', 'ws://').replace(':8899', ':8900');

  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: wsUrl,
  });

  // Load program authority keypair (for provider, not used for signing)
  const authorityKeypair = loadAuthorityKeypair();
  const wallet = new NodeWallet(authorityKeypair);

  // Create Anchor provider and program
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  const program = new Program(idl as any, provider);


  // Create and start WebSocket indexer
  indexer = new WebSocketIndexer(connection, program);
  await indexer.start();


  return indexer;
}

/**
 * Stop the event indexer
 */
export async function stopEventIndexer(): Promise<void> {
  if (indexer) {
    await indexer.stop();
    indexer = null;
  }
}

/**
 * Get the current indexer instance
 */
export function getEventIndexer(): WebSocketIndexer | null {
  return indexer;
}

/**
 * Load protocol authority keypair from file
 * For local/devnet, this can be the default Solana keypair
 * For mainnet, this would be a dedicated authority key
 */
function loadAuthorityKeypair(): Keypair {
  const network = process.env.SOLANA_NETWORK || 'localnet';

  if (network === 'mainnet-beta') {
    // Mainnet would use a dedicated keypair
    const keypairPath = process.env.PROTOCOL_AUTHORITY_KEYPAIR_PATH;
    if (!keypairPath) {
      throw new Error('PROTOCOL_AUTHORITY_KEYPAIR_PATH required for mainnet');
    }

    const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  }

  // Local/devnet: use default Solana keypair
  const defaultKeypairPath = path.join(
    process.env.HOME || '',
    '.config',
    'solana',
    'id.json'
  );

  if (fs.existsSync(defaultKeypairPath)) {
    const secretKey = JSON.parse(fs.readFileSync(defaultKeypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  }

  // Fallback: generate ephemeral keypair (not ideal but allows testing)
  console.warn('⚠️  No keypair found, generating ephemeral keypair');
  return Keypair.generate();
}

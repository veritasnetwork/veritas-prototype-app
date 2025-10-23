/**
 * Event Indexer Initialization
 *
 * Environment-aware initialization:
 * - Local/Devnet: Starts WebSocket indexer
 * - Mainnet: Uses Helius webhooks (no WebSocket needed)
 */

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
    return txs.map(tx => {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer);
      }
      return tx;
    });
  }

  get publicKey() {
    return this.payer.publicKey;
  }
}

let indexer: WebSocketIndexer | null = null;

/**
 * Start the appropriate event indexer based on environment
 */
export async function startEventIndexer(): Promise<WebSocketIndexer | null> {
  const network = process.env.SOLANA_NETWORK || 'localnet';

  if (network === 'mainnet-beta') {
    console.log('📡 Mainnet detected - using Helius webhooks');
    console.log('   Webhook endpoint: /api/webhooks/helius');
    console.log('   Configure webhook at: https://dashboard.helius.dev');
    return null; // Mainnet uses webhooks, not WebSocket
  }

  if (network !== 'localnet' && network !== 'devnet') {
    throw new Error(`Invalid SOLANA_NETWORK: ${network}. Expected: localnet, devnet, or mainnet-beta`);
  }

  if (indexer?.isRunning()) {
    console.warn('⚠️  Event indexer already running');
    return indexer;
  }

  console.log(`🚀 Starting WebSocket event indexer for ${network}...`);

  // Get connection URL
  const rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
  console.log(`   RPC URL: ${rpcUrl}`);

  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: rpcUrl.replace('http', 'ws'), // Convert HTTP to WS
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

  console.log(`   Program ID: ${program.programId.toString()}`);

  // Create and start indexer
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

// Auto-start for local/devnet (server-side only)
if (typeof window === 'undefined') {
  // Only run on server
  const network = process.env.SOLANA_NETWORK || 'localnet';

  if (network !== 'mainnet-beta') {
    // Auto-start for local/devnet
    startEventIndexer().catch((error) => {
      console.error('❌ Failed to start event indexer:', error);
    });
  }
}

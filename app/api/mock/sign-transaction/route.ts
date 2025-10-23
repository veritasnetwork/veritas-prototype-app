import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mock Transaction Signing Endpoint
 * Only available when NEXT_PUBLIC_USE_MOCK_AUTH=true
 * Signs transactions with the mock wallet keypair
 */
export async function POST(request: NextRequest) {
  // Only allow in mock mode
  if (process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== 'true') {
    return NextResponse.json(
      { error: 'Mock mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const { serializedTransaction } = await request.json();

    if (!serializedTransaction) {
      return NextResponse.json(
        { error: 'Missing serialized transaction' },
        { status: 400 }
      );
    }

    // Load mock keypair from file
    const keypairPath = path.join(process.cwd(), '.mock-wallet.json');

    if (!fs.existsSync(keypairPath)) {
      return NextResponse.json(
        { error: 'Mock wallet not found. Run: solana-keygen new --no-bip39-passphrase --force --outfile .mock-wallet.json' },
        { status: 500 }
      );
    }

    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

    // Deserialize and sign transaction
    const buffer = Buffer.from(serializedTransaction, 'base64');

    try {
      // Try as regular transaction first
      const transaction = Transaction.from(buffer);
      transaction.partialSign(keypair);

      return NextResponse.json({
        signedTransaction: transaction.serialize().toString('base64'),
      });
    } catch (e) {
      // Try as versioned transaction
      const transaction = VersionedTransaction.deserialize(buffer);
      transaction.sign([keypair]);

      return NextResponse.json({
        signedTransaction: Buffer.from(transaction.serialize()).toString('base64'),
      });
    }
  } catch (error: any) {
    console.error('Mock signing error:', error);
    return NextResponse.json(
      { error: 'Failed to sign transaction', details: error.message },
      { status: 500 }
    );
  }
}

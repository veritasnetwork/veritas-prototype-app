/**
 * Protocol Deposit Execution API
 *
 * Receives user-signed deposit transactions and submits to Solana blockchain.
 *
 * IMPORTANT: Protocol deposits do NOT require protocol authority signature.
 * They are simple user→custodian USDC transfers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteDepositRequest {
  signedTransaction: string;  // Base64 encoded, user-signed transaction
  amount: number;             // USDC amount for logging (micro-USDC)
  walletAddress: string;      // User's wallet address
}

interface ExecuteDepositResponse {
  signature: string;
  confirmed: boolean;
  slot?: number;
}

export async function POST(req: NextRequest) {
  try {
    // Step 1: Authenticate user
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Parse request body
    const body: ExecuteDepositRequest = await req.json();
    const { signedTransaction, amount, walletAddress } = body;

    // Step 3: Validate required fields
    if (!signedTransaction || !amount || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: signedTransaction, amount, walletAddress' },
        { status: 400 }
      );
    }

    console.log('[EXECUTE DEPOSIT] Starting execution:', {
      amount,
      walletAddress,
      userId: privyUserId,
    });

    // Step 4: Deserialize user-signed transaction
    let transaction: Transaction;
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      transaction = Transaction.from(txBuffer);
    } catch (deserializeError) {
      console.error('[EXECUTE DEPOSIT] Failed to deserialize transaction:', deserializeError);
      return NextResponse.json(
        { error: 'Invalid transaction format' },
        { status: 400 }
      );
    }

    // Note: NO protocol authority signature needed for deposits
    // This is a direct user-to-custodian transfer

    // Step 5: Connect to Solana
    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Step 6: Submit transaction to Solana
    let signature: string;
    try {
      const serializedTransaction = transaction.serialize();
      signature = await connection.sendRawTransaction(serializedTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('[EXECUTE DEPOSIT] Transaction submitted:', signature);
    } catch (sendError: any) {
      console.error('[EXECUTE DEPOSIT] Failed to send transaction:', sendError);

      let errorMessage = 'Failed to submit deposit transaction';
      if (sendError.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient USDC balance for deposit';
      } else if (sendError.message?.includes('blockhash not found')) {
        errorMessage = 'Transaction expired. Please try again.';
      } else if (sendError.message) {
        errorMessage = sendError.message;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Step 7: Wait for confirmation
    let confirmed = false;
    let slot: number | undefined;
    try {
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      confirmed = !confirmation.value.err;
      slot = confirmation.context.slot;

      if (!confirmed) {
        console.error('[EXECUTE DEPOSIT] Transaction failed on-chain:', confirmation.value.err);
        return NextResponse.json(
          { error: 'Deposit transaction failed on-chain', signature },
          { status: 400 }
        );
      }

      console.log('[EXECUTE DEPOSIT] Transaction confirmed:', { signature, slot });
    } catch (confirmError) {
      console.error('[EXECUTE DEPOSIT] Failed to confirm transaction:', confirmError);
      return NextResponse.json(
        {
          signature,
          confirmed: false,
          warning: 'Transaction submitted but confirmation timed out. Check status manually.'
        },
        { status: 202 }
      );
    }

    // Step 8: Return success response
    const response: ExecuteDepositResponse = {
      signature,
      confirmed,
      slot,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[EXECUTE DEPOSIT] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

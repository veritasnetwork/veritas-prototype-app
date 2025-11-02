/**
 * Trade Execution API
 *
 * Receives user-signed transactions, adds protocol authority signature,
 * and submits to Solana blockchain.
 *
 * Flow:
 * 1. User signs transaction FIRST (fixes Phantom security warning)
 * 2. Backend adds protocol authority signature SECOND
 * 3. Backend submits to Solana
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteTradeRequest {
  signedTransaction: string;  // Base64 encoded, user-signed transaction
  postId: string;             // For logging/tracking
  tradeType: 'buy' | 'sell';  // Trade type for logging
  side: 'LONG' | 'SHORT';     // Token side for logging
}

interface ExecuteTradeResponse {
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
    const body: ExecuteTradeRequest = await req.json();
    const { signedTransaction, postId, tradeType, side } = body;

    // Step 3: Validate required fields
    if (!signedTransaction || !postId || !tradeType || !side) {
      return NextResponse.json(
        { error: 'Missing required fields: signedTransaction, postId, tradeType, side' },
        { status: 400 }
      );
    }

    console.log('[EXECUTE TRADE] Starting execution:', {
      postId,
      tradeType,
      side,
      userId: privyUserId,
    });

    // Step 4: Deserialize user-signed transaction
    let transaction: Transaction;
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      transaction = Transaction.from(txBuffer);
    } catch (deserializeError) {
      console.error('[EXECUTE TRADE] Failed to deserialize transaction:', deserializeError);
      return NextResponse.json(
        { error: 'Invalid transaction format' },
        { status: 400 }
      );
    }

    // Step 5: Load protocol authority keypair
    let protocolAuthority;
    try {
      protocolAuthority = loadProtocolAuthority();
    } catch (loadError) {
      console.error('[EXECUTE TRADE] Failed to load protocol authority:', loadError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Step 6: Add protocol authority signature (user already signed)
    try {
      transaction.partialSign(protocolAuthority);
      console.log('[EXECUTE TRADE] Protocol authority signed transaction');
    } catch (signError) {
      console.error('[EXECUTE TRADE] Failed to sign with protocol authority:', signError);
      return NextResponse.json(
        { error: 'Failed to add protocol signature' },
        { status: 500 }
      );
    }

    // Step 7: Connect to Solana
    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Step 8: Submit transaction to Solana
    let signature: string;
    try {
      const serializedTransaction = transaction.serialize();
      signature = await connection.sendRawTransaction(serializedTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('[EXECUTE TRADE] Transaction submitted:', signature);
    } catch (sendError: any) {
      console.error('[EXECUTE TRADE] Failed to send transaction:', sendError);

      // Parse Solana error messages
      let errorMessage = 'Failed to submit transaction';
      if (sendError.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees';
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

    // Step 9: Wait for confirmation
    let confirmed = false;
    let slot: number | undefined;
    try {
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      confirmed = !confirmation.value.err;
      slot = confirmation.context.slot;

      if (!confirmed) {
        console.error('[EXECUTE TRADE] Transaction failed on-chain:', confirmation.value.err);
        return NextResponse.json(
          { error: 'Transaction failed on-chain', signature },
          { status: 400 }
        );
      }

      console.log('[EXECUTE TRADE] Transaction confirmed:', { signature, slot });
    } catch (confirmError) {
      console.error('[EXECUTE TRADE] Failed to confirm transaction:', confirmError);
      // Transaction may have been submitted but confirmation timed out
      // Return signature so client can check status
      return NextResponse.json(
        {
          signature,
          confirmed: false,
          warning: 'Transaction submitted but confirmation timed out. Check status manually.'
        },
        { status: 202 }
      );
    }

    // Step 10: Return success response
    const response: ExecuteTradeResponse = {
      signature,
      confirmed,
      slot,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[EXECUTE TRADE] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

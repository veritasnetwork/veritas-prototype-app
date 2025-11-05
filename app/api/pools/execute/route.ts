/**
 * Pool Deployment Execution API
 *
 * Receives user-signed pool deployment transactions and submits to Solana blockchain.
 * Unlike trades, pool deployment (create_pool + deploy_market) doesn't require protocol authority signature.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecutePoolRequest {
  signedTransaction: string;  // Base64 encoded, user-signed transaction
  postId: string;             // For logging/tracking
  isOrphaned: boolean;        // Whether this is an orphaned pool deployment
}

interface ExecutePoolResponse {
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
    const body: ExecutePoolRequest = await req.json();
    const { signedTransaction, postId, isOrphaned } = body;

    // Step 3: Validate required fields
    if (!signedTransaction || !postId || isOrphaned === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: signedTransaction, postId, isOrphaned' },
        { status: 400 }
      );
    }

    console.log('[EXECUTE POOL] Starting execution:', {
      postId,
      isOrphaned,
      userId: privyUserId,
    });

    // Step 4: Deserialize user-signed transaction
    let transaction: Transaction;
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      transaction = Transaction.from(txBuffer);
    } catch (deserializeError) {
      console.error('[EXECUTE POOL] Failed to deserialize transaction:', deserializeError);
      return NextResponse.json(
        { error: 'Invalid transaction format' },
        { status: 400 }
      );
    }

    // Step 5: Connect to Solana (no protocol authority signature needed for pool deployment)
    // Unlike trades, create_pool and deploy_market don't require protocol authority as signer
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
      console.log('[EXECUTE POOL] Transaction submitted:', signature);
    } catch (sendError: any) {
      console.error('[EXECUTE POOL] Failed to send transaction:', sendError);

      let errorMessage = 'Failed to submit pool deployment transaction';
      if (sendError.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL or USDC for pool deployment';
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
        console.error('[EXECUTE POOL] Transaction failed on-chain:', confirmation.value.err);
        return NextResponse.json(
          { error: 'Pool deployment transaction failed on-chain', signature },
          { status: 400 }
        );
      }

      console.log('[EXECUTE POOL] Transaction confirmed:', { signature, slot });
    } catch (confirmError) {
      console.error('[EXECUTE POOL] Failed to confirm transaction:', confirmError);
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
    const response: ExecutePoolResponse = {
      signature,
      confirmed,
      slot,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[EXECUTE POOL] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

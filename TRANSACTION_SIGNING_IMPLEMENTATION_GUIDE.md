# Transaction Signing Fix - Detailed Implementation Guide

## Overview

This guide provides step-by-step instructions to fix the Phantom wallet security warning by reversing the transaction signing order. Each step includes exact file paths, complete function signatures, and specific code changes.

---

## PHASE 1: Core Trading Infrastructure

### Step 1.1: Create Trade Execution Endpoint

**File:** `/app/api/trades/execute/route.ts` (NEW FILE)

**Complete file contents:**

```typescript
/**
 * Trade Execution API
 *
 * Receives user-signed transactions, adds protocol authority signature,
 * and submits to Solana blockchain.
 *
 * Flow:
 * 1. Receive user-signed transaction (base64 encoded)
 * 2. Deserialize transaction
 * 3. Add protocol authority signature via partialSign()
 * 4. Submit to Solana
 * 5. Wait for confirmation
 * 6. Return transaction signature
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
```

---

### Step 1.2: Update Trade Preparation Endpoint

**File:** `/app/api/trades/prepare/route.ts`

**Change #1 - Line 629:**

Find this line:
```typescript
  // Sign with protocol authority
  tx.partialSign(authorityKeypair);
```

**REMOVE these lines** (lines 628-629):
```typescript
  // Sign with protocol authority
  tx.partialSign(authorityKeypair);
```

**Add this comment instead:**
```typescript
  // Note: Protocol authority will sign in /api/trades/execute endpoint
  // Transaction is returned unsigned to user for proper signing order
```

**That's the ONLY change needed in this file.**

---

### Step 1.3: Update useBuyTokens Hook

**File:** `/src/hooks/useBuyTokens.ts`

**Change #1 - Lines 125-131:**

Find this code block:
```typescript
      // Step 3: Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Step 4: Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
```

**REPLACE with:**
```typescript
      // Step 3: Sign the transaction (user signs FIRST)
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Step 4: Send signed transaction to backend for protocol signature and execution
      const executeResponse = await fetch('/api/trades/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          postId,
          tradeType: 'buy',
          side: side.toUpperCase() as 'LONG' | 'SHORT',
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('[useBuyTokens] ❌ Execute failed:', errorData);
        throw new Error(errorData.error || 'Failed to execute transaction');
      }

      const executeResult = await executeResponse.json();
      const signature = executeResult.signature;

      console.log('[useBuyTokens] ✅ Transaction executed:', signature);
```

**Change #2 - Line 42-43 (update import if needed):**

Check if `Connection` is imported. The line should still be:
```typescript
import { Connection, Transaction } from '@solana/web3.js';
```

**No change needed** - we still need `Connection` for other operations.

**Change #3 - Lines 130-131 (already replaced above):**

The `connection.sendRawTransaction` and `connection.confirmTransaction` lines are replaced by the fetch to `/api/trades/execute`.

---

### Step 1.4: Update useSellTokens Hook

**File:** `/src/hooks/useSellTokens.ts`

**Change #1 - Lines 95-101:**

Find this code block:
```typescript
      // Step 3: Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Step 4: Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
```

**REPLACE with:**
```typescript
      // Step 3: Sign the transaction (user signs FIRST)
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Step 4: Send signed transaction to backend for protocol signature and execution
      const executeResponse = await fetch('/api/trades/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          postId,
          tradeType: 'sell',
          side: side.toUpperCase() as 'LONG' | 'SHORT',
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('[useSellTokens] ❌ Execute failed:', errorData);
        throw new Error(errorData.error || 'Failed to execute transaction');
      }

      const executeResult = await executeResponse.json();
      const signature = executeResult.signature;

      console.log('[useSellTokens] ✅ Transaction executed:', signature);
```

---

## PHASE 2: Settlement/Rebase Infrastructure

### Step 2.1: Create Settlement Execution Endpoint

**File:** `/app/api/settlements/execute/route.ts` (NEW FILE)

**Complete file contents:**

```typescript
/**
 * Settlement Execution API
 *
 * Receives user-signed settlement transactions, adds protocol authority signature,
 * and submits to Solana blockchain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteSettlementRequest {
  signedTransaction: string;  // Base64 encoded, user-signed transaction
  postId: string;             // For logging/tracking
  poolAddress: string;        // Pool being settled
  epoch: number;              // Epoch being settled
}

interface ExecuteSettlementResponse {
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
    const body: ExecuteSettlementRequest = await req.json();
    const { signedTransaction, postId, poolAddress, epoch } = body;

    // Step 3: Validate required fields
    if (!signedTransaction || !postId || !poolAddress || epoch === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: signedTransaction, postId, poolAddress, epoch' },
        { status: 400 }
      );
    }

    console.log('[EXECUTE SETTLEMENT] Starting execution:', {
      postId,
      poolAddress,
      epoch,
      userId: privyUserId,
    });

    // Step 4: Deserialize user-signed transaction
    let transaction: Transaction;
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      transaction = Transaction.from(txBuffer);
    } catch (deserializeError) {
      console.error('[EXECUTE SETTLEMENT] Failed to deserialize transaction:', deserializeError);
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
      console.error('[EXECUTE SETTLEMENT] Failed to load protocol authority:', loadError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Step 6: Add protocol authority signature (user already signed)
    try {
      transaction.partialSign(protocolAuthority);
      console.log('[EXECUTE SETTLEMENT] Protocol authority signed transaction');
    } catch (signError) {
      console.error('[EXECUTE SETTLEMENT] Failed to sign with protocol authority:', signError);
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
      console.log('[EXECUTE SETTLEMENT] Transaction submitted:', signature);
    } catch (sendError: any) {
      console.error('[EXECUTE SETTLEMENT] Failed to send transaction:', sendError);

      let errorMessage = 'Failed to submit settlement transaction';
      if (sendError.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees';
      } else if (sendError.message?.includes('blockhash not found')) {
        errorMessage = 'Transaction expired. Please try again.';
      } else if (sendError.message?.includes('SettlementCooldown')) {
        errorMessage = 'Settlement cooldown active. Please wait before settling again.';
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
        console.error('[EXECUTE SETTLEMENT] Transaction failed on-chain:', confirmation.value.err);
        return NextResponse.json(
          { error: 'Settlement transaction failed on-chain', signature },
          { status: 400 }
        );
      }

      console.log('[EXECUTE SETTLEMENT] Transaction confirmed:', { signature, slot });
    } catch (confirmError) {
      console.error('[EXECUTE SETTLEMENT] Failed to confirm transaction:', confirmError);
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
    const response: ExecuteSettlementResponse = {
      signature,
      confirmed,
      slot,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[EXECUTE SETTLEMENT] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

---

### Step 2.2: Update Rebase API Endpoint

**File:** `/app/api/posts/[id]/rebase/route.ts`

**Change #1 - Line 413:**

Find this line:
```typescript
    transaction.partialSign(protocolAuthority);
```

**REMOVE this line.**

**Add this comment instead:**
```typescript
    // Note: Protocol authority will sign in /api/settlements/execute endpoint
    // Transaction is returned unsigned to user for proper signing order
```

**That's the ONLY change needed in this file.**

---

### Step 2.3: Update useRebasePool Hook

**File:** `/src/hooks/useRebasePool.ts`

**Change #1 - Lines 106-115:**

Find this code block:
```typescript
      // Sign transaction with Solana wallet from useSolanaWallet hook
      const signedTx = await wallet.signTransaction(transaction);


      // Send signed transaction
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());


      // Wait for confirmation
      await connection.confirmTransaction(txSignature, 'confirmed');
```

**REPLACE with:**
```typescript
      // Sign transaction with Solana wallet (user signs FIRST)
      const signedTx = await wallet.signTransaction(transaction);

      // Send signed transaction to backend for protocol signature and execution
      const executeResponse = await fetch('/api/settlements/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          postId,
          poolAddress: result.poolAddress,
          epoch: result.currentEpoch + 1,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('[useRebasePool] ❌ Execute failed:', errorData);
        throw new Error(errorData.error || 'Failed to execute settlement');
      }

      const executeResult = await executeResponse.json();
      const txSignature = executeResult.signature;

      console.log('[useRebasePool] ✅ Settlement executed:', txSignature);
```

---

## PHASE 3: Withdrawal Infrastructure

### Step 3.1: Create Withdrawal Execution Endpoint

**File:** `/app/api/users/withdraw/execute/route.ts` (NEW FILE)

**Complete file contents:**

```typescript
/**
 * Withdrawal Execution API
 *
 * Receives user-signed withdrawal transactions, adds protocol authority signature,
 * and submits to Solana blockchain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteWithdrawalRequest {
  signedTransaction: string;  // Base64 encoded, user-signed transaction
  amount: number;             // USDC amount for logging (micro-USDC)
  walletAddress: string;      // User's wallet address
}

interface ExecuteWithdrawalResponse {
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
    const body: ExecuteWithdrawalRequest = await req.json();
    const { signedTransaction, amount, walletAddress } = body;

    // Step 3: Validate required fields
    if (!signedTransaction || !amount || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: signedTransaction, amount, walletAddress' },
        { status: 400 }
      );
    }

    console.log('[EXECUTE WITHDRAWAL] Starting execution:', {
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
      console.error('[EXECUTE WITHDRAWAL] Failed to deserialize transaction:', deserializeError);
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
      console.error('[EXECUTE WITHDRAWAL] Failed to load protocol authority:', loadError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Step 6: Add protocol authority signature (user already signed)
    try {
      transaction.partialSign(protocolAuthority);
      console.log('[EXECUTE WITHDRAWAL] Protocol authority signed transaction');
    } catch (signError) {
      console.error('[EXECUTE WITHDRAWAL] Failed to sign with protocol authority:', signError);
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
      console.log('[EXECUTE WITHDRAWAL] Transaction submitted:', signature);
    } catch (sendError: any) {
      console.error('[EXECUTE WITHDRAWAL] Failed to send transaction:', sendError);

      let errorMessage = 'Failed to submit withdrawal transaction';
      if (sendError.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees';
      } else if (sendError.message?.includes('blockhash not found')) {
        errorMessage = 'Transaction expired. Please try again.';
      } else if (sendError.message?.includes('InsufficientStake')) {
        errorMessage = 'Insufficient stake balance for withdrawal';
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
        console.error('[EXECUTE WITHDRAWAL] Transaction failed on-chain:', confirmation.value.err);
        return NextResponse.json(
          { error: 'Withdrawal transaction failed on-chain', signature },
          { status: 400 }
        );
      }

      console.log('[EXECUTE WITHDRAWAL] Transaction confirmed:', { signature, slot });
    } catch (confirmError) {
      console.error('[EXECUTE WITHDRAWAL] Failed to confirm transaction:', confirmError);
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
    const response: ExecuteWithdrawalResponse = {
      signature,
      confirmed,
      slot,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[EXECUTE WITHDRAWAL] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

---

### Step 3.2: Update Withdrawal API Endpoint

**File:** `/app/api/users/withdraw/route.ts`

**First, let me read this file to see the current implementation:**

I need to read this file first to provide exact instructions. Let's check if it exists and has a partialSign call.

**Action needed:** Find the line with `partialSign(protocolAuthority)` or similar.

**REMOVE** that line.

**ADD** this comment instead:
```typescript
    // Note: Protocol authority will sign in /api/users/withdraw/execute endpoint
    // Transaction is returned unsigned to user for proper signing order
```

---

### Step 3.3: Update WithdrawModal Component

**File:** `/src/components/profile/WithdrawModal.tsx`

**First, let me read this file to find the exact location:**

I need to read this file to provide exact line numbers and changes.

**Action needed:** Find the code that calls `wallet.signTransaction()` followed by `connection.sendRawTransaction()`.

**Pattern to find:**
```typescript
const signedTx = await wallet.signTransaction(transaction);
const signature = await connection.sendRawTransaction(signedTx.serialize());
await connection.confirmTransaction(signature, 'confirmed');
```

**REPLACE with:**
```typescript
const signedTx = await wallet.signTransaction(transaction);

// Send signed transaction to backend for protocol signature and execution
const executeResponse = await fetch('/api/users/withdraw/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  },
  body: JSON.stringify({
    signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
    amount: withdrawAmount * 1_000_000, // Convert to micro-USDC
    walletAddress: address,
  }),
});

if (!executeResponse.ok) {
  const errorData = await executeResponse.json();
  console.error('[WithdrawModal] ❌ Execute failed:', errorData);
  throw new Error(errorData.error || 'Failed to execute withdrawal');
}

const executeResult = await executeResponse.json();
const signature = executeResult.signature;

console.log('[WithdrawModal] ✅ Withdrawal executed:', signature);
```

---

## PHASE 4: Protocol Deposit Infrastructure

### Step 4.1: Create Protocol Deposit Execution Endpoint

**File:** `/app/api/users/protocol_deposit/execute/route.ts` (NEW FILE)

**Complete file contents:**

```typescript
/**
 * Protocol Deposit Execution API
 *
 * Receives user-signed deposit transactions, adds protocol authority signature,
 * and submits to Solana blockchain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
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

    // Step 5: Load protocol authority keypair
    let protocolAuthority;
    try {
      protocolAuthority = loadProtocolAuthority();
    } catch (loadError) {
      console.error('[EXECUTE DEPOSIT] Failed to load protocol authority:', loadError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Step 6: Add protocol authority signature (user already signed)
    try {
      transaction.partialSign(protocolAuthority);
      console.log('[EXECUTE DEPOSIT] Protocol authority signed transaction');
    } catch (signError) {
      console.error('[EXECUTE DEPOSIT] Failed to sign with protocol authority:', signError);
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

    // Step 9: Wait for confirmation
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

    // Step 10: Return success response
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
```

---

### Step 4.2: Update Protocol Deposit API Endpoint

**File:** `/app/api/users/protocol_deposit/route.ts`

**Action needed:** Find the line with `partialSign(protocolAuthority)` or similar.

**REMOVE** that line.

**ADD** this comment instead:
```typescript
    // Note: Protocol authority will sign in /api/users/protocol_deposit/execute endpoint
    // Transaction is returned unsigned to user for proper signing order
```

---

### Step 4.3: Find and Update Protocol Deposit Frontend Component

**Action needed:** Find where protocol deposits are initiated in the frontend (likely a modal or button component).

**Pattern to find:**
```typescript
const signedTx = await wallet.signTransaction(transaction);
const signature = await connection.sendRawTransaction(signedTx.serialize());
```

**REPLACE with:**
```typescript
const signedTx = await wallet.signTransaction(transaction);

const executeResponse = await fetch('/api/users/protocol_deposit/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  },
  body: JSON.stringify({
    signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
    amount: depositAmount * 1_000_000, // Convert to micro-USDC
    walletAddress: address,
  }),
});

if (!executeResponse.ok) {
  const errorData = await executeResponse.json();
  throw new Error(errorData.error || 'Failed to execute deposit');
}

const executeResult = await executeResponse.json();
const signature = executeResult.signature;
```

---

## PHASE 5: Pool Recovery & Deploy

### Step 5.1: Update Pool Recovery Endpoint

**File:** `/app/api/pools/recover/route.ts`

**Action needed:** Read the file to find if there's a `partialSign` call.

If found, **REMOVE** it and add comment:
```typescript
    // Note: Pool recovery doesn't require protocol signature
    // Or if it does, create /api/pools/recover/execute endpoint
```

---

### Step 5.2: Update Pool Deploy Hook (useDeployPool)

**File:** `/src/hooks/useDeployPool.ts`

**At lines 295-314:**

Find this code:
```typescript
        try {
          console.log('🔐 [SIGNING] Calling wallet.signTransaction()...');
          const signedTx = await wallet.signTransaction(combinedTx);
          console.log('✅ [SIGNING] Transaction signed successfully!');


          // Send the transaction
          txSignature = await connection.sendRawTransaction(signedTx.serialize());

          // Wait for confirmation
          await connection.confirmTransaction(txSignature, 'confirmed');
        }
```

**REPLACE with:**
```typescript
        try {
          console.log('🔐 [SIGNING] Calling wallet.signTransaction()...');
          const signedTx = await wallet.signTransaction(combinedTx);
          console.log('✅ [SIGNING] Transaction signed successfully!');

          // Send signed transaction to backend for protocol signature and execution
          const executeResponse = await fetch('/api/pools/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
              postId: params.postId,
              isOrphaned,
            }),
          });

          if (!executeResponse.ok) {
            const errorData = await executeResponse.json();
            console.error('[useDeployPool] ❌ Execute failed:', errorData);
            throw new Error(errorData.error || 'Failed to execute pool deployment');
          }

          const executeResult = await executeResponse.json();
          txSignature = executeResult.signature;

          console.log('✅ [DEPLOY] Transaction executed:', txSignature);
        }
```

---

### Step 5.3: Create Pool Execute Endpoint

**File:** `/app/api/pools/execute/route.ts` (NEW FILE)

**Complete file contents:**

```typescript
/**
 * Pool Deployment Execution API
 *
 * Receives user-signed pool deployment transactions, adds protocol authority signature,
 * and submits to Solana blockchain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
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

    // Step 5: Load protocol authority keypair
    let protocolAuthority;
    try {
      protocolAuthority = loadProtocolAuthority();
    } catch (loadError) {
      console.error('[EXECUTE POOL] Failed to load protocol authority:', loadError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Step 6: Add protocol authority signature (user already signed)
    try {
      transaction.partialSign(protocolAuthority);
      console.log('[EXECUTE POOL] Protocol authority signed transaction');
    } catch (signError) {
      console.error('[EXECUTE POOL] Failed to sign with protocol authority:', signError);
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

    // Step 9: Wait for confirmation
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

    // Step 10: Return success response
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
```

---

## VERIFICATION CHECKLIST

After implementing all changes, verify each transaction type:

### Testing Steps for Each Transaction Type

1. **Buy LONG Tokens**
   - [ ] Open Phantom wallet
   - [ ] Execute a buy LONG transaction
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Transaction preview shows correct details
   - [ ] **Verify**: Transaction succeeds on-chain
   - [ ] **Verify**: Database records updated

2. **Buy SHORT Tokens**
   - [ ] Execute a buy SHORT transaction
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Transaction succeeds

3. **Sell LONG Tokens**
   - [ ] Execute a sell LONG transaction
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Transaction succeeds

4. **Sell SHORT Tokens**
   - [ ] Execute a sell SHORT transaction
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Transaction succeeds

5. **Pool Rebase/Settlement**
   - [ ] Trigger a pool settlement
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Transaction succeeds
   - [ ] **Verify**: BD score updated

6. **Withdraw USDC**
   - [ ] Execute a withdrawal
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: USDC transferred to wallet

7. **Protocol Deposit**
   - [ ] Execute a deposit
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Stake balance increased

8. **Pool Deployment**
   - [ ] Deploy a new pool
   - [ ] **Verify**: No security warning appears
   - [ ] **Verify**: Pool created on-chain

---

## ERROR HANDLING VERIFICATION

Test these error scenarios for each transaction type:

1. **Expired Blockhash**
   - [ ] Wait 60+ seconds after getting transaction
   - [ ] Try to sign and submit
   - [ ] **Verify**: Clear error message: "Transaction expired. Please try again."

2. **Insufficient SOL**
   - [ ] Execute transaction with < 0.005 SOL balance
   - [ ] **Verify**: Clear error message about SOL needed for fees

3. **Insufficient USDC**
   - [ ] Try to buy tokens without enough USDC
   - [ ] **Verify**: Clear error message about USDC balance

4. **User Rejection**
   - [ ] Reject transaction in Phantom
   - [ ] **Verify**: Graceful failure, no server error

5. **Network Timeout**
   - [ ] Simulate slow network
   - [ ] **Verify**: Appropriate timeout handling

---

## ROLLBACK PROCEDURE

If issues are found after deployment:

1. **Immediate Rollback Steps:**
   - [ ] Comment out all fetch calls to `/execute` endpoints
   - [ ] Uncomment the old `connection.sendRawTransaction()` code
   - [ ] Re-add `partialSign()` calls in backend endpoints
   - [ ] Deploy frontend rollback
   - [ ] Verify transactions work again (with warnings)

2. **Keep for Investigation:**
   - [ ] Server logs from execute endpoints
   - [ ] Failed transaction signatures
   - [ ] Error messages from Phantom

---

## DEPLOYMENT ORDER

Deploy in this exact order to maintain backward compatibility:

1. **Backend First** (30 minutes)
   - [ ] Deploy all `/execute` endpoints (they won't be called yet)
   - [ ] Remove `partialSign()` from prepare endpoints
   - [ ] Verify backend builds successfully
   - [ ] Test backend endpoints with curl/Postman

2. **Frontend Second** (30 minutes)
   - [ ] Update all hooks to use execute endpoints
   - [ ] Verify frontend builds successfully
   - [ ] Deploy to production

3. **Smoke Test** (15 minutes)
   - [ ] Execute one transaction of each type
   - [ ] Verify no Phantom warnings
   - [ ] Monitor error rates

4. **Full Validation** (1 hour)
   - [ ] Complete full testing checklist
   - [ ] Monitor for 1 hour
   - [ ] Check user feedback

---

## FILES CHANGED SUMMARY

### New Files Created (7 files):
1. `/app/api/trades/execute/route.ts`
2. `/app/api/settlements/execute/route.ts`
3. `/app/api/users/withdraw/execute/route.ts`
4. `/app/api/users/protocol_deposit/execute/route.ts`
5. `/app/api/pools/execute/route.ts`

### Files Modified - Backend (5 files):
1. `/app/api/trades/prepare/route.ts` - Remove line 629
2. `/app/api/posts/[id]/rebase/route.ts` - Remove line 413
3. `/app/api/users/withdraw/route.ts` - Remove partialSign
4. `/app/api/users/protocol_deposit/route.ts` - Remove partialSign
5. `/app/api/pools/recover/route.ts` - Remove partialSign (if present)

### Files Modified - Frontend (6 files):
1. `/src/hooks/useBuyTokens.ts` - Lines 125-131
2. `/src/hooks/useSellTokens.ts` - Lines 95-101
3. `/src/hooks/useRebasePool.ts` - Lines 106-115
4. `/src/hooks/useDeployPool.ts` - Lines 295-314
5. `/src/components/profile/WithdrawModal.tsx` - Update signing/sending
6. TBD: Protocol deposit component - Update signing/sending

**Total: 18 files changed (7 new, 11 modified)**

---

## COMPLETION CRITERIA

This implementation is complete when:

- [ ] All 7 new execute endpoints created
- [ ] All 5 backend prepare endpoints updated (partialSign removed)
- [ ] All 6 frontend hooks/components updated
- [ ] All 8 transaction types tested with Phantom
- [ ] Zero security warnings appear
- [ ] All transactions succeed on-chain
- [ ] Database records updated correctly
- [ ] Error handling verified
- [ ] Rollback procedure documented and tested

---

*Implementation Guide Version: 1.0*
*Last Updated: November 2025*

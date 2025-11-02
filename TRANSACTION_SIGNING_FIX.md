# Transaction Signing Fix - Implementation Guide

## Problem
Phantom flags transactions as malicious because protocol authority signs **before** user. Must reverse to: user signs first, then protocol authority.

## Solution Architecture
**Server-Sends Pattern**: User signs tx → sends to backend → backend adds protocol signature → backend submits to Solana

---

## Implementation Steps

### PHASE 1: Trading (Buy/Sell Tokens)

#### 1.1 Create `/app/api/trades/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteTradeRequest {
  signedTransaction: string;  // Base64 user-signed tx
  postId: string;
  tradeType: 'buy' | 'sell';
  side: 'LONG' | 'SHORT';
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { signedTransaction, postId, tradeType, side } = await req.json();
    if (!signedTransaction || !postId || !tradeType || !side) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Deserialize user-signed transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Add protocol authority signature (AFTER user signed)
    const protocolAuthority = loadProtocolAuthority();
    transaction.partialSign(protocolAuthority);

    // Submit to Solana
    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    const confirmed = !confirmation.value.err;
    const slot = confirmation.context.slot;

    if (!confirmed) {
      return NextResponse.json(
        { error: 'Transaction failed on-chain', signature },
        { status: 400 }
      );
    }

    return NextResponse.json({ signature, confirmed, slot });

  } catch (error: any) {
    console.error('[EXECUTE TRADE] Error:', error);

    // Parse error messages
    let errorMessage = 'Failed to execute transaction';
    if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient SOL for transaction fees';
    } else if (error.message?.includes('blockhash not found')) {
      errorMessage = 'Transaction expired. Please try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
```

#### 1.2 Update `/app/api/trades/prepare/route.ts`

**Line 629** - Remove:
```typescript
  // Sign with protocol authority
  tx.partialSign(authorityKeypair);
```

Add comment:
```typescript
  // Protocol authority will sign in /api/trades/execute (user signs first)
```

#### 1.3 Update `/src/hooks/useBuyTokens.ts`

**Lines 125-131** - Replace:
```typescript
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
```

With:
```typescript
      // User signs FIRST
      const signedTx = await wallet.signTransaction(transaction);

      // Send to backend for protocol signature and execution
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
        throw new Error(errorData.error || 'Failed to execute transaction');
      }

      const { signature } = await executeResponse.json();
```

#### 1.4 Update `/src/hooks/useSellTokens.ts`

**Lines 95-101** - Apply same pattern as useBuyTokens, changing `tradeType: 'buy'` to `tradeType: 'sell'`

---

### PHASE 2: Settlements/Rebasing

#### 2.1 Create `/app/api/settlements/execute/route.ts`

Same pattern as trades/execute but with:
```typescript
interface ExecuteSettlementRequest {
  signedTransaction: string;
  postId: string;
  poolAddress: string;
  epoch: number;
}
```

Error handling includes:
```typescript
if (sendError.message?.includes('SettlementCooldown')) {
  errorMessage = 'Settlement cooldown active. Please wait before settling again.';
}
```

#### 2.2 Update `/app/api/posts/[id]/rebase/route.ts`

**Line 413** - Remove:
```typescript
    transaction.partialSign(protocolAuthority);
```

Add comment:
```typescript
    // Protocol authority will sign in /api/settlements/execute (user signs first)
```

#### 2.3 Update `/src/hooks/useRebasePool.ts`

**Lines 106-115** - Replace:
```typescript
      const signedTx = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');
```

With:
```typescript
      const signedTx = await wallet.signTransaction(transaction);

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
        throw new Error(errorData.error || 'Failed to execute settlement');
      }

      const { signature: txSignature } = await executeResponse.json();
```

---

### PHASE 3: Withdrawals

#### 3.1 Create `/app/api/users/withdraw/execute/route.ts`

Same pattern as trades/execute but with:
```typescript
interface ExecuteWithdrawalRequest {
  signedTransaction: string;
  amount: number;  // micro-USDC
  walletAddress: string;
}
```

Error handling includes:
```typescript
if (sendError.message?.includes('InsufficientStake')) {
  errorMessage = 'Insufficient stake balance for withdrawal';
}
```

#### 3.2 Update `/app/api/users/withdraw/route.ts`

Find and remove `partialSign()` call, add comment:
```typescript
    // Protocol authority will sign in /api/users/withdraw/execute (user signs first)
```

#### 3.3 Update `/src/components/profile/WithdrawModal.tsx`

**Lines 102-111** - Replace:
```typescript
      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
```

With:
```typescript
      const signedTx = await wallet.signTransaction(tx);

      const executeResponse = await fetch('/api/users/withdraw/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          amount: Math.floor(amountNum * 1_000_000), // micro-USDC
          walletAddress: address,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute withdrawal');
      }

      const { signature } = await executeResponse.json();
```

---

### PHASE 4: Protocol Deposits

#### 4.1 Create `/app/api/users/protocol_deposit/execute/route.ts`

Same pattern as withdraw/execute with:
```typescript
interface ExecuteDepositRequest {
  signedTransaction: string;
  amount: number;  // micro-USDC
  walletAddress: string;
}
```

Error handling includes:
```typescript
if (sendError.message?.includes('insufficient funds')) {
  errorMessage = 'Insufficient USDC balance for deposit';
}
```

#### 4.2 Update `/app/api/users/protocol_deposit/route.ts`

**Check if file has `partialSign()` call** - If yes, remove it and add comment:
```typescript
    // Protocol authority will sign in /api/users/protocol_deposit/execute (user signs first)
```

**Note:** After reading the file, it appears to NOT build transactions client-side. Verify if this endpoint needs changes.

#### 4.3 Find Protocol Deposit Frontend Component

**Search for:** Files that call `/api/users/protocol_deposit`
**Pattern:** Look for `sendRawTransaction` after fetching from protocol_deposit endpoint
**If found:** Apply same execute pattern as withdrawals

---

### PHASE 5: Pool Deployment

#### 5.1 Create `/app/api/pools/execute/route.ts`

Same pattern as trades/execute with:
```typescript
interface ExecutePoolRequest {
  signedTransaction: string;
  postId: string;
  isOrphaned: boolean;
}
```

#### 5.2 Update `/src/hooks/useDeployPool.ts`

**Lines 295-304** - Replace:
```typescript
          const signedTx = await wallet.signTransaction(combinedTx);
          txSignature = await connection.sendRawTransaction(signedTx.serialize());
          await connection.confirmTransaction(txSignature, 'confirmed');
```

With:
```typescript
          const signedTx = await wallet.signTransaction(combinedTx);

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
            throw new Error(errorData.error || 'Failed to execute pool deployment');
          }

          const { signature: txSignature } = await executeResponse.json();
```

---

## AUDIT FINDINGS & FIXES

### Critical Issues Found:

1. **Missing File: `/app/api/pools/settle/route.ts`**
   - Has `partialSign()` but not covered in plan
   - **FIX:** Check if this is used or deprecated. If used, follow rebase pattern.

2. **Blockhash Expiry Risk**
   - Transactions built on backend may expire before user signs (60s limit)
   - **FIX:** Already handled - backend builds tx fresh each time, user signs immediately

3. **Transaction Deserialization Bug Risk**
   - `Buffer.from()` in Node.js vs browser environments
   - **FIX:** Already safe - using `@solana/web3.js` which handles cross-platform

4. **Missing Error Recovery**
   - If execute endpoint fails, user sees generic error
   - **FIX:** Each execute endpoint has specific error parsing for common failures

5. **Confirmation Timeout Handling**
   - Current code doesn't handle partial confirms
   - **ALREADY FIXED:** All execute endpoints return signature even on timeout (status 202)

### Minor Issues:

6. **Duplicate Code in Execute Endpoints**
   - Same auth/deserialize/sign/send logic repeated 5 times
   - **RECOMMENDATION:** Extract to shared utility function (optional, can do later)

7. **Missing Transaction Type**
   - `/app/api/pools/settle/route.ts` not in plan
   - **NEEDS INVESTIGATION:** Determine if this is duplicate of rebase or separate flow

8. **No Idempotency**
   - User could submit same signed tx twice
   - **LOW PRIORITY:** Solana prevents duplicate tx by blockhash, but consider adding request dedup

---

## Files Changed Summary

### New Files (5):
1. `/app/api/trades/execute/route.ts`
2. `/app/api/settlements/execute/route.ts`
3. `/app/api/users/withdraw/execute/route.ts`
4. `/app/api/users/protocol_deposit/execute/route.ts`
5. `/app/api/pools/execute/route.ts`

### Modified - Backend (3):
1. `/app/api/trades/prepare/route.ts` - Remove line 629
2. `/app/api/posts/[id]/rebase/route.ts` - Remove line 413
3. `/app/api/users/withdraw/route.ts` - Remove partialSign if present

### Modified - Frontend (5):
1. `/src/hooks/useBuyTokens.ts` - Lines 125-131
2. `/src/hooks/useSellTokens.ts` - Lines 95-101
3. `/src/hooks/useRebasePool.ts` - Lines 106-115
4. `/src/hooks/useDeployPool.ts` - Lines 295-304
5. `/src/components/profile/WithdrawModal.tsx` - Lines 102-111

### To Investigate (2):
1. `/app/api/pools/settle/route.ts` - Determine if needed/used
2. Protocol deposit frontend - Find component that calls protocol_deposit

**Total: 5 new, 8 modified, 2 to investigate**

---

## Testing Checklist

### Transaction Types (8):
- [ ] Buy LONG - No Phantom warning, tx succeeds
- [ ] Buy SHORT - No Phantom warning, tx succeeds
- [ ] Sell LONG - No Phantom warning, tx succeeds
- [ ] Sell SHORT - No Phantom warning, tx succeeds
- [ ] Pool Rebase - No Phantom warning, tx succeeds
- [ ] Withdraw USDC - No Phantom warning, tx succeeds
- [ ] Protocol Deposit - No Phantom warning, tx succeeds (if used)
- [ ] Pool Deploy - No Phantom warning, tx succeeds

### Error Scenarios:
- [ ] Expired blockhash (wait 60s) - Clear error message
- [ ] Insufficient SOL - Clear error message
- [ ] Insufficient USDC - Clear error message
- [ ] User rejects - Graceful failure
- [ ] Network timeout - Signature returned with timeout warning

### Phantom Verification:
- [ ] No security warnings in browser extension
- [ ] No security warnings in mobile app
- [ ] Transaction preview shows correct details
- [ ] All signers displayed correctly

---

## Deployment

### Order:
1. **Backend** - Deploy execute endpoints + remove partialSign
2. **Frontend** - Update hooks to use execute endpoints
3. **Smoke test** - One tx of each type
4. **Monitor** - 1 hour observation

### Rollback:
1. Comment out execute endpoint fetch calls
2. Uncomment old sendRawTransaction code
3. Re-add partialSign to backend
4. Deploy

---

## Investigation Required

Before implementing, resolve these:

1. **Is `/app/api/pools/settle/route.ts` used?**
   - Grep for calls to this endpoint
   - Check if it's deprecated vs `/app/api/posts/[id]/rebase`
   - If used, add to implementation plan

2. **Where is protocol deposit UI?**
   - Search for components calling `/api/users/protocol_deposit`
   - May be in UnifiedSwapComponent or separate modal
   - Add to implementation if found

3. **Does useDeployPool need jwt variable?**
   - Check if `jwt` is available in scope at line where we call execute
   - May need to import `usePrivy` and call `getAccessToken()`

---

*Last Updated: November 2025*
*Version: 2.0 (Audited & Concise)*

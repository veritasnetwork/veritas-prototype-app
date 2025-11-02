# Transaction Signing Fix - Complete Implementation Guide

## Problem
Phantom flags transactions as malicious because protocol authority signs **before** user. Must reverse to: user signs first, then protocol authority.

## Solution Architecture
**Server-Sends Pattern**: User signs tx → sends to backend → backend adds protocol signature → backend submits to Solana

---

## Complete Investigation Results

### Transaction Types Requiring Fix (6):
1. ✅ **Trading** - Buy/Sell LONG/SHORT tokens (`useBuyTokens`, `useSellTokens`)
2. ✅ **Pool Rebasing** - Epoch settlements (`useRebasePool`)
3. ✅ **Pool Settlement** - Direct settlement (`SettlementButton`) - **DUPLICATE OF REBASE**
4. ✅ **Withdrawals** - USDC withdrawals (`WithdrawModal`)
5. ✅ **Pool Deployment** - Create pools (`useDeployPool`)
6. ✅ **Protocol Deposits** - Stake deposits (`UnifiedSwapComponent`)

### Transaction Types NOT Requiring Fix (1):
- ❌ **TransferFundsModal** - Simple SOL/USDC transfers (no protocol signature needed)

### Backend Endpoints with partialSign (4):
1. `/app/api/trades/prepare/route.ts:629`
2. `/app/api/posts/[id]/rebase/route.ts:413`
3. `/app/api/pools/settle/route.ts:203`
4. `/app/api/users/withdraw/route.ts:242`

### Frontend Files with sendRawTransaction (9):
1. `/src/hooks/useBuyTokens.ts:130` ✅
2. `/src/hooks/useSellTokens.ts:100` ✅
3. `/src/hooks/useRebasePool.ts:111` ✅
4. `/src/hooks/useDeployPool.ts:301` ✅
5. `/src/components/profile/WithdrawModal.tsx:108` ✅
6. `/src/components/pool/SettlementButton.tsx:94` ✅
7. `/src/components/post/PostDetailPanel/UnifiedSwapComponent.tsx:335` ✅ (protocol deposit)
8. `/src/components/wallet/TransferFundsModal.tsx:121,166` ❌ (no protocol sig)

---

## Critical Finding: Duplicate Settlement Endpoints

**Issue:** Both `/api/posts/[id]/rebase` and `/api/pools/settle` do the same thing:
- Both call `settle_epoch` instruction
- Both require BD score
- Both use protocol authority signature

**Resolution:**
- `/api/posts/[id]/rebase` - Used by `useRebasePool` hook (runs BD decomposition THEN settles)
- `/api/pools/settle` - Used by `SettlementButton` (settles using existing BD score)

**Action:** Update BOTH endpoints + their frontend components

---

## Implementation Steps

### PHASE 1: Trading (Buy/Sell)

#### 1.1 Create `/app/api/trades/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteTradeRequest {
  signedTransaction: string;
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

    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    const protocolAuthority = loadProtocolAuthority();
    transaction.partialSign(protocolAuthority);

    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      return NextResponse.json({ error: 'Transaction failed on-chain', signature }, { status: 400 });
    }

    return NextResponse.json({ signature, confirmed: true, slot: confirmation.context.slot });

  } catch (error: any) {
    let errorMessage = 'Failed to execute transaction';
    if (error.message?.includes('insufficient funds')) errorMessage = 'Insufficient SOL for fees';
    else if (error.message?.includes('blockhash not found')) errorMessage = 'Transaction expired. Please try again.';
    else if (error.message) errorMessage = error.message;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
```

#### 1.2 Update `/app/api/trades/prepare/route.ts`

**Line 629** - Remove:
```typescript
  tx.partialSign(authorityKeypair);
```

Replace with:
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
      const signedTx = await wallet.signTransaction(transaction);

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

**Lines 95-101** - Same pattern as useBuyTokens, change `tradeType: 'buy'` to `tradeType: 'sell'`

---

### PHASE 2: Settlements (Rebase + Direct Settle)

#### 2.1 Create `/app/api/settlements/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteSettlementRequest {
  signedTransaction: string;
  postId: string;
  poolAddress: string;
  epoch?: number;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { signedTransaction, postId, poolAddress } = await req.json();
    if (!signedTransaction || !postId || !poolAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    const protocolAuthority = loadProtocolAuthority();
    transaction.partialSign(protocolAuthority);

    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      return NextResponse.json({ error: 'Settlement failed on-chain', signature }, { status: 400 });
    }

    return NextResponse.json({ signature, confirmed: true, slot: confirmation.context.slot });

  } catch (error: any) {
    let errorMessage = 'Failed to execute settlement';
    if (error.message?.includes('insufficient funds')) errorMessage = 'Insufficient SOL for fees';
    else if (error.message?.includes('blockhash not found')) errorMessage = 'Transaction expired. Please try again.';
    else if (error.message?.includes('SettlementCooldown')) errorMessage = 'Settlement cooldown active. Please wait.';
    else if (error.message) errorMessage = error.message;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
```

#### 2.2 Update `/app/api/posts/[id]/rebase/route.ts`

**Line 413** - Remove:
```typescript
    transaction.partialSign(protocolAuthority);
```

Replace with:
```typescript
    // Protocol authority will sign in /api/settlements/execute (user signs first)
```

#### 2.3 Update `/app/api/pools/settle/route.ts`

**Line 203** - Remove:
```typescript
    transaction.partialSign(protocolAuthority);
```

Replace with:
```typescript
    // Protocol authority will sign in /api/settlements/execute (user signs first)
```

#### 2.4 Update `/src/hooks/useRebasePool.ts`

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

#### 2.5 Update `/src/components/pool/SettlementButton.tsx`

**Lines 87-95** - Replace:
```typescript
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Send and confirm transaction
      const rpcEndpoint = getRpcEndpoint();
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
```

With:
```typescript
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      const executeResponse = await fetch('/api/settlements/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          postId,
          poolAddress,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute settlement');
      }

      const { signature } = await executeResponse.json();
```

---

### PHASE 3: Withdrawals

#### 3.1 Create `/app/api/users/withdraw/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteWithdrawalRequest {
  signedTransaction: string;
  amount: number;
  walletAddress: string;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { signedTransaction, amount, walletAddress } = await req.json();
    if (!signedTransaction || !amount || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    const protocolAuthority = loadProtocolAuthority();
    transaction.partialSign(protocolAuthority);

    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      return NextResponse.json({ error: 'Withdrawal failed on-chain', signature }, { status: 400 });
    }

    return NextResponse.json({ signature, confirmed: true, slot: confirmation.context.slot });

  } catch (error: any) {
    let errorMessage = 'Failed to execute withdrawal';
    if (error.message?.includes('insufficient funds')) errorMessage = 'Insufficient SOL for fees';
    else if (error.message?.includes('blockhash not found')) errorMessage = 'Transaction expired. Please try again.';
    else if (error.message?.includes('InsufficientStake')) errorMessage = 'Insufficient stake balance';
    else if (error.message) errorMessage = error.message;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
```

#### 3.2 Update `/app/api/users/withdraw/route.ts`

**Line 242** - Remove:
```typescript
  tx.partialSign(authorityKeypair);
```

Replace with:
```typescript
  // Protocol authority will sign in /api/users/withdraw/execute (user signs first)
```

#### 3.3 Update `/src/components/profile/WithdrawModal.tsx`

**Lines 102-111** - Replace:
```typescript
      const signedTx = await wallet.signTransaction(tx);

      // Send transaction
      const rpcEndpoint = getRpcEndpoint();
      const connection = new Connection(rpcEndpoint, 'confirmed');

      const signature = await connection.sendRawTransaction(signedTx.serialize());

      console.log('[WITHDRAW] ⏳ Confirming transaction:', signature);
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('[WITHDRAW] ✅ Transaction confirmed on blockchain!');
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
          amount: Math.floor(amountNum * 1_000_000),
          walletAddress: address,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute withdrawal');
      }

      const { signature } = await executeResponse.json();
      console.log('[WITHDRAW] ✅ Transaction confirmed:', signature);
```

---

### PHASE 4: Protocol Deposits

#### 4.1 Create `/app/api/users/protocol_deposit/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecuteDepositRequest {
  signedTransaction: string;
  amount: number;
  walletAddress: string;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { signedTransaction, amount, walletAddress } = await req.json();
    if (!signedTransaction || !amount || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Note: Protocol deposits DON'T require protocol authority signature
    // This is a direct user-to-custodian transfer

    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      return NextResponse.json({ error: 'Deposit failed on-chain', signature }, { status: 400 });
    }

    return NextResponse.json({ signature, confirmed: true, slot: confirmation.context.slot });

  } catch (error: any) {
    let errorMessage = 'Failed to execute deposit';
    if (error.message?.includes('insufficient funds')) errorMessage = 'Insufficient USDC balance';
    else if (error.message?.includes('blockhash not found')) errorMessage = 'Transaction expired. Please try again.';
    else if (error.message) errorMessage = error.message;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
```

**IMPORTANT:** Protocol deposits do NOT use protocol authority signature - they're simple user→custodian transfers.

#### 4.2 Update `/src/components/post/PostDetailPanel/UnifiedSwapComponent.tsx`

**Lines 329-336** - Replace:
```typescript
      // @ts-ignore - Privy wallet has signTransaction
      const signedTx = await wallet.signTransaction(transaction);

      // Step 3: Send and confirm
      const rpcEndpoint = getRpcEndpoint();
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
```

With:
```typescript
      // @ts-ignore - Privy wallet has signTransaction
      const signedTx = await wallet.signTransaction(transaction);

      const executeResponse = await fetch('/api/users/protocol_deposit/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          amount: Math.floor(amount * 1_000_000),
          walletAddress: address,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute deposit');
      }

      const { signature } = await executeResponse.json();
```

---

### PHASE 5: Pool Deployment

#### 5.1 Create `/app/api/pools/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Transaction } from '@solana/web3.js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { getRpcEndpoint } from '@/lib/solana/network-config';

interface ExecutePoolRequest {
  signedTransaction: string;
  postId: string;
  isOrphaned: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { signedTransaction, postId, isOrphaned } = await req.json();
    if (!signedTransaction || !postId || isOrphaned === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    const protocolAuthority = loadProtocolAuthority();
    transaction.partialSign(protocolAuthority);

    const rpcEndpoint = getRpcEndpoint();
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      return NextResponse.json({ error: 'Pool deployment failed on-chain', signature }, { status: 400 });
    }

    return NextResponse.json({ signature, confirmed: true, slot: confirmation.context.slot });

  } catch (error: any) {
    let errorMessage = 'Failed to execute pool deployment';
    if (error.message?.includes('insufficient funds')) errorMessage = 'Insufficient SOL or USDC';
    else if (error.message?.includes('blockhash not found')) errorMessage = 'Transaction expired. Please try again.';
    else if (error.message) errorMessage = error.message;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
```

#### 5.2 Update `/src/hooks/useDeployPool.ts`

**Lines 295-304** - Replace:
```typescript
          console.log('🔐 [SIGNING] Calling wallet.signTransaction()...');
          const signedTx = await wallet.signTransaction(combinedTx);
          console.log('✅ [SIGNING] Transaction signed successfully!');


          // Send the transaction
          txSignature = await connection.sendRawTransaction(signedTx.serialize());

          // Wait for confirmation
          await connection.confirmTransaction(txSignature, 'confirmed');
```

With:
```typescript
          console.log('🔐 [SIGNING] Calling wallet.signTransaction()...');
          const signedTx = await wallet.signTransaction(combinedTx);
          console.log('✅ [SIGNING] Transaction signed successfully!');

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
          console.log('✅ [DEPLOY] Transaction executed:', txSignature);
```

**NOTE:** `jwt` variable is available at line 51 in useDeployPool ✅

---

## Files Changed Summary

### New Files (5):
1. `/app/api/trades/execute/route.ts`
2. `/app/api/settlements/execute/route.ts`
3. `/app/api/users/withdraw/execute/route.ts`
4. `/app/api/users/protocol_deposit/execute/route.ts` (no protocol sig needed)
5. `/app/api/pools/execute/route.ts`

### Modified - Backend (4):
1. `/app/api/trades/prepare/route.ts` - Line 629
2. `/app/api/posts/[id]/rebase/route.ts` - Line 413
3. `/app/api/pools/settle/route.ts` - Line 203
4. `/app/api/users/withdraw/route.ts` - Line 242

### Modified - Frontend (7):
1. `/src/hooks/useBuyTokens.ts` - Lines 125-131
2. `/src/hooks/useSellTokens.ts` - Lines 95-101
3. `/src/hooks/useRebasePool.ts` - Lines 106-115
4. `/src/hooks/useDeployPool.ts` - Lines 295-304
5. `/src/components/profile/WithdrawModal.tsx` - Lines 102-111
6. `/src/components/pool/SettlementButton.tsx` - Lines 87-95
7. `/src/components/post/PostDetailPanel/UnifiedSwapComponent.tsx` - Lines 329-336

### Not Modified (1):
- `/src/components/wallet/TransferFundsModal.tsx` - Simple transfers, no protocol signature

**Total: 5 new, 4 backend modified, 7 frontend modified**

---

## Testing Checklist

### All Transaction Types:
- [ ] Buy LONG - No Phantom warning
- [ ] Buy SHORT - No Phantom warning
- [ ] Sell LONG - No Phantom warning
- [ ] Sell SHORT - No Phantom warning
- [ ] Pool Rebase - No Phantom warning
- [ ] Pool Direct Settle - No Phantom warning
- [ ] Withdraw USDC - No Phantom warning
- [ ] Protocol Deposit - No Phantom warning
- [ ] Pool Deploy - No Phantom warning

### Error Scenarios:
- [ ] Expired blockhash - Clear error
- [ ] Insufficient SOL - Clear error
- [ ] Insufficient USDC - Clear error
- [ ] User rejection - Graceful failure
- [ ] Settlement cooldown - Clear error

### Phantom Verification:
- [ ] No security warnings in extension
- [ ] No security warnings in mobile
- [ ] Transaction preview correct
- [ ] All signers shown correctly

---

## Deployment Order

1. **Backend** - Deploy execute endpoints + remove partialSign
2. **Frontend** - Update all hooks/components
3. **Smoke test** - One tx of each type
4. **Monitor** - 1 hour observation

---

## Key Insights from Investigation

1. **Protocol Deposits Don't Need Protocol Signature** - They're simple user→custodian transfers
2. **Two Settlement Endpoints Exist** - Both need updating:
   - `/api/posts/[id]/rebase` - Runs BD decomposition then settles
   - `/api/pools/settle` - Settles with existing BD score
3. **TransferFundsModal is Safe** - No protocol signature, just user transfers
4. **All jwt Variables Available** - No import changes needed

---

*Last Updated: November 2025*
*Status: Complete Investigation - Ready for Implementation*

# Transaction Signing Order Fix - Implementation Plan

## Executive Summary

Phantom wallet is flagging Veritas transactions as potentially malicious because we're signing transactions in the wrong order. The protocol authority currently signs first (on the backend), then the user signs second. Phantom expects the opposite: user signs first, then additional signers are added.

**Recommended Solution:** Implement a server-sends architecture where the frontend gets an unsigned transaction, the user signs it, sends it back to the server for protocol counter-signature, and the server submits to Solana.

## Problem Analysis

### Current Flow (Causing Warnings)
```
1. Backend: Build tx → Protocol signs → Return to frontend
2. Frontend: User signs (second) → Send to Solana
3. Result: Phantom shows security warning
```

### Root Cause
- Phantom's Lighthouse security system detects multi-signer transactions
- When an unknown signer (protocol authority) signs before the user, it triggers a warning
- This pattern resembles malicious dApps that try to sneak in unauthorized signers

### Affected Transaction Types
1. **Trading** - Buy/Sell LONG/SHORT tokens (`/api/trades/prepare`)
2. **Pool Rebasing** - Settlement transactions (`/api/posts/[id]/rebase`)
3. **Withdrawals** - USDC withdrawals from custodian (`/api/users/withdraw`)
4. **Protocol Deposits** - USDC deposits to custodian (`/api/users/protocol_deposit`)
5. **Pool Recovery** - Recovery transactions (`/api/pools/recover`)

## Recommended Architecture: Server-Sends Pattern

### New Flow
```
1. Backend: Build tx → Return unsigned to frontend
2. Frontend: User signs (first) → Send signed tx to backend
3. Backend: Protocol signs (second) → Submit to Solana → Return signature
4. Result: No Phantom warnings
```

### Benefits
- **Minimal frontend changes** - Just redirect the send to backend instead of Solana
- **Better reliability** - Server has stable RPC connection
- **Centralized error handling** - Retry logic, RPC failures handled server-side
- **Cleaner architecture** - Frontend only handles signing, backend handles blockchain
- **Single source of truth** - Transaction status tracked in one place

## Implementation Plan

### Phase 1: Core Infrastructure (2 hours)

#### 1.1 Create `/api/trades/execute` endpoint
**File:** `/app/api/trades/execute/route.ts`

**Responsibilities:**
- Accept user-signed transaction (base64 encoded)
- Deserialize transaction
- Add protocol authority signature via `partialSign()`
- Submit to Solana via `sendRawTransaction()`
- Wait for confirmation
- Return transaction signature

**Request Interface:**
```typescript
interface ExecuteTradeRequest {
  signedTransaction: string;  // Base64 encoded, user-signed
  postId: string;             // For logging/tracking
  tradeType: 'buy' | 'sell';
  side: 'LONG' | 'SHORT';
  expectedSignature?: string; // For idempotency
}
```

**Response Interface:**
```typescript
interface ExecuteTradeResponse {
  signature: string;
  confirmed: boolean;
  slot?: number;
}
```

#### 1.2 Update `/api/trades/prepare` endpoint
**Changes:**
- Remove `tx.partialSign(authorityKeypair)` at line 629
- Transaction remains unsigned by protocol authority
- Keep all other logic (building instructions, setting accounts, etc.)

### Phase 2: Trading Hooks Update (1 hour)

#### 2.1 Update `useBuyTokens` hook
**File:** `/src/hooks/useBuyTokens.ts`

**Changes at lines 127-131:**
```typescript
// OLD:
const signedTx = await wallet.signTransaction(transaction);
const signature = await connection.sendRawTransaction(signedTx.serialize());
await connection.confirmTransaction(signature, 'confirmed');

// NEW:
const signedTx = await wallet.signTransaction(transaction);
const executeResponse = await fetch('/api/trades/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  },
  body: JSON.stringify({
    signedTransaction: signedTx.serialize().toString('base64'),
    postId,
    tradeType: 'buy',
    side: side.toUpperCase() as 'LONG' | 'SHORT',
  }),
});

if (!executeResponse.ok) {
  const error = await executeResponse.json();
  throw new Error(error.message || 'Failed to execute trade');
}

const { signature } = await executeResponse.json();
```

#### 2.2 Update `useSellTokens` hook
**File:** `/src/hooks/useSellTokens.ts`

**Apply same pattern at lines 97-101**

### Phase 3: Settlement & Special Transactions (2 hours)

#### 3.1 Create `/api/settlements/execute` endpoint
**File:** `/app/api/settlements/execute/route.ts`

Similar to trades/execute but for settlement transactions.

#### 3.2 Update `useRebasePool` hook
**File:** `/src/hooks/useRebasePool.ts`

**Changes at lines 107-116:**
- Send user-signed transaction to `/api/settlements/execute`
- Remove direct blockchain submission

#### 3.3 Update rebase API endpoint
**File:** `/app/api/posts/[id]/rebase/route.ts`

**Change at line 413:**
- Remove `transaction.partialSign(protocolAuthority)`

### Phase 4: Other Transaction Types (1.5 hours)

#### 4.1 Withdrawals
- Create `/api/users/withdraw/execute` endpoint
- Update `WithdrawModal.tsx` component
- Remove protocol pre-signing from `/api/users/withdraw`

#### 4.2 Protocol Deposits
- Update `/api/users/protocol_deposit` endpoint
- Create corresponding execute endpoint
- Update frontend components

#### 4.3 Pool Recovery
- Update `/api/pools/recover` endpoint
- Ensure proper signing order

### Phase 5: Testing & Validation (1 hour)

#### 5.1 Test Matrix
| Transaction Type | Test Scenario | Expected Result |
|-----------------|---------------|-----------------|
| Buy LONG | User buys tokens | No Phantom warning |
| Buy SHORT | User buys tokens | No Phantom warning |
| Sell LONG | User sells tokens | No Phantom warning |
| Sell SHORT | User sells tokens | No Phantom warning |
| Rebase Pool | User triggers settlement | No Phantom warning |
| Withdraw USDC | User withdraws | No Phantom warning |
| Protocol Deposit | User deposits | No Phantom warning |

#### 5.2 Error Scenarios
- Network failure after user signing
- RPC node timeout
- Invalid transaction (expired blockhash)
- Insufficient SOL for fees
- Transaction simulation failure

#### 5.3 Phantom Wallet Testing
- Test with Phantom browser extension
- Test with Phantom mobile
- Verify no security warnings appear
- Check transaction preview shows correct details

## Migration Strategy

### Rollout Plan
1. **Deploy backend changes first** (backward compatible)
   - New execute endpoints don't affect existing flow
   - Remove protocol pre-signing (breaks nothing if frontend still sends to chain)

2. **Update frontend in stages**
   - Start with one transaction type (e.g., Buy LONG)
   - Monitor for issues
   - Roll out to other transaction types

3. **Feature flag option** (optional)
   - Add `USE_SERVER_SEND` environment variable
   - Allow toggling between old and new flow
   - Remove after validation

### Rollback Plan
- Backend changes are backward compatible
- Frontend can revert to direct sending if issues arise
- Keep old code commented for 1 week post-deployment

## Security Considerations

### Benefits
- ✅ User explicitly approves transaction before any other signatures
- ✅ Protocol authority never touches unsigned user transactions
- ✅ Server-side validation before blockchain submission
- ✅ Better audit trail (all transactions go through server)

### Risks & Mitigations
- **Risk:** Server downtime prevents transactions
  - **Mitigation:** Add redundant API servers, implement circuit breakers

- **Risk:** Man-in-the-middle could modify signed transaction
  - **Mitigation:** HTTPS only, validate transaction integrity

- **Risk:** Replay attacks
  - **Mitigation:** Blockhash expiry, idempotency checks

## Performance Impact

### Latency Changes
- **Added:** ~50-100ms for backend round-trip
- **Removed:** Frontend→RPC connection setup time
- **Net impact:** Minimal, possibly faster due to server's better RPC connection

### Scalability
- Server can batch transactions
- Connection pooling for RPC
- Redis queue for high load (future enhancement)

## Success Metrics

### Primary Metrics
- **Zero Phantom warnings** on all transaction types
- **Transaction success rate** ≥ 99%
- **No increase in transaction failures**

### Secondary Metrics
- **User satisfaction** - Reduced confusion/concern
- **Transaction latency** - P95 < 3 seconds
- **Support tickets** - Reduction in security-related inquiries

## Timeline

### Day 1 (4 hours)
- Morning: Implement Phase 1 (Core Infrastructure)
- Afternoon: Implement Phase 2 (Trading Hooks)

### Day 2 (4 hours)
- Morning: Implement Phase 3 (Settlements)
- Afternoon: Implement Phase 4 (Other Transactions)

### Day 3 (2 hours)
- Morning: Phase 5 (Testing & Validation)
- Afternoon: Buffer for issues

**Total estimate: 10 hours of development + 2 hours testing**

## Code Examples

### Example: Execute Endpoint Implementation
```typescript
// /app/api/trades/execute/route.ts
export async function POST(req: NextRequest) {
  const { signedTransaction, postId, tradeType, side } = await req.json();

  // Deserialize user-signed transaction
  const txBuffer = Buffer.from(signedTransaction, 'base64');
  const transaction = Transaction.from(txBuffer);

  // Load protocol authority
  const protocolAuthority = loadProtocolAuthority();

  // Add protocol signature (user already signed)
  transaction.partialSign(protocolAuthority);

  // Submit to Solana
  const connection = new Connection(getRpcEndpoint(), 'confirmed');
  const signature = await connection.sendRawTransaction(
    transaction.serialize()
  );

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');

  return NextResponse.json({ signature, confirmed: true });
}
```

### Example: Updated Hook Pattern
```typescript
// Instead of:
const signature = await connection.sendRawTransaction(signedTx.serialize());

// Use:
const { signature } = await executeTransaction(signedTx, {
  postId,
  tradeType,
  side,
  jwt,
});
```

## Appendix

### A. Affected Files Checklist
- [ ] `/app/api/trades/prepare/route.ts` - Remove partialSign
- [ ] `/app/api/trades/execute/route.ts` - Create new endpoint
- [ ] `/src/hooks/useBuyTokens.ts` - Update to use execute endpoint
- [ ] `/src/hooks/useSellTokens.ts` - Update to use execute endpoint
- [ ] `/app/api/posts/[id]/rebase/route.ts` - Remove partialSign
- [ ] `/app/api/settlements/execute/route.ts` - Create new endpoint
- [ ] `/src/hooks/useRebasePool.ts` - Update to use execute endpoint
- [ ] `/app/api/users/withdraw/route.ts` - Remove partialSign
- [ ] `/app/api/users/withdraw/execute/route.ts` - Create new endpoint
- [ ] `/src/components/profile/WithdrawModal.tsx` - Update to use execute endpoint
- [ ] `/app/api/users/protocol_deposit/route.ts` - Update signing order
- [ ] `/app/api/pools/recover/route.ts` - Update signing order

### B. Testing Checklist
- [ ] Buy LONG tokens - No Phantom warning
- [ ] Buy SHORT tokens - No Phantom warning
- [ ] Sell LONG tokens - No Phantom warning
- [ ] Sell SHORT tokens - No Phantom warning
- [ ] Rebase pool - No Phantom warning
- [ ] Withdraw USDC - No Phantom warning
- [ ] Protocol deposit - No Phantom warning
- [ ] Pool recovery - No Phantom warning
- [ ] Transaction appears correctly in Phantom preview
- [ ] Transaction confirms successfully on-chain
- [ ] Database records updated correctly
- [ ] Error handling works (expired blockhash, insufficient funds, etc.)

### C. Monitoring & Alerts
- Set up alerts for:
  - Execute endpoint errors > 1%
  - Transaction confirmation failures
  - Increased latency (P95 > 5s)
  - Phantom warning reports from users

### D. Documentation Updates
- Update API documentation
- Update developer onboarding guide
- Add architecture decision record (ADR)
- Update troubleshooting guide

---

*Document Version: 1.0*
*Date: November 2025*
*Author: Veritas Protocol Team*
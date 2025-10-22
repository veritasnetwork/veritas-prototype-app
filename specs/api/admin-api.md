# Admin API

## Overview
Administrative endpoints for managing pool settlements and system operations.

## Context
- **Layer:** App
- **Auth:** Admin (protocol authority)
- **Dependencies:** Supabase, Solana RPC, settlement service
- **Used By:** Admin dashboard, automated settlement service

---

## Endpoints

### POST `/api/admin/settlements/retry`

Retry a failed pool settlement.

**Auth:** Admin (protocol authority)

**Request:**
```typescript
{
  pool_address: string,
  epoch: number
}
```

**Response (200):**
```typescript
{
  success: boolean,
  settlement: {
    id: string,
    pool_address: string,
    epoch: number,
    bd_score: number,
    status: 'pending' | 'confirmed' | 'failed',
    tx_signature: string | null,
    settled_at: string,
    retry_count: number
  }
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid pool_address | `{error: "Invalid pool address"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 403 | Not admin | `{error: "Admin access required"}` |
| 404 | Settlement not found | `{error: "No failed settlement for this epoch"}` |
| 409 | Already settled | `{error: "Settlement already succeeded"}` |
| 500 | Retry failed | `{error: "Failed to retry settlement"}` |

**Implementation:** `app/api/admin/settlements/retry/route.ts`

**Flow:**
1. Validate admin auth → Check protocol authority
2. Parse request body
3. Validate pool_address format
4. Query `settlements` table for pool_address + epoch
5. Check settlement exists and has status = 'failed'
6. Increment retry_count
7. Fetch current pool state from chain
8. Rebuild settlement transaction with same BD score
9. Submit transaction to Solana
10. UPDATE settlements SET status, tx_signature, retry_count
11. Return settlement record

**Validation Rules:**
- `pool_address`: Valid Solana address
- `epoch`: Integer >= 0
- Settlement must exist with status = 'failed'

**Edge Cases:**
- Settlement already succeeded → 409 Conflict
- Pool closed since failure → 400 Bad Request
- BD score changed → Use original score from settlement record
- Max retries exceeded (3) → 400 Bad Request
- Transaction fails again → Mark as failed, allow future retry

**Retry Logic:**
- Max 3 retries per settlement
- Exponential backoff between retries (handled by service)
- Each retry increments `retry_count` in database
- Original BD score preserved across retries

---

## Security

### Authentication
- Requires valid Privy JWT
- Token must belong to protocol authority account
- Protocol authority public key stored in env var

### Authorization Check
```typescript
// Verify user is protocol authority
const protocolAuthority = process.env.PROTOCOL_AUTHORITY_PUBKEY;
const userSolanaAddress = await getUserSolanaAddress(userId);

if (userSolanaAddress !== protocolAuthority) {
  return Response.json({ error: "Admin access required" }, { status: 403 });
}
```

### Rate Limiting
- Consider adding rate limits to prevent abuse
- Max 10 retries per minute per pool
- Alert on excessive retry attempts

---

## Data Structures

### Settlement Schema (Database)
```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT REFERENCES pool_deployments(pool_address),
  epoch INTEGER NOT NULL,
  bd_score NUMERIC NOT NULL,
  f_long NUMERIC NOT NULL,
  f_short NUMERIC NOT NULL,
  reserves_long_before NUMERIC,
  reserves_long_after NUMERIC,
  reserves_short_before NUMERIC,
  reserves_short_after NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  tx_signature TEXT UNIQUE,
  event_signature TEXT UNIQUE,
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  UNIQUE(pool_address, epoch)
);
```

---

## Operational

### Monitoring
- Track settlement success/failure rate
- Alert on repeated failures for same pool
- Log all retry attempts with details

### Common Failure Reasons
| Reason | Solution |
|--------|----------|
| Insufficient SOL for tx fee | Fund protocol authority wallet |
| Pool already settled on-chain | Sync database state |
| Invalid BD score calculation | Fix score, create new settlement |
| RPC node timeout | Retry with different RPC |
| Network congestion | Wait and retry with higher priority fee |

---

## Testing

### Critical Paths
1. Retry failed settlement → success
2. Retry succeeded settlement → 409
3. Retry non-existent settlement → 404
4. Retry as non-admin → 403
5. Retry with max retries exceeded → 400
6. Retry transaction fails again → updates status

### Test Implementation
- **Test Spec:** `specs/test-specs/api/admin-api.test.md`
- **Test Code:** `tests/api/admin.test.ts`

### Validation
- Admin authorization enforced
- Retry count incremented
- Original BD score preserved
- Settlement status updated correctly

---

## References
- Code: `app/api/admin/settlements/retry/route.ts`
- Service: `src/services/settlement.service.ts` (if exists)
- Database: `specs/data-structures/01-protocol-tables.md`
- Related: `specs/api/pools-api.md#post-apipoolssettle`

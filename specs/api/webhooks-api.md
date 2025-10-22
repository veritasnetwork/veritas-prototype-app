# Webhooks API

## Overview
Webhook endpoint for receiving on-chain events from Helius for mainnet event indexing.

## Context
- **Layer:** Infrastructure
- **Auth:** HMAC signature verification
- **Dependencies:** Helius webhooks, event-processor service, Supabase
- **Used By:** Helius webhook service (mainnet only)

---

## Endpoints

### POST `/api/webhooks/helius`

Receive and process on-chain transaction events from Helius.

**Auth:** HMAC signature (Helius webhook secret)

**Headers:**
```
x-helius-signature: <hmac_sha256_signature>
Content-Type: application/json
```

**Request:**
```typescript
{
  timestamp: number,           // Unix timestamp
  signature: string,           // Transaction signature
  slot: number,               // Solana slot number
  type: string,               // Event type (e.g., "TRANSACTION")
  source: "HELIUS",
  description: string,
  accountData: Array<{
    account: string,
    nativeBalanceChange: number,
    tokenBalanceChanges: Array<any>
  }>,
  events: {
    nft?: any,
    swap?: any,
    compressed?: any
  },
  transactionError?: string,
  instructions: Array<{
    accounts: string[],
    data: string,
    programId: string,
    innerInstructions: Array<any>
  }>,
  nativeTransfers: Array<any>,
  tokenTransfers: Array<any>
}
```

**Response (200):**
```typescript
{
  success: boolean,
  processed: number,           // Number of events processed
  skipped: number,             // Number of events skipped
  errors: number               // Number of errors
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Invalid payload | `{error: "Invalid webhook payload"}` |
| 401 | Invalid signature | `{error: "Invalid webhook signature"}` |
| 500 | Processing failed | `{error: "Failed to process webhook"}` |

**Implementation:** `app/api/webhooks/helius/route.ts`

**Flow:**
1. Extract x-helius-signature from headers
2. Verify HMAC signature using HELIUS_WEBHOOK_SECRET
3. If invalid → Return 401 Unauthorized
4. Parse request body
5. Validate required fields (signature, slot, instructions)
6. Filter instructions for Veritas program ID
7. Parse Anchor logs from instruction data
8. Extract events (Trade, Settlement, Deposit, etc.)
9. For each event:
   - Generate event signature (deduplication)
   - Call event-processor service
   - Handle errors gracefully (log, continue)
10. Return success with counts

**Validation Rules:**
- `signature`: Valid base58 transaction signature
- `slot`: Positive integer
- HMAC signature must match computed signature

**Edge Cases:**
- Multiple events in one transaction → Process all
- Event already processed → Skip (ON CONFLICT DO NOTHING)
- Transaction failed on-chain → Skip event processing
- Non-Veritas instructions → Ignore
- Malformed Anchor logs → Log error, skip event
- Database constraint violation → Log warning, continue

---

## Security

### HMAC Signature Verification

**Process:**
1. Get raw request body as string
2. Compute HMAC-SHA256 with HELIUS_WEBHOOK_SECRET
3. Compare with x-helius-signature header
4. Use constant-time comparison to prevent timing attacks

**Implementation:**
```typescript
import { createHmac } from 'crypto';

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  const computed = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Constant-time comparison
  return computed === signature;
}
```

### Rate Limiting
- Helius rate limits webhooks on their end
- Consider adding server-side rate limits for safety
- Max 1000 requests/minute per webhook

### IP Whitelisting (Optional)
- Can whitelist Helius IP ranges
- Not strictly necessary with HMAC verification

---

## Event Processing

### Supported Events

| Event Type | Anchor Event | Action |
|------------|--------------|--------|
| Trade | `TradeEvent` | Insert into trades table, update pool state |
| Settlement | `SettlementEvent` | Insert into settlements table, update pool status |
| Deployment | `DeployMarketEvent` | Insert into pool_deployments table |
| Liquidity | `AddLiquidityEvent` | Update pool liquidity metrics |

### Event Deduplication

**Strategy:** Generate unique event signature

```typescript
function generateEventSignature(
  txSignature: string,
  instructionIndex: number,
  eventIndex: number
): string {
  return `${txSignature}:${instructionIndex}:${eventIndex}`;
}
```

**Database Constraint:**
```sql
ALTER TABLE trades ADD COLUMN event_signature TEXT UNIQUE;
ALTER TABLE settlements ADD COLUMN event_signature TEXT UNIQUE;
```

**Behavior:**
- INSERT with ON CONFLICT (event_signature) DO NOTHING
- Duplicate events silently skipped
- No errors thrown on duplicates

---

## Data Flow

```
Solana Blockchain
  ↓ (emits events)
Helius Indexer
  ↓ (detects transaction)
Helius Webhook Service
  ↓ (POST /api/webhooks/helius)
Webhook Handler
  ↓ (verify signature, parse logs)
Event Processor Service
  ↓ (process each event type)
Supabase Database
  (trades, settlements, pool_deployments updated)
```

---

## Operational

### Monitoring

**Metrics to Track:**
- Webhook requests/minute
- Processing success rate
- Average processing latency
- Event types distribution
- Duplicate event rate

**Alerts:**
- Signature verification failures > 5/minute
- Processing errors > 10/minute
- No webhooks received for > 5 minutes (possible outage)
- Database write failures

### Logging

**Log Every:**
- Signature verification failures
- Invalid payloads
- Processing errors with tx signature
- Event counts (processed/skipped/errors)

**Log Format:**
```typescript
{
  timestamp: ISO8601,
  event: "webhook_received",
  tx_signature: string,
  slot: number,
  events_processed: number,
  events_skipped: number,
  errors: number,
  latency_ms: number
}
```

### Helius Dashboard

**Configuration:**
- Webhook URL: `https://your-domain.com/api/webhooks/helius`
- Transaction types: All transactions
- Account addresses: [Veritas program ID]
- Webhook secret: Stored in env

**Testing:**
- Use Helius dashboard to send test webhook
- Verify signature verification works
- Check database updates

---

## Development

### Local Testing

**Mock Webhook:**
```typescript
// Generate valid signature for testing
const payload = JSON.stringify(mockWebhookData);
const signature = createHmac('sha256', process.env.HELIUS_WEBHOOK_SECRET!)
  .update(payload)
  .digest('hex');

const response = await fetch('http://localhost:3000/api/webhooks/helius', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-helius-signature': signature
  },
  body: payload
});
```

### Environment Variables
```env
# Helius webhook secret (from Helius dashboard)
HELIUS_WEBHOOK_SECRET=your_webhook_secret_here

# Veritas program ID
NEXT_PUBLIC_PROGRAM_ID=6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz
```

---

## Testing

### Critical Paths
1. Valid webhook with signature → processes events
2. Invalid signature → 401
3. Duplicate event → skipped
4. Multiple events in tx → all processed
5. Transaction failed on-chain → skipped
6. Malformed payload → 400

### Test Implementation
- **Test Spec:** `specs/test-specs/api/webhooks-api.test.md`
- **Test Code:** `tests/api/webhooks.test.ts`

### Validation
- Signature verification works
- Events deduplicated correctly
- Database updates accurate
- Error handling graceful
- No information leakage on errors

---

## References
- Code: `app/api/webhooks/helius/route.ts`
- Processor: `src/services/event-processor.service.ts`
- Helius Docs: https://docs.helius.dev/webhooks-and-websockets/webhooks
- Database: `specs/data-structures/01-protocol-tables.md`
- Related: `specs/architecture/event-indexing.md` (if exists)

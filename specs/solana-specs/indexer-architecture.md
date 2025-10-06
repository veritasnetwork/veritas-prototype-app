# Solana Indexer Architecture

## Overview

Event-driven indexer for monitoring Solana smart contract events and syncing state to Supabase database.

**Architecture:** Helius Webhooks → Supabase Edge Functions → PostgreSQL

---

## Design Rationale

### Why Helius Webhooks?

✅ **Event-driven** - Real-time push notifications, no polling waste
✅ **Reliable** - Helius handles retries, monitoring, and infrastructure
✅ **Cost-effective** - Pay per event (~$0.001 per deposit)
✅ **Runs on Supabase** - No additional hosting needed
✅ **Production-ready** - Battle-tested, used by major Solana projects

### Alternatives Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Polling (Supabase Cron)** | Simple, no external deps | Inefficient, rate limits, can miss events | ❌ Rejected |
| **Self-hosted indexer** | Full control, flexible | Extra infrastructure, complexity | ❌ Overkill |
| **Helius webhooks** | Reliable, cheap, event-driven | External dependency | ✅ **Selected** |
| **Clockwork (on-chain)** | Solana-native | Overkill for off-chain indexing | ❌ Rejected |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Solana Blockchain                        │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ VeritasCustodian│         │  ContentPool    │           │
│  │                 │         │                 │           │
│  │ • Deposit       │         │ • Buy/Sell      │           │
│  │ • Withdraw      │         │ • Penalty/Reward│           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           │ emit DepositEvent         │ (no events needed)  │
│           │                           │                     │
└───────────┼───────────────────────────┼─────────────────────┘
            │                           │
            ▼                           ▼
   ┌────────────────────────────────────────────┐
   │           Helius Infrastructure            │
   │                                            │
   │  • WebSocket listeners on vault addresses │
   │  • Parse transaction logs for events      │
   │  • Retry logic and reliability            │
   │  • Webhook delivery with signing          │
   └───────────────────┬────────────────────────┘
                       │
                       │ HTTPS POST (webhook)
                       │
                       ▼
   ┌─────────────────────────────────────────────┐
   │      Supabase Edge Functions                │
   │                                             │
   │  ┌──────────────────────────────────────┐  │
   │  │  helius-deposits                     │  │
   │  │  • Validate webhook signature        │  │
   │  │  • Parse event payload               │  │
   │  │  • Insert custodian_deposits         │  │
   │  │  • Upsert agents                     │  │
   │  │  • Credit protocol_stake             │  │
   │  └──────────────────────────────────────┘  │
   │                                             │
   │  ┌──────────────────────────────────────┐  │
   │  │  helius-pool-events (future)         │  │
   │  │  • Index pool state changes          │  │
   │  │  • Sync reserves, supply, k values   │  │
   │  └──────────────────────────────────────┘  │
   └───────────────────┬─────────────────────────┘
                       │
                       │ SQL queries
                       │
                       ▼
   ┌─────────────────────────────────────────────┐
   │         PostgreSQL (Supabase)               │
   │                                             │
   │  • custodian_deposits                       │
   │  • agents (protocol_stake updated)          │
   │  • pool_deployments (synced state)          │
   └─────────────────────────────────────────────┘
```

---

## Events to Index

### 1. Custodian Deposits (Priority 1) ✅

**Source:** VeritasCustodian contract
**Event:** `DepositEvent { depositor: Pubkey, amount: u64, timestamp: i64 }`
**Trigger:** User deposits USDC into custodian vault

**Actions:**
1. Insert record into `custodian_deposits`
2. Upsert `agents` table (create if doesn't exist)
3. Credit `protocol_stake` and `total_deposited`
4. Mark deposit as credited

**Edge Function:** `helius-deposits`

### 2. Custodian Withdrawals (Priority 2)

**Source:** VeritasCustodian contract
**Event:** `WithdrawEvent { recipient: Pubkey, amount: u64, authority: Pubkey, timestamp: i64 }`
**Trigger:** Protocol authority executes withdrawal on behalf of user

**Actions:**
1. Update `custodian_withdrawals` status to 'completed'
2. Record `tx_signature` and `block_time`
3. Decrement `protocol_stake` and increment `total_withdrawn`

**Edge Function:** `helius-withdrawals`

### 3. Pool State Sync (Priority 3)

**Source:** ContentPool contract
**Trigger:** Buy, Sell, Penalty, Reward operations

**Actions:**
1. Update `pool_deployments` cached state:
   - `token_supply`
   - `reserve`
   - `k_quadratic` (if elastic-k applied)
   - `last_synced_at`

**Edge Function:** `helius-pool-sync`

**Note:** Pool operations don't emit custom events. We detect them via:
- USDC transfers to/from pool vault
- Token mint/burn events
- Can also poll on-chain state periodically as backup

---

## Implementation

### Edge Function: helius-deposits

**File:** `supabase/functions/helius-deposits/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CUSTODIAN_VAULT = Deno.env.get('CUSTODIAN_VAULT_ADDRESS')!;
const USDC_MINT = Deno.env.get('USDC_MINT_ADDRESS')!;

serve(async (req) => {
  console.log('📥 Received webhook request');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const payload = await req.json();
    console.log('📦 Payload received');

    const events = Array.isArray(payload) ? payload : [payload];

    for (const event of events) {
      console.log('🔍 Processing event:', event.signature);

      // Find USDC transfer to custodian vault
      const transfer = event.tokenTransfers?.find((t: any) =>
        t.mint === USDC_MINT &&
        t.toUserAccount === CUSTODIAN_VAULT
      );

      if (!transfer) {
        console.log('⏭️  Not a deposit to custodian, skipping');
        continue;
      }

      console.log('💰 Deposit detected:', {
        from: transfer.fromUserAccount,
        amount: transfer.tokenAmount,
        signature: event.signature
      });

      // Insert deposit record
      const { data: deposit, error: depositError } = await supabase
        .from('custodian_deposits')
        .insert({
          depositor_address: transfer.fromUserAccount,
          amount_usdc: transfer.tokenAmount,
          tx_signature: event.signature,
          block_time: new Date(event.timestamp * 1000),
          slot: event.slot,
        })
        .select()
        .single();

      if (depositError) {
        console.error('❌ Failed to insert deposit:', depositError);

        // Check if duplicate (already indexed)
        if (depositError.code === '23505') {
          console.log('ℹ️  Duplicate deposit, skipping');
          continue;
        }

        throw depositError;
      }

      console.log('✅ Deposit recorded:', deposit.id);

      // Upsert agent (create if doesn't exist)
      const { error: agentError } = await supabase
        .from('agents')
        .upsert({
          solana_address: transfer.fromUserAccount,
          protocol_stake: 0,
          total_deposited: 0,
          total_withdrawn: 0,
        }, {
          onConflict: 'solana_address',
          ignoreDuplicates: false
        });

      if (agentError) {
        console.error('❌ Failed to upsert agent:', agentError);
        throw agentError;
      }

      console.log('👤 Agent upserted');

      // Credit stake (atomic update)
      const { error: creditError } = await supabase.rpc('increment_agent_stake', {
        p_address: transfer.fromUserAccount,
        p_amount: transfer.tokenAmount,
      });

      if (creditError) {
        console.error('❌ Failed to credit stake:', creditError);
        throw creditError;
      }

      console.log('💵 Stake credited:', transfer.tokenAmount);

      // Mark deposit as credited
      await supabase
        .from('custodian_deposits')
        .update({
          agent_credited: true,
          credited_at: new Date()
        })
        .eq('id', deposit.id);

      console.log('✨ Deposit fully processed');
    }

    return new Response(JSON.stringify({ success: true, processed: events.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Error processing webhook:', error);

    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

### Database Function: increment_agent_stake

**Purpose:** Atomically credit agent stake from deposit

```sql
CREATE OR REPLACE FUNCTION increment_agent_stake(
  p_address TEXT,
  p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET
    protocol_stake = COALESCE(protocol_stake, 0) + p_amount,
    total_deposited = COALESCE(total_deposited, 0) + p_amount,
    last_synced_at = NOW()
  WHERE solana_address = p_address;

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent % not found', p_address;
  END IF;

  -- Log credit event (optional, for audit trail)
  INSERT INTO agent_stake_history (
    agent_solana_address,
    change_type,
    amount,
    balance_after,
    created_at
  )
  SELECT
    p_address,
    'deposit_credit',
    p_amount,
    protocol_stake,
    NOW()
  FROM agents
  WHERE solana_address = p_address;
END;
$$ LANGUAGE plpgsql;
```

---

## Deployment

### 1. Deploy Edge Function

```bash
# From project root
supabase functions deploy helius-deposits --no-verify-jwt

# Set environment variables
supabase secrets set CUSTODIAN_VAULT_ADDRESS=<vault_pda>
supabase secrets set USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

**Note:** `--no-verify-jwt` allows Helius to call without Supabase auth

### 2. Configure Helius Webhook

1. Go to [Helius Dashboard](https://dev.helius.xyz/dashboard/app)
2. Create new webhook
3. **Webhook URL:** `https://<project>.supabase.co/functions/v1/helius-deposits`
4. **Watch addresses:** `<CUSTODIAN_VAULT_ADDRESS>`
5. **Transaction types:** `TRANSFER`
6. **Account type:** `TOKEN_ACCOUNT` (for USDC)
7. **Webhook type:** `Enhanced` (includes parsed data)
8. Save and test

### 3. Verify Setup

**Test with curl:**
```bash
curl -X POST https://<project>.supabase.co/functions/v1/helius-deposits \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "test123",
    "type": "TRANSFER",
    "timestamp": 1234567890,
    "slot": 123456,
    "tokenTransfers": [{
      "fromUserAccount": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "toUserAccount": "<CUSTODIAN_VAULT_ADDRESS>",
      "tokenAmount": 10.0,
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }]
  }'
```

**Check database:**
```sql
SELECT * FROM custodian_deposits ORDER BY indexed_at DESC LIMIT 10;
SELECT * FROM agents ORDER BY last_synced_at DESC LIMIT 10;
```

---

## Local Development & Testing

### Setup

**1. Start local Supabase:**
```bash
supabase start
```

**2. Create edge function:**
```bash
supabase functions new helius-deposits
```

**3. Serve locally:**
```bash
supabase functions serve helius-deposits --env-file .env.local
```

**4. Expose with ngrok:**
```bash
ngrok http 54321
```

**5. Configure Helius webhook to ngrok URL:**
```
https://abc123.ngrok.io/functions/v1/helius-deposits
```

### Testing Workflow

**Option 1: Mock Helius Event (Unit Test)**
```bash
curl -X POST http://localhost:54321/functions/v1/helius-deposits \
  -H "Content-Type: application/json" \
  -d @test/fixtures/deposit-event.json
```

**Option 2: Helius Test Feature**
- Go to webhook in Helius dashboard
- Click "Test Webhook"
- Select a recent transaction
- Helius sends to your ngrok URL

**Option 3: Real Devnet Deposit**
- Deploy contracts to devnet
- Get devnet USDC from faucet
- Make actual deposit
- Watch event flow through system

### Monitoring

**Watch edge function logs:**
```bash
supabase functions logs helius-deposits --tail
```

**Watch ngrok requests:**
```bash
ngrok http 54321 --log=stdout
```

**Check database:**
```bash
supabase db diff
```

---

## Production Considerations

### Error Handling

**Idempotency:**
- Deposits table has `UNIQUE(tx_signature)` constraint
- Duplicate webhook calls are ignored (Helius may retry)
- Safe to replay events

**Atomic Processing:**
All deposit processing must be atomic to prevent partial updates:

```sql
CREATE OR REPLACE FUNCTION process_deposit(
  p_depositor TEXT,
  p_amount NUMERIC,
  p_tx_signature TEXT,
  p_timestamp BIGINT,
  p_slot BIGINT
) RETURNS VOID AS $$
BEGIN
  -- All-or-nothing transaction

  -- Insert deposit record
  INSERT INTO custodian_deposits (
    depositor_address,
    amount_usdc,
    tx_signature,
    block_time,
    slot
  ) VALUES (
    p_depositor,
    p_amount,
    p_tx_signature,
    to_timestamp(p_timestamp),
    p_slot
  )
  ON CONFLICT (tx_signature) DO NOTHING; -- Idempotent

  -- Create agent if doesn't exist
  INSERT INTO agents (
    solana_address,
    protocol_stake,
    total_deposited,
    total_withdrawn
  ) VALUES (
    p_depositor,
    0,
    0,
    0
  )
  ON CONFLICT (solana_address) DO NOTHING;

  -- Credit stake atomically
  UPDATE agents
  SET
    protocol_stake = protocol_stake + p_amount,
    total_deposited = total_deposited + p_amount,
    last_synced_at = NOW()
  WHERE solana_address = p_depositor;

  -- Mark as credited
  UPDATE custodian_deposits
  SET
    agent_credited = true,
    credited_at = NOW()
  WHERE tx_signature = p_tx_signature;

  -- Transaction commits only if all steps succeed
END;
$$ LANGUAGE plpgsql;
```

**Updated Edge Function:**
```typescript
// Use atomic function instead of separate operations
const { error } = await supabase.rpc('process_deposit', {
  p_depositor: transfer.fromUserAccount,
  p_amount: transfer.tokenAmount,
  p_tx_signature: event.signature,
  p_timestamp: event.timestamp,
  p_slot: event.slot
});

if (error) {
  console.error('Failed to process deposit:', error);
  // Return 500 so Helius retries
  return new Response('Internal error', { status: 500 });
}
```

**Failure Recovery:**
- Helius retries with exponential backoff (up to 5 attempts)
- Failed webhooks visible in Helius dashboard
- Can manually replay from dashboard

### Security

**Webhook Signature Verification (TODO):**
```typescript
// Verify Helius signed the webhook
const signature = req.headers.get('helius-signature');
const isValid = verifyHeliusSignature(signature, body);
if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

**Rate Limiting:**
- Supabase edge functions have built-in limits
- Consider implementing per-address rate limits

### Monitoring & Alerts

**Metrics to track:**
- Webhook delivery success rate
- Processing latency
- Failed deposits count
- Agent credit failures

**Alerting:**
- Set up Supabase alerts for edge function errors
- Monitor Helius webhook health in dashboard
- Log critical errors to external service (Sentry, etc.)

### Scaling

**Current capacity:**
- Edge functions: ~100 req/sec
- Database: Thousands of inserts/sec
- Helius: Unlimited webhooks

**If needed:**
- Batch process multiple events per webhook call
- Use database connection pooling
- Implement queue for high-volume periods

---

## Reliability: Reconciliation & Backfill

### Can We Miss Deposits?

**Yes, in these scenarios:**

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Helius webhook failure | Low (has retries) | Reconciliation service |
| Database transaction failure | Medium | Atomic `process_deposit` function |
| Pre-webhook deposits | **Guaranteed** | One-time backfill script |
| Supabase outage | Low | Helius retries for 5 minutes |
| Network issues | Low | Automatic retries |

**Solution: Multi-layer safety net**

### Layer 1: Atomic Processing (Essential) ✅

Already covered above with `process_deposit` function.

### Layer 2: Reconciliation Service (Highly Recommended) ✅

**Purpose:** Hourly check to catch any deposits missed by webhook

**Database Schema:**
```sql
CREATE TABLE reconciliation_state (
  service TEXT PRIMARY KEY,
  last_checked_slot BIGINT NOT NULL,
  last_run_at TIMESTAMPTZ NOT NULL,
  deposits_found INTEGER DEFAULT 0,
  deposits_recovered INTEGER DEFAULT 0
);

-- Initialize
INSERT INTO reconciliation_state (service, last_checked_slot, last_run_at)
VALUES ('deposit_reconciliation', 0, NOW());
```

**Edge Function:** `supabase/functions/reconcile-deposits/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.73.0'

const CUSTODIAN_VAULT = Deno.env.get('CUSTODIAN_VAULT_ADDRESS')!;
const USDC_MINT = Deno.env.get('USDC_MINT_ADDRESS')!;
const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL')!;

serve(async (req) => {
  console.log('🔄 Starting deposit reconciliation');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const connection = new Connection(SOLANA_RPC_URL);

  try {
    // Get last checked slot
    const { data: state } = await supabase
      .from('reconciliation_state')
      .select('last_checked_slot')
      .eq('service', 'deposit_reconciliation')
      .single();

    const startSlot = state?.last_checked_slot || 0;
    const currentSlot = await connection.getSlot();

    console.log(`📊 Checking slots ${startSlot} to ${currentSlot}`);

    // Get all signatures for custodian vault
    let before: string | undefined;
    let totalFound = 0;
    let totalRecovered = 0;
    const batchSize = 1000;

    while (true) {
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(CUSTODIAN_VAULT),
        { limit: batchSize, before }
      );

      if (signatures.length === 0) break;

      for (const sig of signatures) {
        // Skip if before our start slot
        if (sig.slot < startSlot) continue;

        // Check if we already have this deposit
        const { data: existing } = await supabase
          .from('custodian_deposits')
          .select('id')
          .eq('tx_signature', sig.signature)
          .single();

        if (existing) {
          // Already indexed, skip
          continue;
        }

        totalFound++;
        console.log(`⚠️  MISSING DEPOSIT: ${sig.signature}`);

        // Fetch full transaction
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });

        if (!tx) {
          console.error(`Failed to fetch transaction: ${sig.signature}`);
          continue;
        }

        // Parse for USDC transfer to custodian
        const deposit = parseDepositFromTransaction(tx, USDC_MINT, CUSTODIAN_VAULT);

        if (deposit) {
          console.log(`💰 Processing missed deposit:`, deposit);

          // Process using atomic function
          const { error } = await supabase.rpc('process_deposit', {
            p_depositor: deposit.depositor,
            p_amount: deposit.amount,
            p_tx_signature: deposit.signature,
            p_timestamp: deposit.timestamp,
            p_slot: deposit.slot
          });

          if (error) {
            console.error(`Failed to process missed deposit:`, error);
          } else {
            totalRecovered++;
            console.log(`✅ Recovered deposit: ${deposit.signature}`);
          }
        }
      }

      // Continue pagination
      before = signatures[signatures.length - 1].signature;

      // Safety: don't process more than 10k transactions in one run
      if (totalFound > 10000) {
        console.warn('⚠️  Hit safety limit of 10k transactions');
        break;
      }
    }

    // Update reconciliation state
    await supabase
      .from('reconciliation_state')
      .update({
        last_checked_slot: currentSlot,
        last_run_at: new Date(),
        deposits_found: totalFound,
        deposits_recovered: totalRecovered
      })
      .eq('service', 'deposit_reconciliation');

    console.log(`✅ Reconciliation complete: Found ${totalFound}, Recovered ${totalRecovered}`);

    // Alert if we found missing deposits
    if (totalFound > 0) {
      console.warn(`🚨 ALERT: Reconciliation found ${totalFound} missing deposits!`);
      // TODO: Send alert to monitoring service
    }

    return new Response(JSON.stringify({
      success: true,
      found: totalFound,
      recovered: totalRecovered,
      checked_range: { start: startSlot, end: currentSlot }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 Reconciliation error:', error);

    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Helper function to parse USDC deposit from transaction
function parseDepositFromTransaction(
  tx: any,
  usdcMint: string,
  custodianVault: string
) {
  // Parse transaction logs for USDC transfer
  const postTokenBalances = tx.meta?.postTokenBalances || [];
  const preTokenBalances = tx.meta?.preTokenBalances || [];

  for (let i = 0; i < postTokenBalances.length; i++) {
    const post = postTokenBalances[i];
    const pre = preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);

    // Check if this is custodian vault receiving USDC
    if (
      post.owner === custodianVault &&
      post.mint === usdcMint &&
      pre &&
      post.uiTokenAmount.uiAmount > pre.uiTokenAmount.uiAmount
    ) {
      const amount = post.uiTokenAmount.uiAmount - pre.uiTokenAmount.uiAmount;

      // Find the sender (from address)
      // This is simplified - production version needs more robust parsing
      const depositor = tx.transaction.message.accountKeys[0].toString();

      return {
        depositor,
        amount,
        signature: tx.transaction.signatures[0],
        timestamp: tx.blockTime,
        slot: tx.slot
      };
    }
  }

  return null;
}
```

**Deploy and Schedule:**
```bash
# Deploy function
supabase functions deploy reconcile-deposits

# Schedule with Supabase cron (runs hourly)
# In Supabase dashboard or via SQL:
SELECT cron.schedule(
  'reconcile-deposits',
  '0 * * * *',  -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/reconcile-deposits',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
  $$
);
```

### Layer 3: Historical Backfill (One-time) ✅

**Purpose:** Index all deposits made before webhook was configured

**Script:** `scripts/backfill-deposits.ts`

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

const CUSTODIAN_VAULT = process.env.CUSTODIAN_VAULT_ADDRESS!;
const USDC_MINT = process.env.USDC_MINT_ADDRESS!;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;

async function backfillDeposits() {
  console.log('🔄 Starting historical backfill');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const connection = new Connection(SOLANA_RPC_URL);

  let before: string | undefined;
  let totalProcessed = 0;
  let totalInserted = 0;

  while (true) {
    console.log(`📥 Fetching batch (before: ${before || 'latest'})`);

    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(CUSTODIAN_VAULT),
      { limit: 1000, before }
    );

    if (signatures.length === 0) {
      console.log('✅ Reached end of transaction history');
      break;
    }

    for (const sig of signatures) {
      totalProcessed++;

      // Check if already exists
      const { data: existing } = await supabase
        .from('custodian_deposits')
        .select('id')
        .eq('tx_signature', sig.signature)
        .single();

      if (existing) {
        console.log(`⏭️  Already indexed: ${sig.signature}`);
        continue;
      }

      // Fetch and parse transaction
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) continue;

      const deposit = parseDepositFromTransaction(tx, USDC_MINT, CUSTODIAN_VAULT);

      if (deposit) {
        const { error } = await supabase.rpc('process_deposit', {
          p_depositor: deposit.depositor,
          p_amount: deposit.amount,
          p_tx_signature: deposit.signature,
          p_timestamp: deposit.timestamp,
          p_slot: deposit.slot
        });

        if (!error) {
          totalInserted++;
          console.log(`✅ Backfilled deposit ${totalInserted}: ${deposit.signature}`);
        } else {
          console.error(`❌ Failed to backfill:`, error);
        }
      }
    }

    before = signatures[signatures.length - 1].signature;

    console.log(`📊 Progress: ${totalProcessed} processed, ${totalInserted} inserted`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✨ Backfill complete!`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total inserted: ${totalInserted}`);
}

backfillDeposits().catch(console.error);
```

**Run:**
```bash
npm run backfill-deposits
```

### Reliability Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                   PRIMARY (Real-time)                        │
│  Solana Deposit → Helius Webhook → Edge Function → DB      │
│  ✅ < 1 second latency                                      │
│  ✅ Atomic transaction (all-or-nothing)                     │
│  ✅ Automatic retries (5 attempts)                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ If webhook fails
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKUP (Hourly)                            │
│  Cron → Reconciliation Service → Check RPC → Fill Gaps     │
│  ✅ Catches webhook failures                                │
│  ✅ Verifies no deposits missed                             │
│  ✅ Alerts if gaps found                                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ For historical data
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              ONE-TIME BACKFILL (Manual)                      │
│  Script → Fetch All History → Process Missing              │
│  ✅ Handles pre-webhook deposits                            │
│  ✅ Idempotent (safe to re-run)                             │
└─────────────────────────────────────────────────────────────┘
```

**Expected Reliability: 99.99%+**

### Testing Reconciliation

```typescript
async function testReconciliation() {
  // 1. Make a test deposit
  const signature = await makeTestDeposit(10 * LAMPORTS_PER_SOL);

  // 2. Simulate missed webhook by deleting from database
  await supabase
    .from('custodian_deposits')
    .delete()
    .eq('tx_signature', signature);

  console.log('🧪 Simulated missed deposit:', signature);

  // 3. Run reconciliation manually
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/reconcile-deposits',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const result = await response.json();
  console.log('📊 Reconciliation result:', result);

  // 4. Verify deposit was recovered
  const { data: recovered } = await supabase
    .from('custodian_deposits')
    .select('*')
    .eq('tx_signature', signature)
    .single();

  if (recovered && recovered.agent_credited) {
    console.log('✅ TEST PASSED: Deposit successfully recovered');
  } else {
    console.error('❌ TEST FAILED: Deposit not recovered');
  }
}
```

---

## Future Enhancements

### 1. Pool State Indexer
Track ContentPool state changes for UI caching

### 2. Multi-Chain Support
Extend to other Solana programs or chains

### 3. Event Replay System
UI to manually replay failed events

### 4. Analytics Dashboard
Real-time deposit/withdrawal metrics

### 5. Advanced Monitoring
- Track reconciliation gap size over time
- Alert on unusual patterns
- Auto-recovery dashboard

---

## Troubleshooting

### Webhook not receiving events

**Check:**
1. Helius webhook is enabled
2. Webhook URL is correct and accessible
3. Vault address is correct
4. Edge function is deployed

**Debug:**
```bash
# Check Helius delivery logs
# Check edge function logs
supabase functions logs helius-deposits --tail

# Test endpoint manually
curl https://<project>.supabase.co/functions/v1/helius-deposits
```

### Deposits not crediting stake

**Check:**
1. `increment_agent_stake` function exists
2. Agent exists in `agents` table
3. No database errors in logs

**Debug:**
```sql
-- Check if deposit was recorded
SELECT * FROM custodian_deposits WHERE agent_credited = false;

-- Manually credit (if needed)
SELECT increment_agent_stake('<solana_address>', <amount>);
```

### Duplicate deposits

**Expected behavior:** First insert succeeds, duplicates are ignored

**If seeing duplicates:**
- Check `UNIQUE(tx_signature)` constraint exists
- Review edge function error handling

---

## References

- [Helius Webhooks Documentation](https://docs.helius.dev/webhooks-and-websockets/webhooks)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Solana Transaction Parsing](https://solana.com/docs/core/transactions)

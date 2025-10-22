# Stake System Architecture

**Status:** ✅ READY FOR IMPLEMENTATION
**Last Updated:** 2025-01-22

**Quick Links:**
- 📋 **[IMPLEMENTATION GUIDE](./stake-system-IMPLEMENTATION-GUIDE.md)** ← START HERE for step-by-step deployment
- 🔍 [Dependency Analysis](./stake-system-dependencies.md) - Resolution details

---

## Core Architecture

### On-Chain Source of Truth

Stake balances live **on-chain** in VeritasCustodian contract. Database mirrors for display only.

```
Trade → 2% skim → VeritasCustodian vault
  ↓
Event indexer updates agents.total_stake (read-only mirror)
```

**Key files:**
- `src/services/event-processor.service.ts` - Event indexing
- `supabase/functions/protocol-beliefs-stake-redistribution/index.ts` - BTS redistribution
- `supabase/functions/sync-stake-from-chain/index.ts` - Manual sync

---

## Five Rules

### 1. Lock Per Pool (Only While Position Open)

```typescript
lock_P = 2% × last_buy_amount_P
// Applied only if token_balance_P > 0
// Full exit → lock_P ignored immediately
```

### 2. Global At-Risk Stake

```typescript
S = agents.total_stake  // One global pot
// Can increase (BTS gains) or decrease (BTS penalties)
// Locked stake NOT ring-fenced
```

### 3. Withdrawal Rule

```typescript
L = Σ lock_P WHERE token_balance_P > 0
withdrawable = max(0, S - L)
// If S < L → under-staked → can't withdraw until covered
```

### 4. Coverage Guard (No Top-Ups)

```typescript
// On buy in pool P with amount B:
w = 2% × B
S_after = S + w
L_after = (current locks excluding P) + w

if (S_after < L_after) reject("insufficient stake");
// Every belief must be immediately covered
```

### 5. Automatic Lock Release

```typescript
// When token_balance_P = 0:
// Lock ignored via WHERE token_balance > 0 filter
// No manual cleanup needed
```

---

## BTS Integration

**Zero-sum redistribution at epoch settlement:**

```typescript
// In protocol-beliefs-stake-redistribution/index.ts

for (const submission of submissions) {
  const currentStake = agent.total_stake ?? 0;

  if (submission.bts_score < 0) {
    // Penalty
    const penalty = Math.abs(submission.bts_score) * submission.stake_backing;
    newStake = Math.max(0, currentStake - penalty);  // ⚠️ CLAMP AT ZERO
  } else if (submission.bts_score > 0) {
    // Reward
    newStake = currentStake + reward;
  }

  await supabase.from('agents').update({ total_stake: newStake }).eq('id', agent.id);
}
```

**Why clamp at zero:**
- No negative balances (users can't owe protocol)
- Poor performers → stake = 0 → can't trade until deposit
- Self-correcting system

---

## Database Schema

### Extend Existing Table

```sql
-- supabase/migrations/20251024000001_add_belief_locks_to_balances.sql

ALTER TABLE user_pool_balances
ADD COLUMN last_buy_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN belief_lock NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX idx_user_pool_balances_user_open ON user_pool_balances(user_id)
  WHERE token_balance > 0;
```

**Why user_pool_balances:**
- Already tracks user × pool × token_balance
- No new table needed
- Lock auto-releases when token_balance → 0

---

## Implementation

### Calculate Skim

```typescript
// src/lib/stake/calculate-skim.ts

export async function calculateStakeSkim(params: StakeSkimParams): Promise<number> {
  if (params.tradeType === 'sell') return 0;

  // Get agent's current stake
  const { data: agent } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('solana_address', params.walletAddress)
    .single();

  const currentStake = (agent.total_stake ?? 0) * 1_000_000;

  // Get sum of locks from open positions only
  const { data: openPositions } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', params.userId)
    .gt('token_balance', 0);  // Only open positions

  const otherPoolsLock = (openPositions || [])
    .filter(p => p.pool_address !== params.poolAddress)
    .reduce((sum, p) => sum + parseFloat(p.belief_lock), 0);

  const thisBuyLock = params.tradeAmount * 0.02;
  const newRequiredLock = otherPoolsLock + thisBuyLock;

  // Net skim = shortfall
  return Math.max(0, newRequiredLock - currentStake);
}
```

### Record Trade

```typescript
// app/api/trades/record/route.ts

if (body.trade_type === 'buy') {
  const beliefLock = parseFloat(body.usdc_amount) * 0.02;

  await supabase.from('user_pool_balances').upsert({
    user_id: body.user_id,
    pool_address: body.pool_address,
    token_balance: supabase.raw(`COALESCE(token_balance, 0) + ${parseFloat(body.token_amount)}`),
    last_buy_amount: parseFloat(body.usdc_amount),
    belief_lock: beliefLock,
  }, { onConflict: 'user_id,pool_address' });

  // agents.total_stake updated by event indexer

} else if (body.trade_type === 'sell') {
  await supabase.from('user_pool_balances').update({
    token_balance: supabase.raw(`token_balance - ${parseFloat(body.token_amount)}`),
  })
  .eq('user_id', body.user_id)
  .eq('pool_address', body.pool_address);
  // belief_lock unchanged (unless token_balance → 0)
}
```

### Calculate Withdrawable

```typescript
// app/api/custodian/withdrawable/route.ts

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromAuth(req);

  const { data: user } = await supabase
    .from('users')
    .select('agent_id, agents!inner(total_stake)')
    .eq('id', userId)
    .single();

  const totalStake = (user.agents.total_stake ?? 0) * 1_000_000;

  const { data: openPositions } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', userId)
    .gt('token_balance', 0);  // Only open positions

  const requiredLock = (openPositions || [])
    .reduce((sum, p) => sum + parseFloat(p.belief_lock), 0);

  const withdrawable = Math.max(0, totalStake - requiredLock);

  return NextResponse.json({ totalStake, requiredLock, withdrawable });
}
```

---

## Testing Checklist

**Critical paths:**
- [ ] Buy with sufficient stake → success
- [ ] Buy without sufficient stake → reject
- [ ] Sell partial position → lock unchanged
- [ ] Sell full position → lock ignored (via WHERE filter)
- [ ] Withdrawable calculation excludes closed positions
- [ ] BTS redistribution clamps at zero
- [ ] Multiple concurrent positions add locks correctly

---

## Why This Works

1. **No stranded stake** - Full exit instantly frees stake
2. **No top-ups** - Coverage enforced at submission
3. **Incentive aligned** - Voice (skim) = Risk (stake at risk)
4. **Self-correcting** - Poor performers naturally constrained
5. **Simple** - One stake balance, automatic lock release

---

**Decision rationale:** At-risk stake (not ring-fenced) maintains honest-weight property while enabling clean exit mechanics.

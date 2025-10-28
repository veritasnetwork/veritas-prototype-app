# Underwater Positions: User Experience Design

**Date:** 2025-10-27
**Status:** ✅ Implemented
**Related:** [STAKE_INVARIANT_VIOLATION_POSTMORTEM.md](./STAKE_INVARIANT_VIOLATION_POSTMORTEM.md)

---

## Problem

When users have underwater positions (from BTS redistribution losses), attempting new trades can require excessive skim (>20%, potentially 100%+ of trade amount). This creates terrible UX:

### Example Bad Experience

```
User: "I want to buy $100 of LONG tokens"
System: *charges $200 skim*
User: "WTF?! 😡"
```

**Why this happens:**
- User has $200 lock from previous trade
- Lost everything in BTS redistribution → $0 stake
- Wants to trade $100 in a DIFFERENT pool
- System needs: $200 (old lock) + $2 (new lock) = $202 stake
- Current stake: $0
- Required skim: $202 (202% of trade!)

---

## Solution: Soft Validation with Helpful UI

Instead of either:
- ❌ **Silently charging** 200% skim (user rage quits)
- ❌ **Hard blocking** with error message (confusing)

We do:
- ✅ **Detect excessive skim** (>20% threshold)
- ✅ **Show helpful modal** explaining the situation
- ✅ **Provide actionable guidance** (close positions to fix)
- ✅ **Allow proceeding** if user really wants to

---

## Implementation

### 1. Backend Detection

**File:** [app/api/trades/prepare/route.ts](../app/api/trades/prepare/route.ts)

```typescript
// Check if skim > 20% of trade
if (tradeType === 'buy' && stakeSkim > 0) {
  const skimPercentage = (stakeSkim / amount) * 100;

  if (skimPercentage > 20) {
    // Get underwater position details
    const underwaterCheck = await checkUnderwaterPositions(user.id, user.agent_id);

    // Return 202 Accepted (warning, not error)
    return NextResponse.json({
      warning: 'excessive_skim',
      skimPercentage,
      underwaterInfo: { /* positions, deficit, etc */ },
      recommendation: 'Close some positions to reduce locks...',
      canProceed: true,
    }, { status: 202 });
  }
}
```

**Key design choices:**
- **202 status** (Accepted with warning) not 400 (error)
- **Include position details** so user knows what to close
- **Clear recommendation** on how to fix
- **Allow proceeding** for power users

### 2. Underwater Position Helper

**File:** [src/lib/stake/check-underwater-positions.ts](../src/lib/stake/check-underwater-positions.ts)

```typescript
export async function checkUnderwaterPositions(
  userId: string,
  agentId: string
): Promise<UnderwaterCheck> {
  // Returns:
  // - isUnderwater: boolean
  // - currentStake, totalLocks, deficit
  // - positions: Array<{ poolAddress, side, lock, balance }>
}
```

**Usage:**
```typescript
const check = await checkUnderwaterPositions(userId, agentId);

if (check.isUnderwater) {
  console.log(`Deficit: $${check.deficit / 1_000_000}`);
  console.log('Positions to close:', check.positions);
}
```

### 3. User-Friendly Modal

**File:** [src/components/trading/UnderwaterPositionsModal.tsx](../src/components/trading/UnderwaterPositionsModal.tsx)

**Features:**
- 🎨 **Visual design** - Not scary, just informative
- 📊 **Shows all positions** - Click to navigate to post
- 💡 **Clear explanation** - Why skim is high
- ✅ **Actionable** - "Close positions" vs "Proceed anyway"
- 🔒 **Confirmation required** - Must check box to proceed

**Modal structure:**
```
┌─────────────────────────────────────────┐
│ ⚠️  High Skim Detected                  │
├─────────────────────────────────────────┤
│ 💸 Excessive Skim Required              │
│    Trade: $100                          │
│    Skim: $202 (202%)                    │
│                                         │
│ 📊 Your Active Positions                │
│    ┌─ LONG ───────────── $200 locked   │
│    │  Pool A • 500 tokens              │
│    └─ Click to close ────────────────→ │
│                                         │
│ 💡 Recommended Action                   │
│    Close positions you no longer        │
│    believe in to free locked stake      │
│                                         │
│ □ I understand and want to proceed      │
│                                         │
│ [Close Positions First] [Proceed Anyway]│
└─────────────────────────────────────────┘
```

### 4. Hook Integration

**File:** [src/hooks/useBuyTokens.ts](../src/hooks/useBuyTokens.ts)

```typescript
// In buyTokens function
const prepareResponse = await fetch('/api/trades/prepare', ...);

// Handle warning (202 status)
if (prepareResponse.status === 202) {
  const warningData = await prepareResponse.json();

  return {
    requiresConfirmation: true,
    warning: warningData,
  };
}

// Normal flow continues...
```

**Component usage:**
```typescript
const { buyTokens } = useBuyTokens();
const [underwaterWarning, setUnderwaterWarning] = useState(null);

const handleBuy = async () => {
  const result = await buyTokens(postId, poolAddress, amount, side);

  if (result?.requiresConfirmation) {
    // Show modal instead of completing trade
    setUnderwaterWarning(result.warning);
    return;
  }

  // Trade succeeded
};

return (
  <>
    <button onClick={handleBuy}>Buy Tokens</button>

    <UnderwaterPositionsModal
      isOpen={!!underwaterWarning}
      onClose={() => setUnderwaterWarning(null)}
      onProceed={() => {
        // User confirmed, proceed with trade
        // (would need to call prepare again with force flag)
      }}
      {...underwaterWarning}
    />
  </>
);
```

---

## User Flow Examples

### Scenario 1: Underwater from Losses

**State:**
- Lost $200 in BTS redistribution
- Stake: $0, Locks: $200

**User action:** Try to buy $100 in new pool

**Experience:**
1. Click "Buy $100 LONG"
2. Modal appears: "⚠️ High Skim Detected"
3. Shows: "This would require $202 skim (202%)"
4. Lists underwater position: "LONG in Pool A - $200 locked"
5. Recommends: "Close this position first"
6. User clicks link → Navigates to Pool A
7. Sells position → Frees $200 lock
8. Returns, buys $100 with normal 2% skim ✅

### Scenario 2: Temporary Underwater (Self-Healing)

**State:**
- Stake: $10, Locks: {A: $20 LONG, B: $10 SHORT}
- Underwater by $20

**User action:** Buy $100 LONG in same Pool A

**Experience:**
1. Click "Buy $100 LONG"
2. **NO WARNING!** (skim is only $2)
3. Trade executes normally
4. New state: Stake: $12, Locks: {A: $2 LONG, B: $10 SHORT}
5. Now solvent! ✅

**Why no warning:** Lock replacement means the $20 lock gets replaced with $2, so skim is only $2 (2% of trade).

### Scenario 3: Power User Proceeds Anyway

**State:**
- Stake: $0, Locks: $200

**User action:** Buy $100 in new pool, wants to proceed despite warning

**Experience:**
1. Click "Buy $100 LONG"
2. Modal appears with warning
3. User checks box: "I understand..."
4. Clicks "Proceed Anyway"
5. Trade executes with $202 skim
6. New state: Stake: $202, Locks: $202 ✅ (solvent)

---

## Configuration

### Skim Threshold

**Current:** 20%
**Location:** `app/api/trades/prepare/route.ts:192`

```typescript
if (skimPercentage > 20) {  // Configurable threshold
  // Show warning
}
```

**Rationale:**
- Normal skim: 2%
- 20% = 10x normal
- Rare but possible in legitimate scenarios:
  - User has multiple small positions
  - Opening large position in new pool
  - Should trigger review but not block

**Tuning recommendations:**
- **15%:** More aggressive warnings (fewer surprise charges)
- **25%:** Less aggressive (fewer modals, but riskier)
- **50%:** Only warn on truly excessive cases

### Future Enhancement: Dynamic Threshold

```typescript
// Could vary by user level
const threshold = user.isVerified ? 30 : 15;  // Verified users get more leeway
const threshold = user.tradeCount > 100 ? 30 : 15;  // Experienced traders
```

---

## Analytics & Monitoring

### Track Warning Frequency

```sql
-- How often do users hit the warning?
SELECT
  COUNT(*) as warning_count,
  COUNT(DISTINCT user_id) as affected_users,
  AVG(skim_percentage) as avg_skim_pct
FROM trade_prepare_logs
WHERE response_status = 202;  -- Warning status
```

### Track User Actions

```typescript
// Log what users do when shown the modal
trackEvent('underwater_warning_shown', {
  skimPercentage,
  deficit,
  positionCount,
});

trackEvent('underwater_warning_action', {
  action: 'closed' | 'proceeded' | 'cancelled',
  skimPercentage,
});
```

### Expected Metrics

- **Warning rate:** <5% of trades (most users solvent)
- **Close rate:** ~70% close positions (good UX)
- **Proceed rate:** ~20% proceed anyway (power users)
- **Cancel rate:** ~10% just give up (minimize this)

---

## Testing

### Manual Test

```bash
# 1. Create underwater position
# Trade $10,000 LONG → Lock $200
# Run BTS redistribution with score = -1 → Lose $200

# 2. Try to trade $100 in different pool
# Should see modal with 202% skim warning

# 3. Close original position
# Should be able to trade normally
```

### Automated Test

```typescript
describe('Underwater UX', () => {
  it('shows warning when skim > 20%', async () => {
    // Setup: Create underwater agent
    const agent = await createAgent({ stake: 0 });
    const user = await createUser({ agentId: agent.id });
    await createPosition({ userId: user.id, lock: 200_000_000 });

    // Attempt trade
    const response = await POST('/api/trades/prepare', {
      userId: user.id,
      amount: 100_000_000,  // $100
    });

    expect(response.status).toBe(202);  // Warning, not error
    expect(response.body.warning).toBe('excessive_skim');
    expect(response.body.skimPercentage).toBeGreaterThan(20);
    expect(response.body.underwaterInfo.isUnderwater).toBe(true);
  });

  it('allows normal trades when skim reasonable', async () => {
    // Setup: Solvent user
    const agent = await createAgent({ stake: 10_000_000 });
    const user = await createUser({ agentId: agent.id });

    const response = await POST('/api/trades/prepare', {
      userId: user.id,
      amount: 100_000_000,
    });

    expect(response.status).toBe(200);  // Normal success
    expect(response.body.transaction).toBeDefined();
  });
});
```

---

## Future Improvements

### 1. Proactive Notifications

Warn users BEFORE they try to trade:

```typescript
// On dashboard load
if (userIsUnderwater) {
  showBanner('⚠️ You have underwater positions. Close them to enable trading.');
}
```

### 2. One-Click Close All

```typescript
<button onClick={closeAllUnderwaterPositions}>
  Close All Underwater Positions ($200 locked)
</button>
```

### 3. Suggested Replacement Trades

```typescript
// Instead of warning, suggest better option
{
  warning: 'Skim is high for this pool',
  suggestion: {
    message: 'Buy in Pool A instead to replace your lock (2% skim)',
    poolAddress: 'Pool A',
    sameSide: true,
  }
}
```

### 4. Skim Calculator Widget

```typescript
// Show before user submits
<SkimPreview
  currentStake={20}
  currentLocks={30}
  proposedTrade={{ pool: 'B', amount: 100 }}
  skimWouldBe={102}  // $102 skim
  recommendation="Trade in Pool A instead (2% skim)"
/>
```

---

## Conclusion

**Design philosophy:** Treat underwater positions as a temporary state that users can easily recover from, not a critical error.

**Key principles:**
1. **Transparency** - Show exactly why skim is high
2. **Actionability** - Clear path to fix (close positions)
3. **Flexibility** - Allow proceeding if user wants to
4. **Education** - Explain the mechanics, not just block

**Result:** Users understand what's happening and can make informed decisions, instead of being confused or frustrated by high fees.

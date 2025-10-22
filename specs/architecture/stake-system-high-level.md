# Stake System: High-Level Overview

**Purpose:** Align voice in consensus with capital at risk  
**Status:** ✅ Design Complete  
**Last Updated:** 2025-01-22

**Docs:**
- 📖 [STAKE-MECHANICS.md](./STAKE-MECHANICS.md) - Detailed design  
- 📋 [STAKE-IMPLEMENTATION.md](./STAKE-IMPLEMENTATION.md) - Implementation guide

---

## What Is It?

**Voice = Risk**: To influence consensus, users must stake capital that's won or lost based on belief quality.

When you buy tokens, 2% is locked as collateral. Good beliefs earn rewards, bad beliefs pay penalties.

---

## Two Numbers

**1. Global Stake (per user)**
```
agents.total_stake
```
Your at-risk capital across all pools.

Changes: `+` skims, `+` BTS rewards, `-` BTS penalties, `-` withdrawals

**2. Per-Pool Lock (per position)**
```
user_pool_balances.belief_lock = 2% × last_buy_amount
```
Your voice in that pool's consensus.

LONG + SHORT locks sum (gross, not net).

---

## The Invariant

```
total_stake ≥ Σ(belief_lock WHERE token_balance > 0)
```

Enforced on buys via auto-skim. Can violate temporarily after BTS losses (self-healing allowed).

---

## Key Properties

- **No forced liquidations** - Users self-heal by closing positions
- **Voice = Risk guarantee** - Max loss per epoch = Σ locks
- **Auto-collateral** - 2% skim on every buy
- **Lock replacement** - New buy replaces old lock (not accumulated)
- **Clean exit** - Sell to zero instantly frees lock

---

## BTS Integration

**Each epoch:**
1. Calculate BTS scores (-1 to +1)
2. Get gross locks per user (LONG + SHORT)
3. Raw deltas: `delta = score × lock`
4. Scale winners to match losers: `λ = losses / gains`
5. Apply: losers pay full, winners share pot × λ
6. Update stakes, locks unchanged

**Result:** Zero-sum, max loss = locks.

---

## Why This Design?

**Old (broken):** Normalized weights → `max loss = lock ÷ 50` → insolvency  
**New (fixed):** Absolute weights + λ-scaling → `max loss = lock` → solvent

---

## Implementation Status

- ✅ Design finalized
- ⏳ Implementation pending

See [STAKE-IMPLEMENTATION.md](./STAKE-IMPLEMENTATION.md) for next steps.

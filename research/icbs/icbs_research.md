# ICBS Research: Settlement and Redemption Mechanisms

## Overview

This document outlines the complete ICBS lifecycle and explores the mechanics of settlement, redemption, and liquidity provision in the Euclidean norm Inversely Coupled Bonding Surface.

## Single-Bucket vs Two-Bucket Architecture

### Single-Bucket (Current Implementation)

In the single-bucket design, all funds (trader deposits and LP deposits) go into one vault:
- `vault_balance` contains both trader and LP funds
- `λ = vault_balance / ||s_virtual||`
- LPs receive directional tokens (LONG/SHORT)
- LPs take on q-risk (exposure to market prediction changes)
- Fully solvent but not risk-neutral for LPs

### Two-Bucket (Proposed for Risk-Neutral LPs)

In the two-bucket design, trader and LP funds are separated:
- `trader_vault`: Backs LONG/SHORT token claims, drives pricing
- `lp_vault`: LP principal only, separate accounting
- `λ = trader_vault / ||s_virtual||` (excludes LP funds)
- `effective_liquidity = trader_vault + lp_vault` (for pricing depth only)
- LPs receive LP share tokens (not directional)
- LPs are fully risk-neutral (no q-risk)

**Key tradeoff**: Two-bucket provides virtual depth (better pricing) but not increased payout capacity (still bounded by `trader_vault`).

The rest of this document describes single-bucket mechanics first, then proposes the two-bucket enhancement for risk-neutral LPs.

## Core ICBS Mechanics (Single-Bucket)

### The Cost Function

The Euclidean norm ICBS uses:
```
C(s_LONG, s_SHORT) = λ · √(s²_LONG + s²_SHORT)
```

Where:
- `s_LONG`, `s_SHORT`: Token supplies
- `λ`: Scaling constant (derived from vault and virtual supplies)

### Marginal Prices

Prices emerge as partial derivatives:
```
p_LONG = ∂C/∂s_LONG = λ · s_LONG / √(s²_LONG + s²_SHORT)
p_SHORT = ∂C/∂s_SHORT = λ · s_SHORT / √(s²_LONG + s²_SHORT)
```

### Virtual Reserves

Reserves are defined as `r = s · p`:
```
r_LONG = s_LONG · p_LONG
r_SHORT = s_SHORT · p_SHORT
TVL = r_LONG + r_SHORT = λ · √(s²_LONG + s²_SHORT)
```

### The Fundamental Invariant

**TVL = C** (the on-manifold property)

This ensures solvency: total claimable value always matches what the vault holds.

## Lambda Dynamics

### Lambda is Derived, Not Stored

In our implementation, lambda is computed dynamically.

**Single-bucket**:
```rust
λ = vault_balance / ||s_virtual||
```

**Two-bucket** (for risk-neutral LPs):
```rust
λ = trader_vault / ||s_virtual||  // Excludes lp_vault
```

Where:
```
s_virtual_LONG = s_display_LONG / σ_LONG
s_virtual_SHORT = s_display_SHORT / σ_SHORT
||s_virtual|| = √(s²_virtual_LONG + s²_virtual_SHORT)
```

### Lambda Constancy in On-Manifold ICBS

**Key Insight**: λ = vault / ||ŝ|| is ALWAYS derived, never stored.

**During On-Manifold Trading:**
- Vault and virtual norm scale proportionally: `norm₂ = norm₁ × (V₂/V₁)`
- λ = vault / norm **stays constant** through all trades
- All trade prices bounded by this constant λ
- Both buys and sells preserve λ (if on-manifold)

**During Binary Settlement (f_winner = 1, f_loser = 0):**
- Sigma adjustment transforms winning virtual supply to equal pre-settlement norm
- s_v_winner' = √(s_L² + s_S²) = norm_before
- norm_after = s_v_winner' = norm_before
- λ = vault / norm **stays constant** through settlement
- Redemption rate = λ (exactly!)

**Lambda ONLY changes when:**
1. **Off-manifold trades** (bug in current code - needs fixing)
2. **Fees extracted from vault** without proportional norm adjustment
3. **Fractional settlement** (f_winner < 1, f_loser > 0) - norm reweights non-proportionally
4. **Two-bucket architecture**: λ = trader_vault / norm (excludes LP vault)

**Profit Guarantee**: With on-manifold trading + binary settlement + no fees:
- Trade prices < λ (always)
- Redemption = λ (exactly)
- **Directionally correct traders CANNOT lose** (guaranteed profit)

## Settlement Mechanism (Sigma Virtualization)

### The Settlement Process

Instead of minting/burning tokens or moving vault funds, we adjust **virtualization parameters** (sigma):

```rust
// Calculate settlement factors
f_LONG = bd_score / q
f_SHORT = (1 - bd_score) / (1 - q)

// Update sigma by SQUARE ROOT of factors
σ_new_LONG = σ_old_LONG / √f_LONG
σ_new_SHORT = σ_old_SHORT / √f_SHORT
```

### Why Square Roots?

Since reserves ∝ s²_virtual (from the Euclidean norm), scaling sigma by √f makes:
- Virtual supply scales by √f
- Virtual supply² scales by f
- Reserves scale by exactly f ✓

### Reserve Rebalancing

After sigma adjustment, reserves are recalculated:
```rust
r_LONG_new = r_LONG_old × f_LONG
r_SHORT_new = r_SHORT_old × f_SHORT

// Recouple to maintain solvency
// Note: vault_balance is trader_vault in two-bucket design
if r_LONG_new + r_SHORT_new ≠ vault_balance:
    // Proportionally adjust to match vault
    scale = vault_balance / (r_LONG_new + r_SHORT_new)
    r_LONG_final = r_LONG_new × scale
    r_SHORT_final = r_SHORT_new × scale
```

**Important**: In single-bucket, `vault_balance` includes all funds. In two-bucket, settlement only uses `trader_vault` and ignores `lp_vault`.

### What Settlement Does

1. **Token supplies**: Unchanged (no mint/burn)
2. **Vault balance**: Unchanged (no transfers)
3. **Sigma parameters**: Adjusted by √f
4. **Virtual supplies**: Changed via new sigma
5. **Prices**: Changed (p = λs_v / ||s_v||)
6. **Reserves**: Rebalanced to reflect outcome

### Solvency Guarantee

The recouple step ensures:
```
r_LONG + r_SHORT = vault_balance (always)
```

## Redemption Mechanism (Proposed)

### The Problem with Selling

If users must sell tokens back to the curve after settlement:
- Early exiters get better prices
- Late exiters get worse prices (depleted liquidity)
- Order matters significantly
- Not a "true" settlement in prediction market sense

### Direct Redemption Solution

After settlement, enable **simultaneous pro-rata redemption**:

```rust
pub fn enable_final_redemption(ctx: Context<EnableRedemption>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Lock redemption rates at settled prices
    pool.redemption_enabled = true;
    pool.long_redemption_rate = pool.r_long / pool.s_long;  // USDC per token
    pool.short_redemption_rate = pool.r_short / pool.s_short;

    Ok(())
}

pub fn redeem_tokens(ctx: Context<RedeemTokens>) -> Result<()> {
    require!(pool.redemption_enabled, "Redemption not enabled");

    let user_long_tokens = // from user's token account
    let user_short_tokens = // from user's token account

    // Calculate pro-rata share
    let payout =
        (user_long_tokens × pool.long_redemption_rate) +
        (user_short_tokens × pool.short_redemption_rate);

    // Transfer USDC from vault to user
    transfer_from_vault(payout)?;

    // Burn user's tokens
    burn_tokens(user_long_tokens, user_short_tokens)?;

    Ok(())
}
```

### Key Properties

1. **Order-independent**: Everyone gets the same rate per token
2. **Solvent**: Sum of all redemptions = vault balance
3. **Fair**: Token value reflects settlement outcome
4. **Simultaneous**: All users can redeem at the same time

### Example: Complete Settlement and Redemption

```
Initial State:
- Vault: $100
- Market at q = 0.6 (60% LONG prediction)
- r_LONG = $60, r_SHORT = $40
- 100 LONG tokens, 100 SHORT tokens

Users:
- Alice: 40 LONG tokens (bought at q=0.5 for $20)
- Bob: 30 LONG tokens (bought at q=0.6 for $18)
- Charlie: 30 LONG tokens (bought at q=0.7 for $21)
- Dave: 100 SHORT tokens (original holder, $40)

Settlement at BD = 0.7 (70% relevance):
- f_LONG = 0.7/0.6 = 1.167
- f_SHORT = 0.3/0.4 = 0.75
- r_LONG_new = $60 × 1.167 = $70
- r_SHORT_new = $40 × 0.75 = $30

Redemption rates:
- LONG: $70 / 100 = $0.70 per token
- SHORT: $30 / 100 = $0.30 per token

Payouts:
- Alice: 40 × $0.70 = $28 (started with $20 → 1.4x return)
- Bob: 30 × $0.70 = $21 (started with $18 → 1.17x return)
- Charlie: 30 × $0.70 = $21 (started with $21 → 1.0x return)
- Dave: 100 × $0.30 = $30 (started with $40 → 0.75x return)

Total: $28 + $21 + $21 + $30 = $100 ✓
```

### Return Multiple Analysis

Each user's return depends on:
1. **Entry price** (which embeds market q at time of entry)
2. **Settlement outcome** (BD score)
3. **Token share** of the pool

The return multiple naturally emerges:
```
Return = (redemption_rate × tokens) / initial_investment
       = (settled_reserve / total_supply × tokens) / cost_basis
```

Notice:
- Alice entered at q=0.5, market settled with LONG at 0.7 → good return
- Bob entered at q=0.6, close to settlement → moderate return
- Charlie entered at q=0.7, market settled at 0.7 → neutral return
- Dave held SHORT, market went against him → loss

## Liquidity Provider Mechanisms

### Single-Vault Directional LPs (baseline)

When LPs add liquidity at market ratio q:
```
LP deposits D dollars:
- Allocate D×q to LONG
- Allocate D×(1-q) to SHORT
- Receive LONG and SHORT tokens
```

**Problem**: LPs hold directional tokens, exposed to:
1. **Directional risk (q-risk)**: Which side wins at settlement
2. **Path-dependent returns**: Entry q vs settlement outcome determines profit/loss
3. **Settlement impact**: Token values change when σ adjusts (even though λ stays constant in binary settlement)

### Why LPs Aren't Risk-Neutral (Single-Bucket)

Even depositing at market ratio q:
- LPs receive fungible directional tokens (LONG/SHORT)
- These tokens gain/lose value based on settlement outcome
- LP return ≠ principal unless market perfectly predicted outcome at their entry
- **Note**: In on-manifold + binary settlement, λ stays constant, but directional token holdings still create risk

### LP Withdrawal and Solvency (single vault)

#### The Key Insight: Proportional Withdrawal Preserves Market State

When LPs withdraw liquidity **proportionally at current market ratio q**, the system remains solvent and fair:

```rust
pub fn remove_liquidity_proportional(amount: u64) -> Result<()> {
    let current_q = r_LONG / (r_LONG + r_SHORT);

    // Remove proportionally from each side
    let long_removal = amount * current_q;
    let short_removal = amount * (1 - current_q);

    // Burn LP's tokens proportionally
    let long_tokens_to_burn = s_LONG * (long_removal / r_LONG);
    let short_tokens_to_burn = s_SHORT * (short_removal / r_SHORT);

    // Update state
    s_LONG -= long_tokens_to_burn;
    s_SHORT -= short_tokens_to_burn;
    vault_balance -= amount;

    // Key: Market ratio q remains unchanged!
}
```

#### Why This Works: Vault Composition

The vault contains BOTH LP deposits AND trader deposits:

```
Example:
Initial: $100 from traders
LP adds: $100
Vault: $200 ($100 traders + $100 LP)

Trading occurs: Trader adds $30
Vault: $230 ($130 traders + $100 LP)

LP withdraws their $100 proportionally:
Vault: $130 (all trader funds remain!)
```

#### Mathematical Proof of Solvency

When LP withdraws proportionally:

1. **Market q unchanged**: Ratio r_LONG/r_SHORT preserved
2. **Lambda scales correctly**: λ = vault/norm adjusts proportionally
3. **Trader position values unchanged**: Share of reserves preserved
4. **Full LP exit possible**: LP can withdraw 100% of their contribution

Example with full LP exit:
```
Before LP exit:
- Vault: $230 (q = 0.7)
- Alice (LONG trader): $40 value
- Bob (SHORT trader): $15 value
- Charlie (LONG trader): $75 value
- LP: $100 claimable

LP exits fully (proportionally at q = 0.7):
- Withdraws: $70 from LONG, $30 from SHORT
- Vault: $130 (all trader funds)
- q still = 0.7
- Alice: still $40 value ✓
- Bob: still $15 value ✓
- Charlie: still $75 value ✓

Settlement and redemption work normally!
```

#### The Critical Property

**LPs can always fully exit without breaking solvency** because:

1. They only withdraw their contributed liquidity
2. Trader deposits remain in the pool
3. Proportional withdrawal preserves market ratios
4. Settlement and redemption continue to work

The pool doesn't need LP liquidity to remain solvent—it needs it for better price discovery and lower slippage.

### Why Risk-Neutral LPs Need Separation

In a single bucket, every dollar in the vault backs LONG/SHORT claims. Adding LP cash at q and minting tokens is solvent, but LP value still moves with q. To make LPs flat while keeping depth, their principal must be excluded from the pricing invariant.

### Two-Bucket Architecture: Neutral LPs, Virtual Depth

We separate trader collateral from LP principal but still use LP size to soften slippage:

```rust
pub struct ICBSPool {
    trader_vault: u64,   // backs LONG/SHORT claims and drives λ
    lp_vault: u64,       // LP principal, not backing tokens
    s_long: u64,
    s_short: u64,
    total_lp_shares: u64,
}

// Pricing invariant ignores LP principal
lambda = trader_vault / ||s_virtual||

// Depth for price impact includes LP bucket
effective_liquidity = trader_vault + lp_vault
```

#### Trade Flow with Virtual Depth
1. Quote tokens using `effective_liquidity` to reduce slippage (treat pool as deeper).
2. Trader pays into `trader_vault` only; `lp_vault` is untouched.
3. Update `λ` from `trader_vault / ||s||`, mint/burn tokens from the trade as usual.
4. LP bucket never absorbs directional PnL; it only sizes the curve for pricing.

#### LP Shares (solvent and neutral)
```rust
fn mint_lp_shares(amount: u64) {
    if total_lp_shares == 0 {
        // Bootstrap: 1:1 with deposit
        minted = amount;
    } else {
        minted = amount * total_lp_shares / lp_vault;
    }
    lp_vault += amount;
    total_lp_shares += minted;
}

fn redeem_lp_shares(shares: u64) -> u64 {
    let payout = shares * lp_vault / total_lp_shares;
    total_lp_shares -= shares;
    lp_vault -= payout;
    return payout; // paid 1:1 (plus any accumulated fees if routed here)
}
```

#### Settlement and Redemption
- Settlement adjusts sigma and reprices LONG/SHORT using `trader_vault` only.
- Trader redemptions draw down `trader_vault`.
- LP share redemptions draw from `lp_vault` only (no directional exposure).

#### What LPs Provide
- **Virtual depth**: Lower slippage and larger quote capacity because pricing uses `trader_vault + lp_vault`.
- **Neutrality**: LP value is invariant to q and settlement; only fee flows change it.
- **Solvency**: No double-counting—token claims never include `lp_vault`.

#### Understanding Virtual Depth vs Actual Depth

**Virtual depth** means better pricing, not increased payout capacity:

```
Example:
- trader_vault: $100
- lp_vault: $900
- effective_liquidity: $1,000 (for pricing calculations)

Trader buys $50 of LONG:
✓ Price calculated as if pool has $1,000 (low slippage)
✓ Trader pays $50 into trader_vault → becomes $150
✗ If LONG wins settlement, max payout is still $150 (not $1,000)

The depth is "virtual" because:
- LP funds improve price discovery during trading
- But LP funds don't back token payouts at settlement
- Winners can only claim from trader_vault
```

**Key insight**: Virtual depth provides better UX (smoother trading) without increasing capital efficiency for extreme outcomes. LPs earn fees for providing pricing service, not for taking settlement risk.

**Caveat**: Ultimate payout capacity remains bounded by `trader_vault`. Additional mechanisms (trading fees routed to `lp_vault`, insurance pools, or hybrid collateralization) could bridge this gap but would reintroduce some risk for LPs.

## On-Manifold Trading Fix (Bug Note)

We uncovered a BUY-path pricing bug: the vault was credited, λ was set to `vault_after / ||s_before||`, and Δs was solved with that λ while still using the old norm. That mints too few tokens (avg buy price can exceed both start and end marginals) because the post-trade state is off-manifold; the correct λ should be `vault_after / ||s_after||`.

**Fix (one-sided buy, σ=1 for clarity):**
```
V2 = V1 + A
norm2 = norm1 * (V2 / V1)
s2 = sqrt(norm2^2 - s_other^2)
Δs = s2 - s1
λ_after = V2 / norm2
```
Recompute prices/reserves from `(s2, s_other, λ_after)` (apply in virtual space when σ ≠ 1). In code: add an on-manifold buy solver and in `trade.rs` derive `norm2 = norm1 * V2/V1`, then Δs and λ_after from that state. This keeps trades on the invariant (`r_long + r_short = vault`) and guarantees average buy price lies between the starting and ending marginal prices.

## Binary Settlement Profit Guarantee (No Fees)

Assumptions: on-manifold buys/sells (λ = vault/‖ŝ‖ each trade), σ applied only at settlement, binary outcome (f_winner=1, f_loser=0), and no fees/other vault drains.

Proof sketch:
- For any trade with the other side fixed, on-manifold update gives `norm_after = norm_before * (V_after/V_before)` ⇒ λ_after = λ_before (constant during trading). Prices are always < λ.
- Binary settlement sends virtual norm to the winning side only; with f=1 the norm equals the winning virtual supply, so λ_settle = vault/‖ŝ_win‖ = λ (unchanged).
- Redemption per winning virtual token = λ; display redemption is the same after applying σ.
- Since all trade prices < λ and redemption = λ, any holder of the winning side strictly profits (no-loss guarantee) under these assumptions.

Breakers of the guarantee: fees that leave the vault, fractional BD scores (f_winner<1), or reverting to off-manifold pricing.

## Complete ICBS Lifecycle

The lifecycle is similar for both architectures, with key differences noted:

### 1. Deployment
- Initial deposit creates pool
- Calculate initial λ from deposit and initial supplies
- Set σ_LONG = σ_SHORT = 1.0 (no virtualization)
- **Two-bucket**: Initialize both `trader_vault` and `lp_vault` as separate

### 2. Trading Phase
- Users buy/sell LONG and SHORT tokens
- **Single-bucket**: λ adjusts from `vault_balance / norm`
- **Two-bucket**: λ adjusts from `trader_vault / norm` (excludes LP funds)
- Prices change based on supply ratios
- TVL = C maintained throughout
- **Two-bucket**: Effective liquidity includes both vaults for pricing

### 3. Settlement
- Protocol calculates BD score (0 to 1)
- Adjust σ_LONG and σ_SHORT by √f
- Reserves rebalance to reflect outcome
- Prices update to reflect new sigma
- **Single-bucket**: Vault unchanged, tokens unchanged
- **Two-bucket**: Only `trader_vault` used for settlement, `lp_vault` untouched

### 4. Redemption
- Enable redemption at settled rates
- Traders burn tokens, receive pro-rata USDC from trader vault
- **Two-bucket**: LPs redeem shares from `lp_vault` separately
- All redemptions happen at same rate (per token class)
- Vaults deplete as users exit
- Pool closes when fully redeemed

## Open Questions and Future Work

### Multiple Settlements vs Single Settlement

Current design: Multiple epoch settlements with continuous trading between epochs

Proposed addition: Final settlement with redemption when market resolves

**Hybrid approach**:
- Periodic settlements adjust prices (epochs)
- Final settlement enables redemption (market close)
- Users can trade between epochs or wait for final redemption

### LP Withdrawal Before Settlement

How should LPs exit before final settlement?
- Option A: Convert LP shares to LONG/SHORT tokens at current q
- Option B: Burn shares, get pro-rata vault share (affects traders)
- Option C: LP shares tradeable on secondary market

### Continuous vs Batch Redemption

Current proposal: Batch redemption after settlement

Alternative: Continuous redemption with rebasing
- Users can redeem anytime after settlement
- Redemption rate fixed at settlement
- No impact on other holders

### Fee Integration

Where do trading fees fit?
- Accumulated in vault during trading
- Distributed to LPs?
- Distributed to protocol?
- Affect redemption rates?

## Implementation Notes

### Adding Redemption to Smart Contract

Required changes to `ContentPool` state:
```rust
pub struct ContentPool {
    // ... existing fields ...

    // Redemption state
    pub redemption_enabled: bool,
    pub long_redemption_rate_q64: u128,   // Q64 fixed-point
    pub short_redemption_rate_q64: u128,  // Q64 fixed-point
    pub total_redeemed: u64,              // Track redemptions
}
```

New instructions needed:
1. `enable_redemption`: Lock redemption rates after final settlement
2. `redeem_tokens`: Burn tokens, transfer USDC pro-rata
3. `close_empty_pool`: Close pool when fully redeemed

### Testing Requirements

Key test cases:
1. Multiple users enter at different q values, all redeem successfully
2. Total redemptions = vault balance (solvency)
3. Redemption order doesn't affect payout (order-independence)
4. Extreme cases: q near 0 or 1, BD at boundaries
5. Rounding doesn't break solvency (last redeemer gets remainder)

## Conclusion

The ICBS mechanism with sigma virtualization enables:

1. **Continuous trading** with price discovery
2. **Solvent settlement** via virtualization (no token burning)
3. **Fair redemption** via pro-rata distribution
4. **Natural return multiples** from entry price vs settlement outcome
5. **Dynamic lambda** scaling with market depth

### Key Insights

**Settlement mechanism**: Settlement doesn't redistribute money directly - it reprices tokens via sigma adjustment. Redemption then converts this new pricing into actual USDC distribution.

**Single-bucket architecture** (current):
- All funds in one vault
- LPs receive directional tokens
- Fully solvent but LPs take q-risk
- Solvency maintained through proportional LP withdrawal

**Two-bucket architecture** (proposed):
- Separate `trader_vault` and `lp_vault`
- Lambda excludes LP funds: `λ = trader_vault / ||s_virtual||`
- LPs receive non-directional shares, fully risk-neutral
- Provides **virtual depth**: Better pricing but not increased payout capacity
- No double-counting, fully solvent

### Architecture Tradeoffs

| Feature | Single-Bucket | Two-Bucket |
|---------|--------------|------------|
| LP Risk | Directional (q-risk) | Neutral |
| Depth Type | Real (backs payouts) | Virtual (pricing only) |
| Payout Capacity | Full vault | trader_vault only |
| LP Exit | Proportional at q | Anytime 1:1 |
| Complexity | Lower | Higher |

The choice depends on whether the priority is maximum capital efficiency (single-bucket) or risk-neutral LPs with better trading UX (two-bucket).

This completes the ICBS lifecycle and enables true prediction market semantics while maintaining continuous market properties during the trading phase.

---

*Last updated: 2025-12-03*

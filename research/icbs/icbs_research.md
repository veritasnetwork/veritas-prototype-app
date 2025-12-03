# ICBS Research: Settlement and Redemption Mechanisms

## Overview

This document outlines the complete ICBS lifecycle and explores the mechanics of settlement, redemption, and liquidity provision in the Euclidean norm Inversely Coupled Bonding Surface.

## Core ICBS Mechanics (Current Implementation)

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

In our implementation, lambda is computed dynamically:
```rust
λ = vault_balance / ||s_virtual||
```

Where:
```
s_virtual_LONG = s_display_LONG / σ_LONG
s_virtual_SHORT = s_display_SHORT / σ_SHORT
||s_virtual|| = √(s²_virtual_LONG + s²_virtual_SHORT)
```

### Why Lambda Changes

Lambda changes when:
1. **Trading occurs**: Vault balance changes, virtual norm changes
2. **LP deposits**: Vault balance increases, supplies increase
3. **Settlement**: Sigma parameters change, affecting virtual supplies

### Lambda and Market State

- **Balanced markets** (50/50): Lambda scales with √TVL
- **Imbalanced markets**: Lambda can increase as market rebalances (norm decreases)
- **After settlement**: Lambda adjusts automatically to maintain TVL = C

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
if r_LONG_new + r_SHORT_new ≠ vault_balance:
    // Proportionally adjust to match vault
    scale = vault_balance / (r_LONG_new + r_SHORT_new)
    r_LONG_final = r_LONG_new × scale
    r_SHORT_final = r_SHORT_new × scale
```

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

### Current System: Directional LP

When LPs add liquidity at market ratio q:
```
LP deposits D dollars:
- Allocate D×q to LONG
- Allocate D×(1-q) to SHORT
- Receive LONG and SHORT tokens
```

**Problem**: LPs hold directional tokens, exposed to:
1. Market movement between entry and settlement
2. Lambda changes from trading/other LPs
3. Path-dependent gains/losses

### Why LPs Aren't Risk-Neutral

Even depositing at market ratio q:
- LPs receive fungible tokens at current prices
- Lambda changes affect token value
- Settlement changes token value
- LP return ≠ principal (unless market perfectly predicted outcome)

### LP Withdrawal and Solvency

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

### Proposed: LP Share Tokens for True Risk Neutrality

To achieve perfect risk neutrality, create separate LP share tokens:

```rust
pub struct LPPosition {
    shares: u64,           // LP share tokens
    entry_tvl: u64,        // TVL when LP entered
    entry_timestamp: i64,
}

pub fn add_liquidity_neutral(ctx: Context<AddLiquidity>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let current_q = pool.r_long / (pool.r_long + pool.r_short);

    // Allocate at market ratio
    let long_allocation = amount × current_q;
    let short_allocation = amount × (1 - current_q);

    // Mint LP shares (not LONG/SHORT tokens)
    let shares = amount × SHARE_PRECISION / pool.tvl;
    mint_lp_shares(shares)?;

    // Add to vault
    pool.vault_balance += amount;

    Ok(())
}

pub fn redeem_lp_shares(ctx: Context<RedeemLP>, shares: u64) -> Result<()> {
    let pool = &ctx.accounts.pool;

    // LP gets pro-rata share of current TVL
    let payout = shares × pool.tvl / total_lp_shares;

    // Transfer USDC, burn shares
    transfer_from_vault(payout)?;
    burn_lp_shares(shares)?;

    Ok(())
}
```

**Key property**: LP shares represent pool ownership, not directional positions. At settlement, LPs get their pro-rata share of the vault regardless of outcome.

### LP Shares and Lambda Scaling

When LPs add liquidity:
1. Vault balance increases
2. Supplies increase (proportionally to current state)
3. Lambda scales up: λ_new = (TVL_old + deposit) / ||s_virtual_new||
4. Higher lambda → higher price ceiling

LP deposits dynamically expand the market's expressive range!

## Complete ICBS Lifecycle

### 1. Deployment
- Initial deposit creates pool
- Calculate initial λ from deposit and initial supplies
- Set σ_LONG = σ_SHORT = 1.0 (no virtualization)

### 2. Trading Phase
- Users buy/sell LONG and SHORT tokens
- Lambda adjusts with every trade (derived from vault/norm)
- Prices change based on supply ratios
- TVL = C maintained throughout

### 3. Settlement
- Protocol calculates BD score (0 to 1)
- Adjust σ_LONG and σ_SHORT by √f
- Reserves rebalance to reflect outcome
- Prices update to reflect new sigma
- Vault unchanged, tokens unchanged

### 4. Redemption
- Enable redemption at settled rates
- Users burn tokens, receive pro-rata USDC
- All redemptions happen at same rate
- Vault depletes as users exit
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

The key insight: Settlement doesn't redistribute money directly - it reprices tokens via sigma adjustment. Redemption then converts this new pricing into actual USDC distribution.

This completes the ICBS lifecycle and enables true prediction market semantics while maintaining continuous market properties during the trading phase.

---

*Last updated: 2025-12-03*

# Solana Smart Contract Architecture - Design Specification

## System Overview

Two-layer architecture:
1. **Veritas Protocol** (existing Supabase/Postgres) - Runs BTS scoring, calculates relevance scores
2. **Solana Smart Contracts** - Bonding curve pools for speculation on content

## Core Components

### 1. Custodian Contract (Veritas Staking Only)
- **Pooled custody model**: All user USDC deposits go into a single shared pool
- **No on-chain individual tracking**: User balances tracked entirely in Supabase DB
- **Protocol-controlled withdrawals**: Only protocol authority can execute withdrawals
- **Withdrawal flow**:
  1. User requests withdrawal via UI
  2. Backend validates request against user's Supabase stake balance
  3. Backend (protocol authority) executes on-chain withdrawal from pool to user's wallet
- **Why pooled?**: User stakes change every epoch based on protocol outcomes. Pooled model prevents on-chain/off-chain desync.
- Maps `solana_address` → `agent_id` in database

**Purpose**: Keep Veritas fast/cheap while Solana-backed, with zero-sum stake redistribution

### 2. Pool Factory Contract
- Creates new bonding curve pool per post
- Each post gets one pool with pure quadratic bonding curve

### 3. Pool Contract (Per Post)
- **Pure quadratic bonding curve with price floor**: P(s) = max(P_floor, k × s²)
- Users buy/sell tokens with USDC (non-custodial)
- Tracks reserve, token supply, and elastic curve coefficient
- **See detailed spec**: [smart-contracts/ContentPool.md](smart-contracts/ContentPool.md)

## User Flows

### Authentication & Wallets
- **Required**: Privy login (social or wallet)
- Every user gets Privy embedded Solana wallet automatically
- One wallet per account (logout/login to switch)

### Two Balances Per User
1. **Custodial balance** - Veritas protocol staking
   - Tracked in Supabase database (not on-chain)
   - Changes every epoch based on protocol outcomes
   - Withdrawal requires protocol authority signature
   - User requests withdrawal → backend validates → protocol executes on-chain transfer
2. **Non-custodial balance** - Solana wallet for pool trading (user controls directly)

### Custodian Deposit Flow
1. User initiates deposit via UI
2. User transfers USDC from wallet to custodian pool (on-chain)
3. Deposit event emitted with depositor address and amount
4. Backend indexes deposit event
5. Backend credits user's agent stake in Supabase database

### Custodian Withdrawal Flow
1. **User requests withdrawal** via UI (specifies amount)
2. **Backend validates request**:
   - Check user's current stake in Supabase database
   - Ensure requested amount ≤ available stake
   - Account for any active beliefs or locked funds
3. **Backend approves/rejects**:
   - If approved: Protocol authority executes on-chain withdrawal
   - Transfer USDC from custodian pool to user's wallet
   - Emit withdrawal event with recipient and amount
4. **Backend updates database**:
   - Deduct withdrawn amount from user's stake
   - Mark withdrawal as completed
   - Record transaction signature

**Key insight**: Users cannot withdraw directly on-chain because their stake balance changes every epoch based on protocol outcomes. The backend is the source of truth for available balance.

### Trading Flow (Non-custodial Pools)
1. User connects Privy embedded wallet
2. User buys/sells pool tokens using wallet USDC
3. Pure quadratic bonding curve calculates price
4. Tokens represent ownership in pool

## Bonding Curve Mechanics: Elastic-K Solution

### Core Innovation
**When reserves change (from epoch effects), rescale the curve coefficient `k` to maintain mathematical consistency.**

### Pure Quadratic Curve with Price Floor
```
P(s) = max(P_floor, k_quadratic × s²)
```

Where:
- `s` = token supply
- `k_quadratic` = quadratic coefficient (elastic, adjusts with reserve changes)
- `P_floor` = $0.0001 minimum price

**Why pure quadratic (not piecewise)?**
- Simpler implementation and lower gas costs
- Fewer edge cases and easier auditing
- Sufficient price range for content markets
- Price floor handles zero-supply case elegantly

### Reserve Integral

**Formula:**
```
R = (k_quadratic × s³) / 3
```

**For detailed implementation**, see [smart-contracts/ContentPool.md](smart-contracts/ContentPool.md)

### Elastic-K Epoch Processing

**When reserves change, scale k_quadratic proportionally:**

```rust
fn apply_epoch_effects(pool: &mut ContentPool, net_change: i64) {
    let R_old = pool.reserve;
    let R_new = R_old + net_change; // Can be + or -

    // Scale coefficient proportionally
    let ratio = R_new / R_old;
    pool.k_quadratic *= ratio;
    pool.reserve = R_new;

    // Token supply unchanged
    // Price automatically adjusts for all holders
}
```

**Key properties:**
- Token supply never changes during epochs (no minting/burning)
- Only k_quadratic scales (simpler than piecewise)
- Price automatically increases/decreases for all holders
- Mathematical invariant maintained: R = (k × s³) / 3

### Example

```
Initial state:
- S = 10,000 tokens
- R = $1,000
- k = 0.000003
- Price at 10,000: P = 0.000003 × 10,000² = $0.30/token

Epoch reward: +$100
R_new = $1,100
ratio = 1.1

New values:
- k = 0.000003 × 1.1 = 0.0000033
- New price: P = 0.0000033 × 10,000² = $0.33/token
- Holders gained 10% value!

Verification:
- New reserve integral: (0.0000033 × 10,000³) / 3 = $1,100 ✓
```

## Delta Relevance-Based Skim Mechanism

### Economic Rationale
The Δr-based skim mechanism aligns incentives with truth-seeking by:
- **Rewarding early spotters**: Pools with rising relevance (Δr > 0) gain value
- **Penalizing declining content**: Pools with falling relevance (Δr < 0) lose value proportional to decline and certainty
- **Maintaining liquidity**: Small base skim (1%) on stagnant pools prevents dead pools
- **Zero-sum redistribution**: All penalties flow to winners (parimutuel)

### Penalty Rate Function
```
penalty_rate(Δr, certainty) = {
    min(|Δr| × certainty, 0.10)    if Δr < 0   (declining)
    base_skim_rate                  if Δr = 0   (stagnant)
    0                               if Δr > 0   (rising)
}
```

**Design properties:**
- **Certainty scaling**: Higher certainty → higher penalty for wrong bets
- **Magnitude scaling**: Larger relevance drops → higher penalty
- **Cap at 10%**: Prevents catastrophic losses in single epoch
- **No penalty for winners**: Δr > 0 pools only receive rewards

### Reward Distribution (Probability Simplex)
```
For all pools with Δr > 0:
    impact[i] = Δr[i] × certainty[i]
    relative_weight[i] = impact[i] / Σ(impact)
    reward[i] = penalty_pot × relative_weight[i]
```

**Example epoch:**
```
Pool A: Δr = +0.5, certainty = 0.8
Pool B: Δr = +0.3, certainty = 0.9
Pool C: Δr = -0.2, certainty = 0.7
Pool D: Δr = 0, certainty = 0.5

Penalties:
- Pool A: 0% (rising)
- Pool B: 0% (rising)
- Pool C: min(0.2 × 0.7, 0.10) = 0.14 → 10% (capped)
- Pool D: 1% (base skim)

Rewards (assume Pool C reserve = $1000, Pool D reserve = $500):
- penalty_pot = $100 + $5 = $105
- Pool A impact = 0.5 × 0.8 = 0.40
- Pool B impact = 0.3 × 0.9 = 0.27
- total_positive_impact = 0.40 + 0.27 = 0.67
- Pool A: $105 × (0.40/0.67) = $62.69
- Pool B: $105 × (0.27/0.67) = $42.31
```

### Edge Cases

**No winning pools (all Δr ≤ 0):**
- Collect all penalties as usual
- Store penalty_pot in `epoch_rollover_balance` config
- Add rollover to next epoch's penalty_pot
- Eventually distributes when positive Δr pools emerge

**All stagnant pools (all Δr = 0):**
- All pools pay 1% base skim
- Total penalties accumulate in rollover
- Waits for dynamic content to emerge

**All rising pools (all Δr > 0):**
- No penalties collected (only rollover from previous epochs)
- Distribute any existing rollover proportionally
- Next epoch likely has declining pools (mean reversion)

## Epoch Processing (Every 3 Hours)

### Sequence
1. **Veritas Protocol Runs** (Supabase edge functions)
   - Process all beliefs using current stakes
   - Calculate new aggregate relevance scores
   - Redistribute stakes in DB
   - Update `previous_aggregate` → store delta

2. **Calculate Delta Relevance & Penalty/Reward Rates** (Backend)
   - For each belief/post: `Δr = current_aggregate - previous_aggregate` (range: [-1, 1])
   - Query certainty from Learning Assessment step for each belief
   - Calculate penalty rate for each pool based on Δr and certainty:

     **Penalty Calculation:**
     - **Δr < 0** (declining relevance):
       - `penalty_rate = |Δr| × certainty`
       - Capped at 10% maximum
       - Example: Δr = -0.3, certainty = 0.6 → penalty_rate = 0.18 (18%)

     - **Δr = 0** (stagnant):
       - `penalty_rate = base_skim_rate` (default: 1%, configurable in system_config table)

     - **Δr > 0** (rising relevance):
       - `penalty_rate = 0` (no penalty)

   - Calculate actual penalty amounts: `penalty_amount = pool.reserve × penalty_rate`
   - Total penalty pot: `penalty_pot = Σ(penalty_amount)` for all Δr ≤ 0 pools

3. **Calculate Reward Distribution** (Backend)
   - Only pools with Δr > 0 receive rewards
   - Calculate impact: `impact = Δr × certainty` for each positive pool
   - Normalize positive impacts to probability simplex:
     - `total_positive_impact = Σ(impact)` for all Δr > 0 pools
     - `relative_impact[i] = impact[i] / total_positive_impact`

   - Distribute penalty pot proportionally:
     - `pool[i].reward = penalty_pot × relative_impact[i]`

   - **Edge case (no winners):** If no pools have Δr > 0:
     - Rollover penalty_pot to next epoch
     - Store in `epoch_rollover_balance` config
     - Add to next epoch's penalty_pot

4. **Transfer Penalties to Treasury** (Solana, Phase 1)
   - For each pool with penalty > 0: Send USDC from pool vault → treasury vault
   - All penalty transactions sent in parallel
   - Treasury accumulates total penalty amount
   - Apply elastic-k rescaling to penalized pools

5. **Distribute Rewards from Treasury** (Solana, Phase 2)
   - After all penalties collected, distribute to winner pools (Δr > 0)
   - For each pool with reward > 0: Send USDC from treasury vault → pool vault
   - All reward transactions sent in parallel
   - Treasury should zero out (total penalties = total rewards)
   - Apply elastic-k rescaling to rewarded pools

### Solana Program Instructions

```rust
#[account]
pub struct ProtocolTreasury {
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct ApplyPoolPenalty<'info> {
    #[account(mut)]
    pub pool: Account<'info, ContentPool>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    /// Pool's USDC token account (source)
    #[account(mut)]
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    /// Treasury's USDC token account (destination)
    #[account(mut)]
    pub treasury_usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    #[account(constraint = authority.key() == treasury.authority)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApplyPoolReward<'info> {
    #[account(mut)]
    pub pool: Account<'info, ContentPool>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    /// Treasury's USDC token account (source)
    #[account(mut)]
    pub treasury_usdc_vault: Account<'info, TokenAccount>,

    /// Pool's USDC token account (destination)
    #[account(mut)]
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    #[account(constraint = authority.key() == treasury.authority)]
    pub authority: Signer<'info>,
}

/// Phase 1: Apply penalty (skim > reward)
pub fn apply_pool_penalty(
    ctx: Context<ApplyPoolPenalty>,
    penalty_amount: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    require!(penalty_amount > 0, ErrorCode::InvalidPenalty);
    require!(pool.reserve >= penalty_amount as u128, ErrorCode::InsufficientReserve);

    // Transfer USDC from pool to treasury
    let cpi_accounts = Transfer {
        from: ctx.accounts.pool_usdc_vault.to_account_info(),
        to: ctx.accounts.treasury_usdc_vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, penalty_amount)?;

    // Update pool reserve
    let old_reserve = pool.reserve;
    pool.reserve -= penalty_amount as u128;

    // Apply elastic-k rescaling
    let ratio = (pool.reserve * 1_000_000) / old_reserve;
    pool.k_quadratic = (pool.k_quadratic * ratio) / 1_000_000;
    pool.k_linear = (pool.k_linear * ratio) / 1_000_000;

    Ok(())
}

/// Phase 2: Apply reward (reward > skim)
pub fn apply_pool_reward(
    ctx: Context<ApplyPoolReward>,
    reward_amount: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    require!(reward_amount > 0, ErrorCode::InvalidReward);

    // Transfer USDC from treasury to pool
    let treasury_bump = ctx.accounts.treasury.bump;
    let seeds = &[b"treasury".as_ref(), &[treasury_bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.treasury_usdc_vault.to_account_info(),
        to: ctx.accounts.pool_usdc_vault.to_account_info(),
        authority: ctx.accounts.treasury.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, reward_amount)?;

    // Update pool reserve
    let old_reserve = pool.reserve;
    pool.reserve += reward_amount as u128;

    // Apply elastic-k rescaling
    let ratio = (pool.reserve * 1_000_000) / old_reserve;
    pool.k_quadratic = (pool.k_quadratic * ratio) / 1_000_000;
    pool.k_linear = (pool.k_linear * ratio) / 1_000_000;

    Ok(())
}
```

### Backend Implementation Flow

```typescript
async function processEpoch() {
  // 1. Get all pools with delta relevance scores and certainty
  const pools = await db.pool_deployments
    .join('beliefs', 'beliefs.id', 'pool_deployments.belief_id')
    .select(`
      pool_deployments.*,
      beliefs.delta_relevance,
      beliefs.certainty,
      beliefs.previous_aggregate
    `);

  // 2. Get base skim rate from config
  const { base_skim_rate } = await db.system_config
    .select('value')
    .eq('key', 'base_skim_rate')
    .single();
  const baseSkimRate = parseFloat(base_skim_rate) || 0.01; // Default 1%

  // 3. Get any rollover from previous epoch
  const { epoch_rollover_balance } = await db.system_config
    .select('value')
    .eq('key', 'epoch_rollover_balance')
    .single();
  let penaltyPot = parseFloat(epoch_rollover_balance) || 0;

  // 4. Calculate penalty rates and amounts
  const poolsWithPenalties = pools.map(pool => {
    const deltaR = pool.delta_relevance || 0;
    const certainty = pool.certainty || 0;
    let penaltyRate = 0;

    if (deltaR < 0) {
      // Declining relevance: penalty scaled by certainty
      penaltyRate = Math.min(Math.abs(deltaR) * certainty, 0.10); // Cap at 10%
    } else if (deltaR === 0) {
      // Stagnant: base skim rate
      penaltyRate = baseSkimRate;
    }
    // deltaR > 0: no penalty

    const penaltyAmount = pool.reserve * penaltyRate;
    penaltyPot += penaltyAmount;

    return {
      ...pool,
      deltaR,
      certainty,
      penaltyRate,
      penaltyAmount: Math.floor(penaltyAmount * 1_000_000), // Convert to lamports (6 decimals)
    };
  });

  console.log(`Total penalty pot: $${penaltyPot.toFixed(2)}`);

  // 5. Calculate reward distribution (probability simplex)
  // Rewards are proportional to (delta_relevance × certainty) for positive pools
  const positivePools = poolsWithPenalties.filter(p => p.deltaR > 0);
  const poolsWithImpact = positivePools.map(p => ({
    ...p,
    impact: p.deltaR * p.certainty
  }));
  const totalPositiveImpact = poolsWithImpact.reduce((sum, p) => sum + p.impact, 0);

  let adjustments;
  if (totalPositiveImpact > 0) {
    // Distribute rewards proportionally to positive (delta_relevance × certainty)
    adjustments = poolsWithPenalties.map(pool => {
      let rewardAmount = 0;

      if (pool.deltaR > 0) {
        const impact = pool.deltaR * pool.certainty;
        rewardAmount = (penaltyPot * impact) / totalPositiveImpact;
      }

      return {
        poolAddress: new PublicKey(pool.pool_address),
        poolUsdcVault: new PublicKey(pool.usdc_vault_address),
        penalty: pool.penaltyAmount,
        reward: Math.floor(rewardAmount * 1_000_000), // Convert to lamports
      };
    });

    // Reset rollover for next epoch
    await db.system_config
      .update({ value: '0' })
      .eq('key', 'epoch_rollover_balance');
  } else {
    // No winners - rollover penalty pot to next epoch
    console.log(`No positive impact (Δr × certainty). Rolling over $${penaltyPot.toFixed(2)} to next epoch.`);
    await db.system_config
      .update({ value: penaltyPot.toString() })
      .eq('key', 'epoch_rollover_balance');

    // Only apply penalties (no rewards this epoch)
    adjustments = poolsWithPenalties.map(pool => ({
      poolAddress: new PublicKey(pool.pool_address),
      poolUsdcVault: new PublicKey(pool.usdc_vault_address),
      penalty: pool.penaltyAmount,
      reward: 0,
    }));
  }

  // 6. Separate into penalty and reward transactions
  const penalties = adjustments.filter(a => a.penalty > 0);
  const rewards = adjustments.filter(a => a.reward > 0);

  console.log(`Phase 1: Applying ${penalties.length} penalties`);

  // 7. Phase 1: Send all penalty transactions in parallel
  const penaltySignatures = await Promise.all(
    penalties.map(({ poolAddress, poolUsdcVault, penalty }) =>
      program.methods
        .applyPoolPenalty(new BN(penalty))
        .accounts({
          pool: poolAddress,
          treasury: treasuryPDA,
          poolUsdcVault: poolUsdcVault,
          treasuryUsdcVault: treasuryUsdcVaultAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          authority: authorityKeypair.publicKey,
        })
        .rpc()
    )
  );

  console.log(`Phase 1 complete. ${penaltySignatures.length} penalties applied.`);
  console.log(`Phase 2: Distributing ${rewards.length} rewards`);

  // 8. Phase 2: Send all reward transactions in parallel
  const rewardSignatures = await Promise.all(
    rewards.map(({ poolAddress, poolUsdcVault, reward }) =>
      program.methods
        .applyPoolReward(new BN(reward))
        .accounts({
          pool: poolAddress,
          treasury: treasuryPDA,
          poolUsdcVault: poolUsdcVault,
          treasuryUsdcVault: treasuryUsdcVaultAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          authority: authorityKeypair.publicKey,
        })
        .rpc()
    )
  );

  console.log(`Phase 2 complete. ${rewardSignatures.length} rewards distributed.`);
  console.log(`Total transactions: ${penalties.length + rewards.length}`);
}
```

### Transaction Count Analysis

For 1000 pools with typical distribution (assuming normal market dynamics):
- ~200-300 pools: Rising relevance (Δr > 0) - receive rewards only
- ~500-600 pools: Declining relevance (Δr < 0) - pay scaled penalties
- ~100-200 pools: Stagnant (Δr = 0) - pay 1% base skim

**Phase 1 (Penalties):**
- ~600-800 transactions (all Δr ≤ 0 pools)
- Parallel execution
- Treasury accumulates penalty pot

**Phase 2 (Rewards):**
- ~200-300 transactions (all Δr > 0 pools)
- Parallel execution
- Treasury zeroes out

**Totals:**
- **~800-1100 transactions per epoch**
- **Cost: ~$0.05-0.10 per epoch** at current Solana prices
- **Time: ~2-3 seconds total** (Phase 1 parallel + Phase 2 parallel)
- **Treasury net balance: $0** (complete parimutuel redistribution)

## Key Design Decisions

### Authority Model
- Backend is pool authority (not permissionless)
- Only backend can trigger skim/redistribute
- Necessary because Veritas runs centrally

### Timing
- Skim AFTER Veritas protocol completes
- Use fresh relevance scores for distribution

### Penalty & Reward Formulas

**Penalty Rate Calculation:**
```
if Δr < 0:
    penalty_rate = min(|Δr| × certainty, 0.10)
elif Δr = 0:
    penalty_rate = base_skim_rate (from config, default 1%)
else (Δr > 0):
    penalty_rate = 0
```

**Penalty Amount:**
```
penalty_amount = pool.reserve × penalty_rate
```

**Reward Distribution (Probability Simplex):**
```
impact[i] = Δr[i] × certainty[i] for all Δr > 0 pools
total_positive_impact = Σ(impact[i])
relative_impact[i] = impact[i] / total_positive_impact
pool[i].reward = penalty_pot × relative_impact[i]
```

**Edge Case (No Winners):**
```
if total_positive_impact = 0:
    rollover penalty_pot to next epoch
    store in epoch_rollover_balance config
```

**Key Point:** Certainty comes from the Learning Assessment step of epoch processing, not from epistemic weights.

### Curve Parameters (Recommended)
- **k_quadratic_initial**: 0.000001 (adjustable per pool)
- **s_cap**: 100,000 tokens (where curve switches to linear)
- **k_linear**: Derived as k_quad × s_cap = 0.1
- **Initial price**: P(0) = 0 (zero supply = zero price)
- **Price at cap**: ~$10 (quadratic region peak)
- **Linear growth**: $0.0001 per token after cap

## Data Structures

### Solana Account (ContentPool)

**See complete specification**: [smart-contracts/ContentPool.md](smart-contracts/ContentPool.md)

```rust
#[account]
pub struct ContentPool {
    pub post_id: [u8; 32],          // Hash identifier of content
    pub k_quadratic: u128,          // Quadratic coefficient (elastic)
    pub token_supply: u128,         // Total SPL tokens minted
    pub reserve: u128,              // Total USDC in pool (6 decimals)
    pub token_mint: Pubkey,         // SPL token mint address
    pub token_name: [u8; 32],       // Token name
    pub token_symbol: [u8; 10],     // Token symbol
    pub token_decimals: u8,         // Token decimals (always 6)
    pub usdc_vault: Pubkey,         // USDC token account
    pub factory: Pubkey,            // Reference to PoolFactory
    pub bump: u8,                   // PDA bump seed
}
// Total: 220 bytes + 8 discriminator = 228 bytes
```

### Database Schema (Postgres/Supabase)
```sql
-- Users table addition
ALTER TABLE users ADD COLUMN solana_address TEXT UNIQUE;

-- Beliefs table additions
ALTER TABLE beliefs ADD COLUMN delta_relevance NUMERIC;
ALTER TABLE beliefs ADD COLUMN uncertainty NUMERIC;

-- New table: Pool deployments
CREATE TABLE pool_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    belief_id UUID REFERENCES beliefs(id) ON DELETE CASCADE,
    pool_address TEXT NOT NULL UNIQUE,
    deployed_at TIMESTAMP DEFAULT NOW(),
    k_quadratic NUMERIC NOT NULL,
    k_linear NUMERIC NOT NULL,
    supply_cap NUMERIC NOT NULL
);

-- Core table: Agent stake tracking
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    wallet_address TEXT UNIQUE NOT NULL,
    protocol_stake NUMERIC DEFAULT 0,      -- Current stake (changes with epochs)
    total_deposited NUMERIC DEFAULT 0,     -- Audit trail
    total_withdrawn NUMERIC DEFAULT 0,     -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

-- Custodian deposits (indexed from events - pooled on-chain)
CREATE TABLE custodian_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    wallet_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending'
);

-- Custodian withdrawals (protocol-controlled)
CREATE TABLE custodian_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    amount_usdc NUMERIC NOT NULL,           -- Validated against agent's current stake
    recipient_address TEXT NOT NULL,        -- Recipient wallet
    tx_signature TEXT UNIQUE,               -- Set when protocol authority executes
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    block_time TIMESTAMPTZ,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    rejection_reason TEXT
);

-- Unallocated deposits (deposits without agent mapping)
CREATE TABLE unallocated_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_signature TEXT UNIQUE NOT NULL,
    depositor_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    block_time TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    allocated BOOLEAN DEFAULT FALSE,
    notes TEXT
);

-- Config entries for epoch processing
INSERT INTO system_config (key, value, description) VALUES
    ('base_skim_rate', '0.01', 'Base penalty rate for pools with zero delta_relevance (1% = 0.01)'),
    ('epoch_rollover_balance', '0', 'Accumulated penalty pot from epochs with no winning pools');
```

## Mathematical Properties

### Invariants
1. **Reserve consistency**: At any time, `reserve = ∫[0 to S] P(s) ds` using current k values
2. **Continuity**: `k_quad × s_cap² = k_linear × s_cap` always holds after epoch scaling
3. **Proportional scaling**: All token holders gain/lose same percentage from epoch effects
4. **Zero-sum epochs**: Sum of all skims = Sum of all rewards (parimutuel)

### Benefits Over Alternatives
- **No minting/burning**: Simplifies accounting, reduces gas costs
- **No virtual supply tracking**: k-scaling is more intuitive than supply conversions
- **Works with any polynomial curve**: Linear, quadratic, or higher-order
- **Clean price discovery**: Marginal price always well-defined from current k and S
- **Automatic value distribution**: All holders benefit proportionally without claims

## Next Steps

1. ✅ Resolved token value mechanism (elastic-k)
2. ✅ Chose bonding curve (piecewise quadratic → linear)
3. Write comprehensive unified specification with full program architecture
4. Implement Anchor programs (pool factory, pool contract, custodian)
5. Build backend integration (epoch trigger, skim/reward distribution)
6. Add Privy Solana wallet integration to frontend
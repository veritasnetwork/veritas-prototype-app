# Solana Smart Contract Architecture - Design Specification

## System Overview

Two-layer architecture:
1. **Veritas Protocol** (existing Supabase/Postgres) - Runs BTS scoring, calculates relevance scores
2. **Solana Smart Contracts** - Bonding curve pools for speculation on content

## Core Components

### 1. Custodian Contract (Veritas Staking Only)
- Users deposit USDC → credited to Veritas DB balance
- Only centralized authority key can approve withdrawals
- Withdrawals allowed anytime (even with active beliefs)
- Maps `solana_address` → `agent_id`

**Purpose**: Keep Veritas fast/cheap while Solana-backed

### 2. Pool Factory Contract
- Creates new bonding curve pool per post
- Each post gets one pool with piecewise bonding curve

### 3. Pool Contract (Per Post)
- **Piecewise bonding curve**: Quadratic → Linear at configurable cap
- Users buy/sell tokens with USDC (non-custodial)
- Tracks reserve, token supply, and elastic curve coefficients

## User Flows

### Authentication & Wallets
- **Required**: Privy login (social or wallet)
- Every user gets Privy embedded Solana wallet automatically
- One wallet per account (logout/login to switch)

### Two Balances Per User
1. **Custodial balance** - Veritas protocol staking (withdraw requires authority signature)
2. **Non-custodial balance** - Solana wallet for pool trading (user controls)

### Trading Flow
1. User connects Privy embedded wallet
2. User buys/sells pool tokens using wallet USDC
3. Piecewise bonding curve calculates price
4. Tokens represent ownership in pool

## Bonding Curve Mechanics: Elastic-K Solution

### Core Innovation
**When reserves change (from epoch effects), rescale the curve coefficient `k` to maintain mathematical consistency.**

### Piecewise Curve Definition
```
P(s) = {
    k_quad × s²        if s ≤ s_cap
    k_linear × s       if s > s_cap
}

Continuity constraint at s_cap:
k_quad × s_cap² = k_linear × s_cap
Therefore: k_linear = k_quad × s_cap
```

### Reserve Integrals

**Quadratic region** (0 to s_cap):
```
R_quad = ∫[0 to s_cap] k_quad × s² ds = (k_quad × s_cap³) / 3
```

**Linear region** (s_cap to S):
```
R_linear = ∫[s_cap to S] k_linear × s ds
         = k_linear × (S² - s_cap²) / 2
         = k_quad × s_cap × (S² - s_cap²) / 2
```

**Total reserve**:
```
R_total = R_quad + R_linear  (if S > s_cap)
R_total = (k_quad × S³) / 3  (if S ≤ s_cap)
```

### Elastic-K Epoch Processing

**When reserves change, scale both k values proportionally:**

```rust
fn apply_epoch_effects(pool: &mut ContentPool, skim: u128, reward: u128) {
    let R_old = pool.reserve;
    let R_new = R_old - skim + reward;

    // Scale both coefficients by same ratio
    let ratio = R_new / R_old;
    pool.k_quadratic *= ratio;
    pool.k_linear *= ratio;
    pool.reserve = R_new;

    // s_cap stays constant - only k values scale
    // Token supply unchanged
}
```

**Key properties:**
- Token supply never changes during epochs (no minting/burning)
- s_cap remains constant (curve shape preserved, just scaled)
- Both k values scale by same ratio (maintains continuity)
- Price automatically increases/decreases for all holders

### Why This Works

**Example: Quadratic region**
```
Initial state:
- S = 10,000 tokens
- R = $1,000
- k_quad = 0.000003
- Price at 10,000: P = 0.000003 × 10,000² = $0.30/token

Epoch reward: +$100
R_new = $1,100
ratio = 1.1

New values:
- k_quad = 0.000003 × 1.1 = 0.0000033
- New price: P = 0.0000033 × 10,000² = $0.33/token
- Holders gained 10% value!

Verification:
- New reserve integral: (0.0000033 × 10,000³) / 3 = $1,100 ✓
```

**Example: Linear region**
```
Initial state:
- S = 150,000 tokens (50k in linear region)
- s_cap = 100,000
- k_quad = 0.000001
- k_linear = 0.1 (from k_quad × s_cap)
- R = $2,000
- Price at 150,000: P = 0.1 × 150,000 = $15/token

Epoch penalty: -$40 skim, no reward
R_new = $1,960
ratio = 0.98

New values:
- k_quad = 0.000001 × 0.98 = 0.00000098
- k_linear = 0.1 × 0.98 = 0.098
- New price: P = 0.098 × 150,000 = $14.70/token
- Holders lost 2% value (as expected)
```

### Buy/Sell Operations

**Buy (fully in quadratic region)**:
```rust
fn buy_quadratic(pool: &mut ContentPool, usdc_in: u128) -> u128 {
    let s0 = pool.token_supply;

    // Solve: (k_quad/3) × (s1³ - s0³) = usdc_in
    let s1_cubed = s0.pow(3) + (3 * usdc_in) / pool.k_quadratic;
    let s1 = cube_root(s1_cubed);
    let tokens = s1 - s0;

    pool.token_supply = s1;
    pool.reserve += usdc_in;

    return tokens;
}
```

**Sell (crossing boundary from linear to quadratic)**:
```rust
fn sell_crossing_boundary(pool: &mut ContentPool, tokens: u128) -> u128 {
    let s0 = pool.token_supply;  // In linear region
    let s1 = s0 - tokens;         // May be in quadratic region

    if s1 >= pool.s_cap {
        // Stays in linear region
        payout = pool.k_linear × (s0² - s1²) / 2;
    } else {
        // Crosses from linear → quadratic
        // Linear portion: s_cap to s0
        let linear_payout = pool.k_linear × (s0² - pool.s_cap²) / 2;

        // Quadratic portion: s1 to s_cap
        let quad_payout = pool.k_quadratic × (pool.s_cap³ - s1³) / 3;

        payout = linear_payout + quad_payout;
    }

    pool.token_supply = s1;
    pool.reserve -= payout;

    return payout;
}
```

### Works for Pure Linear Curves Too

**If you want a pure linear curve** (no quadratic phase):
```rust
// Set s_cap = 0 (always in "linear" region)
// Or use simplified logic:

struct LinearPool {
    token_supply: u128,
    reserve: u128,
    k: u128,  // Only one coefficient needed
}

// P(s) = k × s
// R = k × S² / 2

fn apply_epoch_effects_linear(pool: &mut LinearPool, skim: u128, reward: u128) {
    let R_old = pool.reserve;
    let R_new = R_old - skim + reward;

    // Same elastic-k formula!
    pool.k = (pool.k * R_new) / R_old;
    pool.reserve = R_new;
}
```

**The elastic-k mechanism is universal across all polynomial bonding curves.**

## Epoch Processing (Every 3 Hours)

### Sequence
1. **Veritas Protocol Runs** (Supabase edge functions)
   - Process all beliefs using current stakes
   - Calculate new aggregate relevance scores
   - Redistribute stakes in DB
   - Update `previous_aggregate` → store delta

2. **Calculate Delta Relevance & Net Adjustments** (Backend)
   - For each belief/post: `Δr = current_aggregate - previous_aggregate`
   - Calculate total skim: `total_skim = Σ(pool.reserve × 0.02)` for all pools
   - Calculate rewards for winners: For pools where Δr > 0:
     - `pool_reward = (total_skim × pool_Δr) / (Σ positive Δr)`
   - Calculate net adjustment per pool: `net = reward - skim`
   - Separate into two lists:
     - **Penalties**: pools where `net < 0` (skim > reward)
     - **Rewards**: pools where `net > 0` (reward > skim)

3. **Transfer Penalties to Treasury** (Solana, Phase 1)
   - For each pool with net penalty: Send USDC from pool vault → treasury vault
   - All penalty transactions sent in parallel
   - Treasury accumulates total penalty amount
   - Apply elastic-k rescaling to penalized pools

4. **Distribute Rewards from Treasury** (Solana, Phase 2)
   - After all penalties collected, distribute to winner pools
   - For each pool with net reward: Send USDC from treasury vault → pool vault
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
  // 1. Get all pools with delta relevance scores
  const pools = await db.pool_deployments
    .join('beliefs', 'beliefs.id', 'pool_deployments.belief_id')
    .select('pool_deployments.*, beliefs.delta_relevance, beliefs.previous_aggregate');

  // 2. Calculate net adjustments
  const totalSkim = pools.reduce((sum, p) => sum + (p.reserve * 0.02), 0);
  const positivePools = pools.filter(p => p.delta_relevance > 0);
  const totalPositiveDelta = positivePools.reduce((sum, p) => sum + p.delta_relevance, 0);

  const adjustments = pools.map(pool => {
    const skim = pool.reserve * 0.02;
    const reward = pool.delta_relevance > 0
      ? (totalSkim * pool.delta_relevance) / totalPositiveDelta
      : 0;
    const netLamports = Math.floor((reward - skim) * 1_000_000); // 6 decimals

    return {
      poolAddress: new PublicKey(pool.pool_address),
      poolUsdcVault: new PublicKey(pool.usdc_vault_address),
      net: netLamports,
    };
  });

  // 3. Separate penalties and rewards
  const penalties = adjustments.filter(a => a.net < 0);
  const rewards = adjustments.filter(a => a.net > 0);

  console.log(`Phase 1: Applying ${penalties.length} penalties`);

  // 4. Phase 1: Send all penalty transactions in parallel
  const penaltySignatures = await Promise.all(
    penalties.map(({ poolAddress, poolUsdcVault, net }) =>
      program.methods
        .applyPoolPenalty(new BN(-net)) // Convert to positive
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

  // 5. Phase 2: Send all reward transactions in parallel
  const rewardSignatures = await Promise.all(
    rewards.map(({ poolAddress, poolUsdcVault, net }) =>
      program.methods
        .applyPoolReward(new BN(net))
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

For 1000 pools with typical distribution:
- ~600-700 pools: Net penalty (skim > reward or Δr ≤ 0)
- ~300-400 pools: Net reward (Δr > 0 with reward > skim)
- **Total: ~1000 transactions** (sent in two parallel batches)
- **Cost: ~$0.05 per epoch** at current Solana prices
- **Time: ~2-3 seconds total** (Phase 1 parallel + Phase 2 parallel)

## Key Design Decisions

### Authority Model
- Backend is pool authority (not permissionless)
- Only backend can trigger skim/redistribute
- Necessary because Veritas runs centrally

### Timing
- Skim AFTER Veritas protocol completes
- Use fresh relevance scores for distribution

### Distribution Formula
```
Pool Reward = (Epoch Pot) × (Pool's Δr) / (Sum of all positive Δr)
```

### Curve Parameters (Recommended)
- **k_quadratic_initial**: 0.000001 (adjustable per pool)
- **s_cap**: 100,000 tokens (where curve switches to linear)
- **k_linear**: Derived as k_quad × s_cap = 0.1
- **Initial price**: P(0) = 0 (zero supply = zero price)
- **Price at cap**: ~$10 (quadratic region peak)
- **Linear growth**: $0.0001 per token after cap

## Data Structures

### Solana Account (ContentPool)
```rust
#[account]
pub struct ContentPool {
    pub pool_id: u64,
    pub post_id: [u8; 32],

    // Elastic piecewise bonding curve
    pub k_quadratic: u128,        // Quadratic coefficient (elastic)
    pub k_linear: u128,           // Linear coefficient (elastic)
    pub supply_cap: u128,         // Where curve transitions

    // State
    pub token_supply: u128,       // Current token supply (changes with trades only)
    pub reserve: u128,            // USDC reserve (6 decimals)

    // Relevance tracking (for backend reference)
    pub current_relevance: u64,
    pub previous_relevance: u64,

    // Admin
    pub authority: Pubkey,
    pub bump: u8,
}
```

### Database Schema (Postgres/Supabase)
```sql
-- Users table addition
ALTER TABLE users ADD COLUMN solana_address TEXT UNIQUE;

-- Beliefs table addition
ALTER TABLE beliefs ADD COLUMN delta_relevance NUMERIC;

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

-- New table: Custodian deposits
CREATE TABLE custodian_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),
    solana_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    deposited_at TIMESTAMP DEFAULT NOW(),
    status TEXT CHECK (status IN ('pending', 'confirmed', 'failed'))
);

-- New table: Custodian withdrawals
CREATE TABLE custodian_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),
    solana_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT UNIQUE,
    requested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);
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
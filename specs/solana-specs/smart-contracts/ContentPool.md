# ContentPool Smart Contract

## High-Level Overview

### Purpose
ContentPool creates a two-sided prediction market for content relevance using ICBS (Inversely Coupled Bonding Surface). Users can bet on content gaining relevance (buy LONG) or losing relevance (buy SHORT). The pool settles against absolute BD (Belief Decomposition) scores, adjusting reserve ratios to reward accurate predictions.

### Core Innovation: ICBS with Ratio-Based Settlement
The ICBS bonding surface creates inverse coupling between LONG and SHORT sides - buying one makes the other cheaper. Settlement scales virtual reserves by accuracy factors (f_L = x/q, f_S = (1-x)/(1-q)), implementing a proper scoring rule without cross-pool dependencies.

### Economic Flow
1. **Market deployment** - First trader seeds pool with $100+ USDC, setting initial prediction q
2. **Users speculate** - Buy LONG if bullish, SHORT if bearish on content relevance
3. **Protocol measures** - BD algorithm calculates absolute relevance score x ∈ [0, 1]
4. **Settlement** - Reserves scale by f = x/q (LONG) and f = (1-x)/(1-q) (SHORT)
5. **Value redistribution** - Correct predictions gain, incorrect predictions lose (zero-sum)

## Mathematical Foundation

### ICBS Cost Function

The pool uses an inversely coupled bonding surface that provides manipulation resistance through inverse price coupling:

**Cost Function:**
$$C(s_L, s_S) = (s_L^{F/\beta} + s_S^{F/\beta})^{\beta}$$

Where:
- `s_L`, `s_S` = LONG/SHORT token supplies (Q64.64 fixed-point)
- `F` = growth exponent (default: 1 for numerical stability and 1-homogeneity)
- `β` = coupling coefficient (default: 0.5)

**Marginal Prices:**
$$p_L = \lambda_L \times F \times s_L^{F/\beta - 1} \times (s_L^{F/\beta} + s_S^{F/\beta})^{\beta - 1}$$
$$p_S = \lambda_S \times F \times s_S^{F/\beta - 1} \times (s_L^{F/\beta} + s_S^{F/\beta})^{\beta - 1}$$

**With default parameters (F=1, β=0.5):**
$$p_L = \lambda_L \times s_L \times (s_L^2 + s_S^2)^{-0.5} = \lambda_L \times \frac{s_L}{\sqrt{s_L^2 + s_S^2}}$$

**Key Properties:**
- **1-homogeneous**: C(λs_L, λs_S) = λ × C(s_L, s_S) (exact with F=1)
- **Inverse coupling**: Buying LONG increases p_L and decreases p_S
- **Manipulation resistant**: Can't pump one side without making the other cheap
- **Symmetric**: C(s_L, s_S) = C(s_S, s_L) when parameters are equal

### Virtual Reserves

Due to homogeneity, virtual reserves equal simple products (no integration needed):

**Reserve Calculation:**
$$R_L = s_L \times p_L$$
$$R_S = s_S \times p_S$$
$$R_{total} = R_L + R_S = C(s_L, s_S)$$

**Market Prediction (Reserve Ratio):**
$$q = \frac{R_L}{R_L + R_S}$$

Where q ∈ [0, 1] represents the market's predicted relevance score.

**Nash Equilibrium:**
Rational traders buy LONG until expected profit = 0, which occurs when q = E[x].

### Settlement Mechanics

Settlement scales reserves based on prediction accuracy:

**Settlement Factors:**
$$f_L = \frac{x}{q}$$
$$f_S = \frac{1 - x}{1 - q}$$

Where:
- `x` = BD score (actual relevance) ∈ [0, 1]
- `q` = market prediction (before settlement)
- q is clamped to [1%, 99%] to prevent division issues

**Reserve Scaling:**
$$R_L' = R_L \times f_L$$
$$R_S' = R_S \times f_S$$

**Properties:**
- Token supplies (s_L, s_S) never change during settlement
- Prices scale proportionally: p' = p × f
- Position values change: value' = tokens × p × f
- Zero-sum: R_L' + R_S' = R_L + R_S
- Convergence: q' = x after settlement

**Examples:**

| q (prediction) | x (actual) | f_L  | f_S  | LONG gain | SHORT gain |
|----------------|------------|------|------|-----------|------------|
| 0.5            | 0.5        | 1.0  | 1.0  | 0%        | 0%         |
| 0.4            | 0.6        | 1.5  | 0.67 | +50%      | -33%       |
| 0.8            | 0.2        | 0.25 | 4.0  | -75%      | +300%      |

## Configurable Parameters

### Global Parameters (PoolFactory)
Set at factory level, applied to all new pools:

| Parameter | Purpose | Default Value | Range |
|-----------|---------|---------------|-------|
| `default_f` | Growth exponent | 1 | [1, 10] |
| `default_beta_num` | β numerator | 1 | > 0 |
| `default_beta_den` | β denominator | 2 (β=0.5) | > 0 |
| `min_initial_deposit` | Minimum deployment | 100 USDC | > 0 |
| `min_settle_interval` | Settlement cooldown | 300 seconds | > 0 |

### Per-Pool Parameters (ContentPool)
Set at pool initialization:

| Parameter | Purpose | Set At | Can Update? |
|-----------|---------|--------|-------------|
| `f` | Growth exponent | Initialization | No |
| `beta_num/beta_den` | Coupling coefficient | Initialization | No |
| `sqrt_lambda_long_x96` | LONG curve scale | Market deployment | Yes (settlement) |
| `sqrt_lambda_short_x96` | SHORT curve scale | Market deployment | Yes (settlement) |
| `min_settle_interval` | Cooldown period | Initialization | No |

### Economic Impact Examples

**Low Coupling (β=0.9):**
- Weak inverse coupling
- LONG and SHORT prices more independent
- Less manipulation resistance

**Moderate Coupling (β=0.5):**
- Balanced inverse coupling
- Strong manipulation resistance
- **Default configuration**

**High Coupling (β=0.1):**
- Very strong inverse coupling
- Maximum manipulation resistance
- Prices heavily interdependent

---

## Low-Level Implementation Specification

### Data Structures

#### Primary Account: ContentPool

```rust
#[account]
pub struct ContentPool {
    // Identity (96 bytes)
    pub content_id: Pubkey,           // Post/belief identifier (32 bytes)
    pub creator: Pubkey,              // Pool creator (32 bytes)
    pub market_deployer: Pubkey,      // First trader who deployed market (32 bytes)

    // Mints (64 bytes)
    pub long_mint: Pubkey,            // SPL token mint for LONG side (32 bytes)
    pub short_mint: Pubkey,           // SPL token mint for SHORT side (32 bytes)

    // Vaults (64 bytes)
    pub vault: Pubkey,                // USDC vault for this pool (32 bytes)
    pub stake_vault: Pubkey,          // Global stake vault (VeritasCustodian) (32 bytes)

    // ICBS Parameters (16 bytes)
    pub f: u16,                       // Growth exponent (default: 3)
    pub beta_num: u16,                // β numerator (default: 1)
    pub beta_den: u16,                // β denominator (default: 2, so β = 0.5)
    pub _padding1: [u8; 10],          // Alignment padding

    // Token Supplies - Integer (16 bytes)
    pub s_long: u64,                  // LONG token supply (integer, 6 decimals)
    pub s_short: u64,                 // SHORT token supply (integer, 6 decimals)

    // Virtual Reserves - Integer (16 bytes)
    pub r_long: u64,                  // LONG virtual reserve (R_L = s_L × p_L)
    pub r_short: u64,                 // SHORT virtual reserve (R_S = s_S × p_S)

    // Square Root Prices - X96 (32 bytes)
    pub sqrt_price_long_x96: u128,    // sqrt(price_long) * 2^96
    pub sqrt_price_short_x96: u128,   // sqrt(price_short) * 2^96

    // Square Root Lambda Scale - X96 (32 bytes)
    pub sqrt_lambda_long_x96: u128,   // sqrt(λ_L) * 2^96
    pub sqrt_lambda_short_x96: u128,  // sqrt(λ_S) * 2^96

    // Settlement (16 bytes)
    pub last_settle_ts: i64,          // Last settlement timestamp (8 bytes)
    pub min_settle_interval: i64,     // Cooldown between settlements (default: 300s)

    // Stats (16 bytes)
    pub vault_balance: u64,           // Actual USDC in vault (for invariant checking)
    pub initial_q: u64,               // Initial q set by deployer (Q32.32)

    // Factory Reference (32 bytes)
    pub factory: Pubkey,              // PoolFactory that created this pool

    // Bump (1 byte + 7 padding)
    pub bump: u8,                     // PDA bump seed
    pub _padding2: [u8; 7],           // Alignment
}
// Total: 408 bytes + 8 discriminator = 416 bytes
```

**PDA Derivation:**
```rust
seeds = [b"content_pool", content_id.as_ref()]
(address, bump) = Pubkey::find_program_address(seeds, program_id)
```

#### Constants

```rust
// Supply Limits
pub const MAX_SAFE_SUPPLY: u64 = 1_000_000_000_000;  // 1 trillion tokens (with 6 decimals)
pub const MIN_TRADE_SIZE: u64 = 1_000;               // 0.001 USDC
pub const MAX_TRADE_SIZE: u64 = 1_000_000_000_000;   // 1M USDC

// Initial Deposit Limits
pub const MIN_INITIAL_DEPOSIT: u64 = 100_000_000;    // 100 USDC (6 decimals)
pub const MAX_INITIAL_DEPOSIT: u64 = 10_000_000_000; // 10K USDC (6 decimals)

// Price Bounds (in micro-USDC per token)
pub const MIN_PRICE_MICRO: u64 = 1;                  // 0.000001 USDC/token
pub const MAX_PRICE_MICRO: u64 = 1_000_000_000_000;  // 1M USDC/token

// Settlement
pub const MIN_PREDICTION_BPS: u16 = 100;      // 1% in basis points
pub const MAX_PREDICTION_BPS: u16 = 9900;     // 99% in basis points
pub const MIN_SETTLE_INTERVAL: i64 = 300;     // 5 minutes

// Fixed-Point for X96 format
pub const Q96_ONE: u128 = 1 << 96;        // 1.0 in X96
pub const Q32_ONE: u64 = 1 << 32;         // 1.0 in Q32.32 (for BD scores)

// Q64.64 constants (for settlement logic)
pub const Q64_ONE: u128 = 1 << 64;
pub const Q64_MIN_PREDICTION: u128 = Q64_ONE / 100;      // 1%
pub const Q64_MAX_PREDICTION: u128 = Q64_ONE * 99 / 100; // 99%
pub const ROUNDING_TOLERANCE: u128 = 1000;

// Decimals
pub const USDC_DECIMALS: u8 = 6;
pub const TOKEN_DECIMALS: u8 = 6;  // Changed from 9 to match USDC

// Flat Rate (Market Deployment) - in micro-USDC
pub const FLAT_RATE: u64 = 1_000_000;  // 1 USDC per token initial price

// Default ICBS Parameters
pub const DEFAULT_F: u16 = 1;  // Growth exponent (reduced from 3 to avoid numerical overflow)
pub const DEFAULT_BETA_NUM: u16 = 1;
pub const DEFAULT_BETA_DEN: u16 = 2;  // β = 0.5
```

### Function Signatures

#### State Modifying Functions

**Note**: Pool creation is handled by `PoolFactory::create_pool`, not by ContentPool directly. ContentPool instructions are called after the pool account is initialized.

```rust
// 1. Deploy market (first trader seeds liquidity)
// Called after PoolFactory::create_pool has initialized the pool account
pub fn deploy_market(
    ctx: Context<DeployMarket>,
    initial_deposit: u64,         // Total USDC (min: 100 USDC)
    long_allocation: u64,         // USDC allocated to LONG side
) -> Result<()>

// 2. Trade (buy or sell tokens)
pub fn trade(
    ctx: Context<Trade>,
    side: TokenSide,              // LONG or SHORT
    trade_type: TradeType,        // BUY or SELL
    amount: u64,                  // USDC for buy, tokens for sell
    stake_skim: u64,              // Backend-calculated (buys only)
    min_tokens_out: u64,          // Slippage protection (buys)
    min_usdc_out: u64,            // Slippage protection (sells)
) -> Result<()>

// 3. Settle epoch (protocol authority + user)
pub fn settle_epoch(
    ctx: Context<SettleEpoch>,
    bd_score: u32,                // BD score in Q32.32 [0, 2^32]
) -> Result<()>

// 4. Add liquidity (any user)
pub fn add_liquidity(
    ctx: Context<AddLiquidity>,
    usdc_amount: u64,              // Total USDC to add
) -> Result<()>

// 5. Close pool (creator + protocol authority)
pub fn close_pool(
    ctx: Context<ClosePool>,
) -> Result<()>
```

#### View Functions

```rust
// Pool state (Solana accounts are readable by default)
// Clients read ContentPool account directly and calculate:
//   - Current prices: p_L, p_S using ICBS formulas
//   - Reserve ratio: q = R_L / (R_L + R_S)
//   - Position value: tokens × price
```

### Instruction Contexts

```rust
#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 352,
        seeds = [b"content_pool", content_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    pub content_id: UncheckedAccount<'info>,
    #[account(mut)]
    pub factory: Account<'info, PoolFactory>,
    pub creator: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeployMarket<'info> {
    #[account(
        mut,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump,
        constraint = pool.market_deployer == Pubkey::default() @ ErrorCode::MarketAlreadyDeployed
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"long_mint", pool.content_id.as_ref()],
        bump
    )]
    pub long_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"short_mint", pool.content_id.as_ref()],
        bump
    )]
    pub short_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = pool,
        seeds = [b"vault", pool.content_id.as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub deployer_usdc: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = payer, associated_token::mint = long_mint, associated_token::authority = deployer)]
    pub deployer_long: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = payer, associated_token::mint = short_mint, associated_token::authority = deployer)]
    pub deployer_short: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub deployer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(
        mut,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump,
        constraint = pool.market_deployer != Pubkey::default() @ ErrorCode::MarketNotDeployed
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(mut)]
    pub factory: Account<'info, PoolFactory>,

    #[account(mut)]
    pub trader_usdc: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault.key() == pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = stake_vault.key() == pool.stake_vault)]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(init_if_needed, payer = payer, associated_token::mint = token_mint, associated_token::authority = trader)]
    pub trader_tokens: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,

    pub trader: Signer<'info>,
    #[account(constraint = protocol_authority.key() == factory.pool_authority)]
    pub protocol_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleEpoch<'info> {
    #[account(
        mut,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(constraint = factory.key() == pool.factory)]
    pub factory: Account<'info, PoolFactory>,

    #[account(constraint = protocol_authority.key() == factory.pool_authority)]
    pub protocol_authority: Signer<'info>,

    pub settler: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClosePool<'info> {
    #[account(
        mut,
        close = creator,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump,
        constraint = pool.creator == creator.key()
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(constraint = factory.key() == pool.factory)]
    pub factory: Account<'info, PoolFactory>,

    #[account(mut, constraint = vault.key() == pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_usdc: Account<'info, TokenAccount>,

    pub creator: Signer<'info>,
    #[account(constraint = protocol_authority.key() == factory.pool_authority)]
    pub protocol_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
```

### Events

```rust
#[event]
pub struct PoolInitializedEvent {
    pub pool: Pubkey,
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub f: u16,
    pub beta_num: u16,
    pub beta_den: u16,
    pub timestamp: i64,
}

#[event]
pub struct MarketDeployedEvent {
    pub pool: Pubkey,
    pub deployer: Pubkey,
    pub initial_deposit: u64,
    pub long_allocation: u64,
    pub short_allocation: u64,
    pub initial_q: u64,             // Q32.32
    pub long_tokens: u64,
    pub short_tokens: u64,
    pub timestamp: i64,
}

#[event]
pub struct TradeEvent {
    pub pool: Pubkey,
    pub trader: Pubkey,
    pub side: TokenSide,
    pub trade_type: TradeType,
    pub usdc_amount: u64,           // Total USDC
    pub usdc_to_trade: u64,         // After skim
    pub usdc_to_stake: u64,         // Skim amount
    pub tokens_out: u64,
    pub new_price: u128,            // Price in micro-USDC
    pub token_supply_after: u128,   // Total token supply after trade
    pub reserve_after: u64,         // USDC reserve after trade
    pub timestamp: i64,
}

#[event]
pub struct SettlementEvent {
    pub pool: Pubkey,
    pub settler: Pubkey,
    pub bd_score: u32,              // BD score (micro-units, 0-1M)
    pub market_prediction_q: u128,  // Market prediction (micro-units)
    pub f_long: u128,               // Settlement factor for LONG (micro-units)
    pub f_short: u128,              // Settlement factor for SHORT (micro-units)
    pub r_long_before: u128,        // Virtual reserve before settlement
    pub r_short_before: u128,       // Virtual reserve before settlement
    pub r_long_after: u128,         // Virtual reserve after settlement
    pub r_short_after: u128,        // Virtual reserve after settlement
    pub timestamp: i64,
}

#[event]
pub struct PoolClosedEvent {
    pub pool: Pubkey,
    pub creator: Pubkey,
    pub remaining_usdc: u64,
    pub timestamp: i64,
}
```

### Error Codes

```rust
#[error_code]
pub enum ContentPoolError {
    // Initialization (6000-6009)
    #[msg("Invalid growth exponent F (must be 1-10)")]
    InvalidExponent,
    #[msg("Invalid coupling coefficient β (must be 0.1-0.9)")]
    InvalidBeta,
    #[msg("Invalid factory address")]
    InvalidFactory,

    // Market deployment (6010-6019)
    #[msg("Market already deployed for this pool")]
    MarketAlreadyDeployed,
    #[msg("Market not deployed yet")]
    MarketNotDeployed,
    #[msg("Initial deposit below minimum ($100 USDC)")]
    BelowMinimumDeposit,
    #[msg("Invalid LONG/SHORT allocation")]
    InvalidAllocation,

    // Trade (6020-6039)
    #[msg("Trade size below minimum")]
    TradeTooSmall,
    #[msg("Trade size above maximum")]
    TradeTooLarge,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid stake skim amount")]
    InvalidStakeSkim,
    #[msg("Invalid trade amount")]
    InvalidTradeAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Supply overflow (exceeds safety bound)")]
    SupplyOverflow,

    // Settlement (6040-6049)
    #[msg("Settlement cooldown not elapsed")]
    SettlementCooldown,
    #[msg("Invalid BD score (must be 0-1 in Q32.32)")]
    InvalidBDScore,
    #[msg("No liquidity in pool")]
    NoLiquidity,
    #[msg("Settlement invariant violated")]
    SettlementInvariantViolation,
    #[msg("Settlement convergence failed")]
    SettlementConvergenceFailed,

    // Math (6050-6059)
    #[msg("Numerical overflow")]
    NumericalOverflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Reserve invariant violated")]
    ReserveInvariantViolation,
    #[msg("Price calculation failed")]
    PriceCalculationFailed,
    #[msg("Solver failed to converge")]
    SolverConvergenceFailed,

    // Authority (6060-6069)
    #[msg("Unauthorized (not pool creator)")]
    Unauthorized,
    #[msg("Unauthorized protocol authority")]
    UnauthorizedProtocol,

    // Accounts (6070-6079)
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid vault")]
    InvalidVault,
    #[msg("Invalid stake vault")]
    InvalidStakeVault,
    #[msg("Invalid owner")]
    InvalidOwner,

    // Closure (6080-6089)
    #[msg("Positions still open (cannot close pool)")]
    PositionsStillOpen,
    #[msg("Vault not empty")]
    VaultNotEmpty,
}
```

---

## Integration Points

### PoolFactory
- Pool created via `PoolFactory::create_pool`
- Factory validates content_id exists (backend check)
- Pool stores factory address for authority validation

### VeritasCustodian
- Pool references global stake vault
- Trade instruction sends stake skim to custodian vault
- Backend validates stake sufficiency before signing

### Backend (Protocol Authority)
- Signs trades after calculating stake skim
- Signs settlements after running BD algorithm
- Uses keypair from `./solana/veritas-curation/keys/authority.json` (local/devnet)

### Database
- Event indexer syncs TradeEvent → user_positions, user_stakes
- Event indexer syncs SettlementEvent → bd_scores
- Optimistic locking via version fields prevents race conditions

---

**Related Specifications:**
- [PoolFactory.md](PoolFactory.md) - Pool creation and registry
- [VeritasCustodian.md](archive/VeritasCustodian.md) - Stake custody
- [ICBS-EXPLAINED.md](ICBS-EXPLAINED.md) - Conceptual overview
- [ICBS-anchor-spec.md](ICBS-anchor-spec.md) - Detailed implementation guide

**Implementation Guidance:**
- [implementation-guidance.md](implementation-guidance.md) - Detailed validation, testing, security considerations

# ContentPool Smart Contract

## High-Level Overview

### Purpose
ContentPool creates a speculation market for content relevance using a bonding curve mechanism with real SPL tokens. Users can bet on whether content will gain or lose relevance by buying tokens from the curve (minting) or selling tokens back to the curve (burning). The protocol automatically redistributes value between pools each epoch based on relevance changes.

### Core Innovation: Elastic-K Mechanism
When the protocol applies penalties or rewards, we scale the bonding curve coefficients (k values) proportionally to reserve changes. This ensures all token holders gain/lose value equally without requiring token rebalancing.

### Economic Flow
1. **Users speculate** by buying tokens when they believe content will gain relevance
2. **Protocol measures** actual relevance changes via Veritas BTS scoring
3. **Value redistributes** automatically - declining content pools lose USDC to rising content pools
4. **Token prices adjust** via elastic-k scaling, rewarding correct predictions

## Mathematical Foundation

### Reserve-Based Bonding Curve with Dampened Linear Region
The pool uses a two-phase price function with reserve-based transitions and self-dampening:

**Price Function:**
$$P(s) = \begin{cases}
k_{quadratic} \times s^2 & \text{if } reserve < reserve_{cap} \\
P_{transition} + linear\_slope \times (s - s_{transition}) \times \frac{L}{L + s} & \text{if } reserve \geq reserve_{cap}
\end{cases}$$

Where:
- `s` = current token supply
- `reserve` = total USDC in pool
- `reserve_cap` = reserve transition point (e.g., $5,000 USDC)
- `k_quadratic` = quadratic coefficient (determines early price growth)
- `linear_slope` = linear region base slope (stored directly, not derived)
- `virtual_liquidity` = L parameter for dampening factor
- `s_transition` = token supply at reserve_cap (calculated as ∛(3 × reserve_cap / k_quadratic))
- `P_transition` = price at transition point (k_quadratic × s_transition²)

**Key Innovation - Self-Enforcing Dampening:**
The dampening factor L/(L+s) naturally simulates AMM-like market depth:
- Early linear phase (s ≈ 10K): dampening ≈ 0.9999 (full slope)
- Mid phase (s ≈ 10M): dampening ≈ 0.91 (91% of slope)
- Late phase (s ≈ 100M): dampening ≈ 0.50 (50% of slope)
- Asymptotic (s → ∞): dampening → 0 (price stabilizes)

### Reserve Calculation
The reserve (total USDC in pool) equals the integral of the price function:

**Quadratic Region Only (reserve < reserve_cap):**
$$R = \int_0^s k_{quadratic} \times x^2 \, dx = \frac{k_{quadratic} \times s^3}{3}$$

**Dampened Linear Region (reserve ≥ reserve_cap):**
The reserve includes the quadratic portion plus the dampened linear integral:
$$R = reserve_{cap} + \int_{s_{transition}}^s \left(P_{transition} + slope \times (x - s_{transition}) \times \frac{L}{L + x}\right) \, dx$$

Note: The dampening integral is complex but ensures smooth, self-regulating price growth that naturally slows as supply increases.

### Elastic-K Scaling
When the protocol adds/removes USDC without user trades (epoch adjustments):

**Scaling Ratio:**
$$ratio = \frac{R_{new}}{R_{old}}$$

**Coefficient Updates:**
$$k_{quadratic}^{new} = k_{quadratic}^{old} \times ratio$$
$$k_{linear}^{new} = k_{linear}^{old} \times ratio$$

**Properties Preserved:**
- Token supply unchanged
- Reserve consistency maintained (integral still equals reserve)
- All holders affected proportionally
- Price continuity at s_cap maintained

## Configurable Parameters

### Global Parameters (ProtocolConfig)
Stored on-chain in singleton PDA, adjustable by protocol authority:

| Parameter | Purpose | Default Value | Range |
|-----------|---------|---------------|-------|
| `default_k_quadratic` | Default steepness of quadratic curve | 200 (0.0002) | [100, 10,000,000] |
| `default_reserve_cap` | Default reserve for linear transition | 5,000,000,000 ($5,000 USDC) | [$1K, $1M USDC] |
| `default_linear_slope` | Default slope in linear region | 1,000 (0.001) | [100, 100,000] |
| `default_virtual_liquidity` | Default dampening parameter | 100,000,000,000 (100M tokens) | [1M, 10B tokens] |
| `min_k_quadratic` | Minimum allowed k for new pools | 100 (0.0001) | > 0 |
| `max_k_quadratic` | Maximum allowed k for new pools | 10,000,000 (10.0) | > min_k |
| `min_reserve_cap` | Minimum reserve for transition | 1,000,000,000 ($1,000 USDC) | > 0 |
| `max_reserve_cap` | Maximum reserve for transition | 1,000,000,000,000 ($1M USDC) | > min_cap |
| `min_trade_amount` | Minimum buy/sell amount | 1,000,000 (1 USDC) | > 0 |

### Per-Pool Parameters (ContentPool)
Set at pool creation, some can be updated:

| Parameter | Purpose | Set At | Can Update? |
|-----------|---------|--------|-------------|
| `k_quadratic` | Actual quadratic coefficient | Initialization (validated against bounds) | Via elastic-k only |
| `reserve_cap` | Reserve transition point (e.g. $5K USDC) | Initialization (validated against bounds) | Yes (authority only) |
| `linear_slope` | Slope in linear region | Initialization (uses default from config) | No (immutable after creation) |
| `virtual_liquidity` | Dampening parameter L | Initialization (uses default from config) | No (immutable after creation) |

### Economic Impact Examples

**Flat Curve (k=100, cap=50K):**
- Early adopter advantage: Low
- Accessibility: High
- Speculation upside: Limited

**Steep Curve (k=10,000, cap=200K):**
- Early adopter advantage: Very high
- Accessibility: Lower (expensive after 10K tokens)
- Speculation upside: Significant

**Short Quadratic Phase (k=1,000, cap=10K):**
- Quick transition to linear
- Less explosive growth
- More sustainable long-term

**Long Quadratic Phase (k=1,000, cap=500K):**
- Extended explosive growth period
- High speculation potential
- May never reach linear for small content

---

## Low-Level Implementation Specification

### Data Structures

#### Primary Account: ContentPool
```rust
#[account]
pub struct ContentPool {
    // Identification (32 bytes)
    pub post_id: [u8; 32],      // Hash identifier of content (unique key)

    // Bonding Curve Parameters (64 bytes)
    pub k_quadratic: u128,      // Quadratic coefficient (mutable via elastic-k)
    pub reserve_cap: u128,      // Reserve amount at linear transition (e.g. $5K USDC)
    pub linear_slope: u128,     // Slope in linear region (dampened by L/(L+s))
    pub virtual_liquidity: u128, // Virtual liquidity L for dampening factor

    // Current State (32 bytes)
    pub token_supply: u128,     // Total SPL tokens minted
    pub reserve: u128,          // Total USDC in pool (6 decimals)

    // Token Information (75 bytes)
    pub token_mint: Pubkey,     // SPL token mint address (32 bytes)
    pub token_name: [u8; 32],   // Token name (32 bytes)
    pub token_symbol: [u8; 10], // Token symbol (10 bytes)
    pub token_decimals: u8,     // Token decimals - always 6 (1 byte)

    // Accounts (64 bytes)
    pub usdc_vault: Pubkey,     // Associated token account for USDC
    pub factory: Pubkey,        // Reference to PoolFactory (authority source of truth)

    // PDA (1 byte)
    pub bump: u8,               // PDA bump seed
}
// Total: 268 bytes + 8 discriminator = 276 bytes
```

**PDA Derivation:**
```rust
seeds = [b"pool", post_id]
(address, bump) = Pubkey::find_program_address(seeds, program_id)
```

#### Protocol Configuration Account
```rust
#[account]
pub struct ProtocolConfig {
    // Authority (33 bytes)
    pub authority: Pubkey,              // 32 bytes
    pub bump: u8,                       // 1 byte

    // Default curve parameters (64 bytes)
    pub default_k_quadratic: u128,      // 16 bytes
    pub default_reserve_cap: u128,      // 16 bytes - e.g. $5K USDC
    pub default_linear_slope: u128,     // 16 bytes - slope in linear region
    pub default_virtual_liquidity: u128, // 16 bytes - dampening parameter

    // Validation bounds (96 bytes)
    pub min_k_quadratic: u128,          // 16 bytes
    pub max_k_quadratic: u128,          // 16 bytes
    pub min_reserve_cap: u128,          // 16 bytes - e.g. $1K minimum
    pub max_reserve_cap: u128,          // 16 bytes - e.g. $1M maximum
    pub min_linear_slope: u128,         // 16 bytes
    pub max_linear_slope: u128,         // 16 bytes

    // Trading limits (8 bytes)
    pub min_trade_amount: u64,          // 8 bytes

    // Reserved for future use (32 bytes)
    pub reserved: [u64; 4],             // 32 bytes - reduced to make room
}
// Total: 233 bytes + 8 discriminator = 241 bytes

// PDA: seeds = [b"config"]
```

#### Constants
```rust
// Precision (immutable)
const USDC_DECIMALS: u8 = 6;
const RATIO_PRECISION: u128 = 1_000_000;

// Default initial values (used if no ProtocolConfig exists)
// Reserve-based linear transition at $5K with dampening
const DEFAULT_K_QUADRATIC: u128 = 200;                  // 0.0002 in real terms (lower for better transition price)
const DEFAULT_RESERVE_CAP: u128 = 5_000_000_000;        // $5K USDC (with 6 decimals)
const DEFAULT_LINEAR_SLOPE: u128 = 1_000;               // 0.001 slope in linear region
const DEFAULT_VIRTUAL_LIQUIDITY: u128 = 100_000_000_000; // 100M tokens for dampening

// Bounds for parameters
const DEFAULT_MIN_K_QUADRATIC: u128 = 100;              // Min 0.0001
const DEFAULT_MAX_K_QUADRATIC: u128 = 10_000_000;       // Max 10
const DEFAULT_MIN_RESERVE_CAP: u128 = 1_000_000_000;    // Min $1K USDC
const DEFAULT_MAX_RESERVE_CAP: u128 = 1_000_000_000_000; // Max $1M USDC
const DEFAULT_MIN_LINEAR_SLOPE: u128 = 100;             // Min 0.0001
const DEFAULT_MAX_LINEAR_SLOPE: u128 = 100_000;         // Max 0.1
const DEFAULT_MIN_VIRTUAL_LIQUIDITY: u128 = 1_000_000_000; // Min 1M tokens
const DEFAULT_MAX_VIRTUAL_LIQUIDITY: u128 = 10_000_000_000_000; // Max 10B tokens
const DEFAULT_MIN_TRADE_AMOUNT: u64 = 1_000_000;        // 1 USDC
```

### Function Signatures

#### State Modifying Functions

```rust
// 0. Initialize protocol configuration (one-time setup)
pub fn initialize_config(
    ctx: Context<InitializeConfig>,
) -> Result<()>

// 1. Update protocol configuration
pub fn update_config(
    ctx: Context<UpdateConfig>,
    default_k_quadratic: Option<u128>,
    default_reserve_cap: Option<u128>,
    default_linear_slope: Option<u128>,
    default_virtual_liquidity: Option<u128>,
    min_k_quadratic: Option<u128>,
    max_k_quadratic: Option<u128>,
    min_reserve_cap: Option<u128>,
    max_reserve_cap: Option<u128>,
    min_linear_slope: Option<u128>,
    max_linear_slope: Option<u128>,
    min_trade_amount: Option<u64>,
) -> Result<()>

// 2. Create new pool
pub fn initialize_pool(
    ctx: Context<InitializePool>,
    post_id: [u8; 32],
    initial_k_quadratic: u128,
    reserve_cap: u128,
    token_name: String,
    token_symbol: String,
) -> Result<()>

// 3. User buys tokens with USDC
pub fn buy(
    ctx: Context<Buy>,
    usdc_amount: u64,
) -> Result<()>

// 4. User sells tokens for USDC
pub fn sell(
    ctx: Context<Sell>,
    token_amount: u128,
) -> Result<()>

// 5. Protocol applies penalty (removes USDC)
pub fn apply_pool_penalty(
    ctx: Context<ApplyPoolPenalty>,
    penalty_amount: u64,
) -> Result<()>

// 6. Protocol applies reward (adds USDC)
pub fn apply_pool_reward(
    ctx: Context<ApplyPoolReward>,
    reward_amount: u64,
) -> Result<()>

// 7. Protocol adjusts reserve cap
pub fn set_reserve_cap(
    ctx: Context<SetReserveCap>,
    new_reserve_cap: u128,
) -> Result<()>
```

#### View Functions

```rust
// 8. Get current pool state (Solana accounts are readable by default)
// No function needed - clients read ContentPool account directly
// Calculations done client-side:
//   - current_price = calculate_price(token_supply)
//   - is_in_linear = token_supply > supply_cap
//   - market_cap = current_price * token_supply

// 9. Get protocol configuration (Solana accounts are readable by default)
// No function needed - clients read ProtocolConfig account directly
```

### Instruction Contexts

```rust
#[derive(Accounts)]
#[instruction(post_id: [u8; 32])]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 161,
        seeds = [b"pool", post_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    // Optional: May not exist for first pools
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub usdc_mint: Account<'info, Mint>,
    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

## Detailed Implementation

### 0. Initialize Protocol Configuration

Creates the singleton protocol configuration account (one-time setup).

**Validation:**
```rust
// ProtocolConfig must not already exist (Anchor init constraint handles this)
```

**State Initialization:**
```rust
// Initialize with default values
config.authority = authority.key();
config.bump = bump;

config.default_k_quadratic = DEFAULT_K_QUADRATIC;
config.default_supply_cap = DEFAULT_SUPPLY_CAP;

config.min_k_quadratic = DEFAULT_MIN_K_QUADRATIC;
config.max_k_quadratic = DEFAULT_MAX_K_QUADRATIC;
config.min_supply_cap = DEFAULT_MIN_SUPPLY_CAP;
config.max_supply_cap = DEFAULT_MAX_SUPPLY_CAP;
config.min_trade_amount = DEFAULT_MIN_TRADE_AMOUNT;

config.reserved = [0; 8]; // Zero-initialized for future use
```

**Context:**
```rust
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 185,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

---

### 1. Update Protocol Configuration

Updates protocol-wide parameters (authority only).

**Validation:**
```rust
require!(ctx.accounts.authority.key() == config.authority, ErrorCode::Unauthorized);

// Validate new bounds if provided
if let Some(min_k) = min_k_quadratic {
    require!(min_k > 0, ErrorCode::InvalidParameters);
}
if let Some(max_k) = max_k_quadratic {
    require!(max_k >= config.min_k_quadratic, ErrorCode::InvalidParameters);
}
if let Some(min_cap) = min_supply_cap {
    require!(min_cap > 0, ErrorCode::InvalidParameters);
}
if let Some(max_cap) = max_supply_cap {
    require!(max_cap >= config.min_supply_cap, ErrorCode::InvalidParameters);
}
```

**State Updates:**
```rust
// Update only provided values (Option pattern)
if let Some(val) = default_k_quadratic {
    config.default_k_quadratic = val;
}
if let Some(val) = default_supply_cap {
    config.default_supply_cap = val;
}
if let Some(val) = min_k_quadratic {
    config.min_k_quadratic = val;
}
if let Some(val) = max_k_quadratic {
    config.max_k_quadratic = val;
}
if let Some(val) = min_supply_cap {
    config.min_supply_cap = val;
}
if let Some(val) = max_supply_cap {
    config.max_supply_cap = val;
}
if let Some(val) = min_trade_amount {
    config.min_trade_amount = val;
}
```

**Context:**
```rust
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,
}
```

---

### 2. Initialize Pool

Creates a new content speculation pool with bonding curve parameters.

**Validation:**
```rust
// Load config (may not exist for first pool - use defaults)
let config = ctx.accounts.config.as_ref();

let min_k = config.map_or(DEFAULT_MIN_K_QUADRATIC, |c| c.min_k_quadratic);
let max_k = config.map_or(DEFAULT_MAX_K_QUADRATIC, |c| c.max_k_quadratic);
let min_cap = config.map_or(DEFAULT_MIN_SUPPLY_CAP, |c| c.min_supply_cap);
let max_cap = config.map_or(DEFAULT_MAX_SUPPLY_CAP, |c| c.max_supply_cap);

// Validate against bounds
require!(initial_k_quadratic >= min_k, ErrorCode::InvalidParameters);
require!(initial_k_quadratic <= max_k, ErrorCode::InvalidParameters);
require!(supply_cap >= min_cap, ErrorCode::InvalidParameters);
require!(supply_cap <= max_cap, ErrorCode::InvalidParameters);
```

**State Initialization:**
```rust
// Validate and store token metadata
require!(token_name.len() <= 32, ErrorCode::InvalidParameters);
require!(token_symbol.len() <= 10, ErrorCode::InvalidParameters);

let mut name_bytes = [0u8; 32];
name_bytes[..token_name.len()].copy_from_slice(token_name.as_bytes());
let mut symbol_bytes = [0u8; 10];
symbol_bytes[..token_symbol.len()].copy_from_slice(token_symbol.as_bytes());

// Initialize pool account (k_linear not stored, will be derived)
pool.post_id = post_id;
pool.factory = factory.key();  // Reference to PoolFactory for authority lookup
pool.token_mint = token_mint.key();
pool.token_name = name_bytes;
pool.token_symbol = symbol_bytes;
pool.token_decimals = 6;  // Same as USDC for simplicity
pool.k_quadratic = initial_k_quadratic;
pool.supply_cap = supply_cap;
pool.token_supply = 0;
pool.reserve = 0;
pool.usdc_vault = usdc_vault.key();
pool.bump = bump;
```

**Account Creation:**
- Pool PDA created with seeds `[b"pool", post_id]`
- Token mint created with pool PDA as mint authority (no separate mint authority PDA)
- USDC vault created as associated token account
- Pool has authority over vault via PDA signing
- Pool references PoolFactory for dynamic authority validation
- Freeze authority set to None for trustless operation

**Note:** This function is typically called by PoolFactory::create_pool, not directly

---

### 3. Buy Tokens

User purchases pool tokens with USDC. Price determined by bonding curve integral.

**Validation:**
```rust
// Load config (may not exist - use default)
let config = ctx.accounts.config.as_ref();
let min_trade = config.map_or(DEFAULT_MIN_TRADE_AMOUNT, |c| c.min_trade_amount);

require!(usdc_amount >= min_trade, ErrorCode::InvalidAmount);
```

**Token Calculation:**
```rust
let s0 = pool.token_supply;
let usdc_in = usdc_amount as u128;
let s1: u128;

// Determine which region we're in and will end up in
if s0 < pool.supply_cap {
    // Starting in quadratic region

    // Check if we stay in quadratic
    let s_cap_cubed = pool.supply_cap
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let s0_cubed = s0
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let cost_to_cap = pool.k_quadratic
        .checked_mul(s_cap_cubed.checked_sub(s0_cubed)?)?
        .checked_div(3)?;

    if usdc_in <= cost_to_cap {
        // Case A: Staying in quadratic region
        // Solve: (k_quad/3) * (s1³ - s0³) = usdc_in
        let s1_cubed = s0_cubed
            .checked_add(
                usdc_in
                    .checked_mul(3)?
                    .checked_div(pool.k_quadratic)?
            )?;
        s1 = cbrt(s1_cubed)?;
    } else {
        // Case B: Crossing from quadratic to linear
        let remaining = usdc_in.checked_sub(cost_to_cap)?;

        // Derive k_linear = k_quadratic × supply_cap
        let k_linear = get_k_linear(pool)?;

        // Solve linear portion: (k_linear/2) * (s1² - s_cap²) = remaining
        let s_cap_squared = pool.supply_cap
            .checked_pow(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s1_squared = s_cap_squared
            .checked_add(
                remaining
                    .checked_mul(2)?
                    .checked_div(k_linear)?
            )?;
        s1 = sqrt(s1_squared)?;
    }
} else {
    // Case C: Starting and staying in linear region
    // Derive k_linear = k_quadratic × supply_cap
    let k_linear = get_k_linear(pool)?;

    // Solve: (k_linear/2) * (s1² - s0²) = usdc_in
    let s0_squared = s0
        .checked_pow(2)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let s1_squared = s0_squared
        .checked_add(
            usdc_in
                .checked_mul(2)?
                .checked_div(k_linear)?
        )?;
    s1 = sqrt(s1_squared)?;
}

let tokens_out = s1.checked_sub(s0)?;
```

**State Updates:**
```rust
// Transfer USDC from user to pool
token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_usdc_account.to_account_info(),
            to: ctx.accounts.pool_usdc_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    ),
    usdc_amount,
)?;

// Mint new tokens to user (pool PDA is mint authority)
let pool_seeds = &[
    b"pool",
    pool.post_id.as_ref(),
    &[pool.bump],
];
token::mint_to(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: pool.to_account_info(),
        },
        &[pool_seeds],
    ),
    tokens_out as u64,
)?;

// Update pool state
pool.token_supply = s1;
pool.reserve = pool.reserve.checked_add(usdc_in)?;
```

**Return:** Number of tokens minted (tokens_out)

---

### 4. Sell Tokens

User sells pool tokens back to the curve for USDC. Tokens are burned and USDC is returned based on bonding curve integral.

**Validation:**
```rust
require!(token_amount > 0, ErrorCode::InvalidAmount);
require!(token_amount <= pool.token_supply, ErrorCode::InsufficientBalance);

// Verify user has the tokens they're trying to sell
let user_balance = ctx.accounts.user_token_account.amount;
require!(token_amount <= user_balance as u128, ErrorCode::InsufficientBalance);
```

**Payout Calculation:**
```rust
let s0 = pool.token_supply;
let s1 = s0.checked_sub(token_amount)?;
let payout: u128;

// Determine which regions we're crossing
if s1 >= pool.supply_cap {
    // Case A: Staying in linear region
    // Derive k_linear = k_quadratic × supply_cap
    let k_linear = get_k_linear(pool)?;

    // payout = (k_linear/2) * (s0² - s1²)
    let s0_squared = s0
        .checked_pow(2)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let s1_squared = s1
        .checked_pow(2)
        .ok_or(ErrorCode::NumericalOverflow)?;
    payout = k_linear
        .checked_mul(s0_squared.checked_sub(s1_squared)?)?
        .checked_div(2)?;

} else if s0 > pool.supply_cap && s1 < pool.supply_cap {
    // Case B: Crossing from linear back to quadratic
    // Derive k_linear = k_quadratic × supply_cap
    let k_linear = get_k_linear(pool)?;

    // Linear portion: s_cap to s0
    let s0_squared = s0
        .checked_pow(2)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let s_cap_squared = pool.supply_cap
        .checked_pow(2)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let linear_payout = k_linear
        .checked_mul(s0_squared.checked_sub(s_cap_squared)?)?
        .checked_div(2)?;

    // Quadratic portion: s1 to s_cap
    let s_cap_cubed = pool.supply_cap
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let s1_cubed = s1
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let quad_payout = pool.k_quadratic
        .checked_mul(s_cap_cubed.checked_sub(s1_cubed)?)?
        .checked_div(3)?;

    payout = linear_payout.checked_add(quad_payout)?;

} else {
    // Case C: Staying in quadratic region
    // payout = (k_quadratic/3) * (s0³ - s1³)
    let s0_cubed = s0
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;
    let s1_cubed = s1
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;
    payout = pool.k_quadratic
        .checked_mul(s0_cubed.checked_sub(s1_cubed)?)?
        .checked_div(3)?;
}

// Convert to USDC decimals (payout is in u128, need u64)
let usdc_out = u64::try_from(payout)?;
require!(usdc_out <= pool_vault.amount, ErrorCode::InsufficientReserve);
```

**State Updates:**
```rust
// Burn the tokens from user's account
// Note: Users can also burn tokens directly if they own them (standard SPL behavior)
// This burn is user-authorized, not pool-authorized
token::burn(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    ),
    token_amount as u64,
)?;

// Transfer USDC from pool to user (requires PDA signer)
let pool_seeds = &[b"pool", pool.post_id.as_ref(), &[pool.bump]];
let pool_signer = &[&pool_seeds[..]];

token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_usdc_vault.to_account_info(),
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: pool.to_account_info(),
        },
        pool_signer,
    ),
    usdc_out,
)?;

// Update pool state
pool.token_supply = s1;
pool.reserve = pool.reserve.checked_sub(payout)?;
```

**Return:** USDC payout amount (usdc_out)

---

### 5. Apply Pool Penalty

Protocol removes USDC from pool when content relevance declines. Applies elastic-k scaling.

**Validation:**
```rust
// Validate authority via PoolFactory
require!(pool.factory == ctx.accounts.factory.key(), ErrorCode::InvalidFactory);
require!(ctx.accounts.authority.key() == ctx.accounts.factory.pool_authority, ErrorCode::Unauthorized);
require!(penalty_amount > 0, ErrorCode::InvalidAmount);

// Critical: Check reserve can be safely converted to u64
let reserve_u64 = u64::try_from(pool.reserve)
    .map_err(|_| ErrorCode::NumericalOverflow)?;
require!(penalty_amount <= reserve_u64, ErrorCode::InsufficientReserve);

// Prevent draining pool completely (leave dust for rounding)
require!(penalty_amount < reserve_u64, ErrorCode::InsufficientReserve);
```

**Transfer and Elastic-K Scaling:**
```rust
// Step 1: Transfer USDC from pool to treasury
token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_usdc_vault.to_account_info(),
            to: ctx.accounts.treasury_usdc_vault.to_account_info(),
            authority: pool.to_account_info(),
        },
        &[&[b"pool", pool.post_id.as_ref(), &[pool.bump]]],
    ),
    penalty_amount,
)?;

// Step 2: Update reserve
let old_reserve = pool.reserve;
let new_reserve = old_reserve.checked_sub(penalty_amount as u128)?;
pool.reserve = new_reserve;

// Step 3: Apply elastic-k scaling
// Critical: Check old_reserve isn't zero (should never happen if validations pass)
require!(old_reserve > 0, ErrorCode::InvalidAmount);

// ratio = new_reserve / old_reserve (with precision)
let ratio = new_reserve
    .checked_mul(RATIO_PRECISION)?
    .checked_div(old_reserve)?;

// Scale k_quadratic (k_linear derived automatically as k_quadratic × supply_cap)
pool.k_quadratic = pool.k_quadratic
    .checked_mul(ratio)?
    .checked_div(RATIO_PRECISION)?;
```

**Effect:** All token holders lose value proportionally

---

### 6. Apply Pool Reward

Protocol adds USDC to pool when content relevance rises. Applies elastic-k scaling.

**Validation:**
```rust
// Validate authority via PoolFactory
require!(pool.factory == ctx.accounts.factory.key(), ErrorCode::InvalidFactory);
require!(ctx.accounts.authority.key() == ctx.accounts.factory.pool_authority, ErrorCode::Unauthorized);
require!(reward_amount > 0, ErrorCode::InvalidAmount);
```

**Transfer and Elastic-K Scaling:**
```rust
// Step 1: Transfer USDC from treasury to pool
let treasury_seeds = &[b"treasury", &[treasury.bump]];
token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.treasury_usdc_vault.to_account_info(),
            to: ctx.accounts.pool_usdc_vault.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        },
        &[treasury_seeds],
    ),
    reward_amount,
)?;

// Step 2: Update reserve
let old_reserve = pool.reserve;
let new_reserve = old_reserve.checked_add(reward_amount as u128)?;
pool.reserve = new_reserve;

// Step 3: Apply elastic-k scaling
// Critical: Check old_reserve isn't zero (should never happen if validations pass)
require!(old_reserve > 0, ErrorCode::InvalidAmount);

// ratio = new_reserve / old_reserve (with precision)
let ratio = new_reserve
    .checked_mul(RATIO_PRECISION)?
    .checked_div(old_reserve)?;

// Scale k_quadratic (k_linear derived automatically as k_quadratic × supply_cap)
pool.k_quadratic = pool.k_quadratic
    .checked_mul(ratio)?
    .checked_div(RATIO_PRECISION)?;
```

**Effect:** All token holders gain value proportionally

---

### 7. Set Supply Cap

Adjusts the transition point between quadratic and linear curve regions.

**Validation:**
```rust
// Validate authority via PoolFactory
require!(pool.factory == ctx.accounts.factory.key(), ErrorCode::InvalidFactory);
require!(ctx.accounts.authority.key() == ctx.accounts.factory.pool_authority, ErrorCode::Unauthorized);
require!(new_supply_cap >= MIN_SUPPLY_CAP, ErrorCode::InvalidParameters);
```

**State Update:**
```rust
// Simply update supply_cap - k_linear will be derived automatically
// Continuity maintained by relationship: k_linear = k_quadratic × supply_cap
pool.supply_cap = new_supply_cap;
```

**Note:** Can be called even with existing token supply. If tokens > new_cap, they're already in linear region. The k_linear value is always derived on-demand from k_quadratic × supply_cap, so no update needed.

---

## Helper Functions

These critical mathematical functions must be implemented correctly:

### Get k_linear (Derived)
```rust
pub fn get_k_linear(pool: &ContentPool) -> Result<u128> {
    // k_linear = k_quadratic × supply_cap (maintains continuity)
    pool.k_quadratic
        .checked_mul(pool.supply_cap)
        .ok_or(ErrorCode::NumericalOverflow.into())
}
```

### Square Root (Integer)
```rust
pub fn sqrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }

    // Newton's method for integer square root
    // Critical: Use checked operations to prevent overflow
    let mut x = n;
    let mut y = x.checked_add(1)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(2)
        .ok_or(ErrorCode::NumericalOverflow)?;

    while y < x {
        x = y;
        // y = (x + n/x) / 2
        let n_div_x = n.checked_div(x)
            .ok_or(ErrorCode::NumericalOverflow)?;
        y = x.checked_add(n_div_x)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
    }

    Ok(x)
}
```

### Cube Root (Integer)
```rust
pub fn cbrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }

    // Binary search for cube root
    // Critical: Bound hi to prevent overflow in cubing
    let mut lo = 1u128;
    let mut hi = n.min(2_097_151); // cbrt(u128::MAX) ≈ 2^42

    while lo <= hi {
        let mid = lo.checked_add(hi)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;

        let mid_squared = mid
            .checked_mul(mid)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let cubed = mid_squared
            .checked_mul(mid)
            .ok_or(ErrorCode::NumericalOverflow)?;

        match cubed.cmp(&n) {
            std::cmp::Ordering::Equal => return Ok(mid),
            std::cmp::Ordering::Less => {
                lo = mid.checked_add(1)
                    .ok_or(ErrorCode::NumericalOverflow)?;
            },
            std::cmp::Ordering::Greater => {
                // Prevent underflow when mid = 0
                if mid == 0 {
                    return Ok(0);
                }
                hi = mid - 1;
            }
        }
    }

    Ok(hi) // Return floor(cbrt(n))
}
```

---

## Error Codes

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid parameters")]
    InvalidParameters = 6000,

    #[msg("Unauthorized access")]
    Unauthorized = 6001,

    #[msg("Insufficient balance")]
    InsufficientBalance = 6002,

    #[msg("Insufficient pool reserve")]
    InsufficientReserve = 6003,

    #[msg("Invalid amount")]
    InvalidAmount = 6004,

    #[msg("Numerical overflow")]
    NumericalOverflow = 6005,

    #[msg("Transfer failed")]
    TransferFailed = 6006,

    #[msg("Invalid factory reference")]
    InvalidFactory = 6007,
}
```

## Mathematical Invariants

The following properties must ALWAYS hold:

### 1. Reserve-Curve Consistency
```
reserve = ∫[0 to token_supply] P(s) ds
```
The reserve must equal the integral of the price function from 0 to current supply.

### 2. Curve Continuity
```
k_quadratic × supply_cap² = k_linear × supply_cap
```
Price must be continuous at the transition point.

### 3. Proportional Value Changes
```
new_price / old_price = new_reserve / old_reserve = new_k / old_k
```
All token holders gain/lose the same percentage from epoch adjustments.

### 4. Zero-Sum Redistribution
```
Σ(penalties) = Σ(rewards)
```
Total penalties collected must equal total rewards distributed each epoch.

---

## Critical Safety Considerations

### 1. Overflow Protection
- **EVERY mathematical operation uses checked arithmetic**
- `pow(n)` replaced with `checked_pow(n)`
- Intermediate calculations broken down to catch overflows early
- u128 → u64 conversions explicitly checked with `try_from`

### 2. Division by Zero Prevention
- Always check denominators before division
- `old_reserve > 0` check before ratio calculation
- `x > 0` check in sqrt Newton's method

### 3. PDA Signing Security
```rust
// CORRECT: Seeds must match PDA derivation exactly
let seeds = &[b"pool", pool.post_id.as_ref(), &[pool.bump]];
let signer = &[&seeds[..]];

// WRONG: Missing bump or wrong seed order breaks PDA
```

### 4. Authority Validation
- ALWAYS check `ctx.accounts.authority.key() == pool.authority`
- No instruction should modify state without authority check
- User operations (buy/sell) don't need authority

### 5. Reserve Integrity
- Never allow reserve to go negative
- Check `penalty_amount < reserve` (strict inequality for dust)
- Convert reserve to u64 safely before comparisons

### 6. Token Supply Consistency
- Only buy/sell modify token_supply
- Epoch adjustments NEVER change token_supply
- Supply changes must match exact integral calculations

### 7. Rounding Errors
- Integer math means rounding down
- Small dust amounts may accumulate
- Consider minimum trade amounts to prevent griefing

### 8. Reentrancy Protection
- Anchor's account validation prevents reentrancy
- State updates before external calls (CEI pattern)

### 9. Front-Running Mitigation
- Bonding curve prices are deterministic
- No slippage protection needed (price is exact)
- MEV can't manipulate curve parameters (only authority can)

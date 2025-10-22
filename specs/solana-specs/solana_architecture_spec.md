# Solana Smart Contract Architecture - Design Specification

## System Overview

Three-layer architecture integrating Solana smart contracts with centralized scoring:

1. **Veritas Protocol** (Supabase/Node.js) - Runs BD/BTS algorithms, calculates relevance scores
2. **ICBS Smart Contracts** (Solana) - Two-sided bonding curve markets for content speculation
3. **Stake Tracking** (Solana) - Single pooled vault with off-chain balance tracking

**Key Architecture Decision:** Self-contained pools settling against absolute BD scores. No cross-pool redistribution.

## Core Components

### 1. ContentPool (ICBS Market Contract)

**Purpose:** Two-sided prediction market for content relevance using inversely coupled bonding surface.

**Key Innovation:** Reserve ratio `q = R_L / R_tot` encodes market prediction. Settlement scales reserves based on absolute BD score.

**Structure:**
```rust
#[account]
pub struct ContentPool {
    // Identity
    pub content_id: Pubkey,           // Post/belief identifier
    pub creator: Pubkey,
    pub market_deployer: Pubkey,      // First trader who deployed market

    // Mints
    pub long_mint: Pubkey,            // SPL token for LONG side
    pub short_mint: Pubkey,           // SPL token for SHORT side

    // Vaults
    pub vault: Pubkey,                // Main USDC vault
    pub stake_vault: Pubkey,          // Global stake vault (receives skim)

    // Curve parameters
    pub F: u16,                       // Growth exponent (default: 2)
    pub beta_num: u16,                // β numerator (default: 1)
    pub beta_den: u16,                // β denominator (default: 2, β=0.5)

    // State (Q64.64 fixed-point)
    pub s_long: u128,                 // LONG token supply
    pub s_short: u128,                // SHORT token supply
    pub R_long: u128,                 // LONG virtual reserve
    pub R_short: u128,                // SHORT virtual reserve
    pub lambda_long: u128,            // Curve scale parameter
    pub lambda_short: u128,

    // Settlement
    pub last_settle_ts: i64,
    pub min_settle_interval: i64,     // Default: 300 (5 minutes cooldown)

    // Stats
    pub vault_balance: u64,
    pub initial_q: u64,               // Q32.32 - deployer's initial prediction
}
```

**Detailed spec:** [smart-contracts/ICBS-market.md](smart-contracts/ICBS-market.md)

### 2. VeritasStake (Stake Tracking Contract)

**Purpose:** Manage pooled stake vault. All balances tracked off-chain since BTS continuously updates them.

**Structure:**
```rust
// Global stake vault (single account, holds all USDC stakes)
#[account]
pub struct StakeVault {
    pub authority: Pubkey,      // Protocol authority (backend)
    pub total_staked: u64,      // Total USDC in vault (for verification)
    pub bump: u8,
}

// Config
#[account]
pub struct StakeConfig {
    pub authority: Pubkey,
    pub stake_percentage: u16,  // Basis points (1000 = 10%)
    pub bump: u8,
}
```

**Key properties:**
- **Single pooled vault** holds all USDC stakes
- **No per-user PDAs** - unnecessary since balances change with BTS
- **All balances tracked in Supabase** (`user_stakes` table)
- **Backend has vault authority** - can execute withdrawals
- **User must sign** - prevents backend from withdrawing without approval

## User Flows

### Authentication & Wallets
- **Required**: Privy login (social or wallet)
- Every user gets Privy embedded Solana wallet automatically
- One wallet per account (logout/login to switch)

### Stake Management

**Stakes are tracked per pool in database** (pooled on-chain):
- Single global vault holds all USDC stakes
- Each pool tracks user stakes off-chain
- Stakes accumulate from configurable % skim on trades
- Stakes used for BD/BTS participation weights
- Withdrawal requires position closed + backend authorization

### Market Deployment Flow

**Two-phase process:**

1. **Post Creation** (Free)
   ```
   User creates post
   ↓
   Backend stores in Supabase
   ↓
   init_content instruction creates empty ContentPool
   ↓
   Pool exists but no market yet (s_L = s_S = 0)
   ```

2. **Market Deployment** (Requires $100+ deposit, NO stake skim)
   ```
   First trader wants to speculate
   ↓
   deploy_market instruction:
     - Deposit $100 USDC (minimum)
     - Choose allocation: e.g., $60 LONG / $40 SHORT
     - Sets initial q = 0.6
     - NO STAKE SKIM on deployment (full amount for liquidity)
     - Mint tokens at flat rate (10 tokens per $1)
     - Deployer receives: 600 LONG + 400 SHORT tokens
   ↓
   Market is now active for trading
   ```

**Rationale:**
- Free content creation (no barrier to posting)
- Market deployment signals genuine interest
- Deployer sets initial q based on their belief
- $100 minimum provides reasonable initial liquidity
- No stake skim to encourage market creation

### Trading Flow (Backend-Authorized with Stake Calculation)

```
1. User initiates trade via UI
   ↓
2. Frontend calls edge function:
   POST /api/trade/prepare
   { user_wallet, pool_address, side: "LONG", usdc_amount: 100 }
   ↓
3. Backend calculates required stake skim:
   ├─ Get current position from user_positions table
   ├─ Simulate trade to get expected tokens_out
   ├─ Calculate new token holdings after trade
   ├─ Get current prices from pool
   ├─ Calculate new_position_value = new_tokens × price
   ├─ Get current stake balance from user_stakes table
   ├─ Calculate required_stake = new_position_value × stake_percentage
   ├─ Calculate top_up_needed = max(0, required_stake - current_stake)
   └─ Calculate stake_skim = min(top_up_needed, usdc_amount × stake_percentage)
   ↓
4. Backend builds authorized transaction:
   ├─ Create buy_long instruction with:
   │   - usdc_amount: 100
   │   - stake_skim: calculated amount (e.g., 10)
   │   - protocol_authority as signer
   ├─ Set user as feePayer
   ├─ Sign with protocol_authority keypair
   └─ Return serialized tx
   ↓
5. User signs and submits transaction
   ↓
6. ContentPool program (single transaction):
   ├─ Verify protocol_authority signature
   ├─ Verify stake_skim matches backend calculation
   ├─ Transfer usdc_amount from user
   ├─ Split USDC:
   │   - stake_skim → stake_vault (global)
   │   - trade_amount → pool_vault
   ├─ Execute trade with trade_amount
   ├─ Mint tokens to user
   └─ Emit TradeEvent {
         user,
         pool,
         side: LONG,
         usdc_total: 100,
         usdc_to_trade: 90,
         usdc_to_stake: 10,
         tokens_out: Δs_L,
         timestamp
      }
   ↓
7. Backend event indexer (with optimistic locking):
   ├─ Captures TradeEvent
   ├─ INSERT INTO icbs_trades
   ├─ UPSERT user_stakes with version check:
   │  └─ balance += usdc_to_stake WHERE version = expected
   └─ UPSERT user_positions with version check:
      └─ long_tokens += tokens_out WHERE version = expected
```

**Key: Backend signs to authorize stake skim based on off-chain balance tracking.**

### Race Condition Prevention

To prevent issues with concurrent trades:

```typescript
// In prepareTrade - use row locking
const position = await supabase
  .from('user_positions')
  .select('*, version')
  .eq('user_wallet', user_wallet)
  .eq('pool_address', pool_address)
  .single()
  .lock();  // Prevents concurrent reads

// In event indexer - use optimistic locking
await supabase
  .from('user_positions')
  .upsert({
    user_wallet: event.user,
    pool_address: event.pool,
    long_tokens: position.long_tokens + event.tokens_out,
    version: position.version + 1,
  })
  .eq('version', position.version);  // Only updates if version matches

// If version mismatch, retry with fresh data
```

### Backend Edge Function: Prepare Trade

```typescript
// POST /api/trade/prepare
async function prepareTrade(req) {
  const { user_wallet, pool_address, side, usdc_amount } = req.body;

  // 1. Get current position
  const position = await supabase
    .from('user_positions')
    .select('long_tokens, short_tokens')
    .eq('user_wallet', user_wallet)
    .eq('pool_address', pool_address)
    .single();

  // 2. Simulate trade to get expected tokens
  const pool = await program.account.contentPool.fetch(pool_address);
  const tokens_out = simulateTrade(pool, side, usdc_amount);

  // 3. Calculate new position after trade
  const new_long_tokens = (position?.long_tokens || 0) +
    (side === 'LONG' ? tokens_out : 0);
  const new_short_tokens = (position?.short_tokens || 0) +
    (side === 'SHORT' ? tokens_out : 0);

  // 4. Get current prices and calculate new position value
  const longPrice = calculateMarginalPrice(pool, 'LONG');
  const shortPrice = calculateMarginalPrice(pool, 'SHORT');

  const newPositionValue =
    new_long_tokens * longPrice +
    new_short_tokens * shortPrice;

  // 5. Get current stake balance
  const stakeRecord = await supabase
    .from('user_stakes')
    .select('balance')
    .eq('user_wallet', user_wallet)
    .eq('pool_address', pool_address)
    .single();

  const currentStake = stakeRecord?.balance || 0;

  // 6. Calculate required stake after trade
  const requiredStake = newPositionValue * STAKE_PERCENTAGE;

  // 7. Calculate stake skim for this trade
  const topUpNeeded = Math.max(0, requiredStake - currentStake);
  const maxSkimFromTrade = usdc_amount * STAKE_PERCENTAGE;
  const stakeSkimAmount = Math.min(topUpNeeded, maxSkimFromTrade);

  // 8. Build authorized transaction
  const tx = await program.methods
    .buyToken({
      amount_usdc: new BN(usdc_amount),
      stake_skim: new BN(stakeSkimAmount),
      side: side === 'LONG' ? { long: {} } : { short: {} }
    })
    .accounts({
      buyer: new PublicKey(user_wallet),
      contentPool: new PublicKey(pool_address),
      buyerUsdc: await getAssociatedTokenAddress(user_wallet, USDC_MINT),
      vault: pool.vault,
      buyerTokenAccount: await getAssociatedTokenAddress(
        user_wallet,
        side === 'LONG' ? pool.longMint : pool.shortMint
      ),
      mint: side === 'LONG' ? pool.longMint : pool.shortMint,
      stakeVault: STAKE_VAULT_ADDRESS,
      protocolAuthority: PROTOCOL_AUTHORITY_PUBKEY,
      stakeConfig: STAKE_CONFIG_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  // 7. Create transaction with user as fee payer
  const transaction = new Transaction().add(tx);
  transaction.feePayer = new PublicKey(user_wallet);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // 8. Backend signs with protocol authority (from ./solana/veritas-curation/keys/authority.json)
  transaction.partialSign(getProtocolAuthorityKeypair());

  // 9. Serialize and return
  const serializedTx = transaction.serialize({
    requireAllSignatures: false,
  }).toString('base64');

  return {
    success: true,
    transaction: serializedTx,
    stake_skim: stakeSkimAmount,
    trade_amount: usdc_amount - stakeSkimAmount,
  };
}
```

### Sell Flow

```
User calls: sell_long(450 tokens)

ContentPool program:
├─ 1. Solve inverse curve for USDC_out
│    - C(s_L, s_S) - C(s_L - 450, s_S) = USDC_out
├─ 2. Burn 450 LONG tokens from user
├─ 3. Transfer USDC_out from pool_vault to user
├─ 4. Update reserves
└─ 5. Emit TradeEvent {
       user,
       pool,
       side: LONG,
       usdc_total: 0,
       usdc_to_trade: USDC_out,
       usdc_to_stake: 0,  // No skim on sells
       tokens_out: 450,
       trade_type: Sell,
    }

Backend event indexer:
├─ Captures TradeEvent
├─ INSERT INTO icbs_trades
└─ UPSERT INTO user_positions:
    └─ long_tokens -= 450
```

**Note:** No skim on sells. Only buys contribute to stakes.

## Bonding Curve Mechanics: ICBS

### Core Innovation

**Inversely Coupled Bonding Surface (ICBS):** Two sides compete via shared cost function, creating manipulation resistance through inverse coupling.

### Cost Function

```
C(s_L, s_S) = (s_L^(F/β) + s_S^(F/β))^β
```

Where:
- `s_L`, `s_S` = LONG/SHORT token supplies
- `F` = Growth exponent (default: 2)
- `β` = Coupling coefficient (default: 0.5)

**Properties:**
- **1-homogeneous:** C(λs_L, λs_S) = λ × C(s_L, s_S)
- **Inverse coupling:** Buying LONG increases LONG price AND decreases SHORT price
- **Manipulation resistant:** Can't pump one side without making the other cheaper

### Virtual Reserves

Due to homogeneity, virtual reserves equal simple products (no integrals needed):

```rust
R_L = s_L × p_L  // Closed-form, exact
R_S = s_S × p_S

// Invariant (Euler's theorem)
R_L + R_S = R_tot (vault balance)
```

### Reserve Ratio as Market Prediction

```
q = R_L / R_tot = R_L / (R_L + R_S)
```

**Interpretation:** Market's predicted relevance score.
- q = 0.8 → Market thinks 80% relevance
- q = 0.2 → Market thinks 20% relevance

**Why this works:**
- Rational trader buys LONG until expected value = 0
- Expected value of marginal LONG = p_L × (E[x]/q - 1)
- This is zero when q = E[x]
- Nash equilibrium: q* = E[x]

### Marginal Prices

```
p_L = λ_L × F × s_L^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)
p_S = λ_S × F × s_S^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)
```

**With defaults (F=2, β=0.5):**
```
p_L = λ_L × 2 × s_L^3 × (s_L^4 + s_S^4)^(-0.5)
```

**Key observation:**
- As s_L ↑: p_L ↑ (normal bonding curve behavior)
- As s_S ↑: p_L ↓ (inverse coupling!)

### Example Trade

```
Initial state:
- s_L = 1000, s_S = 500
- R_L = $600, R_S = $300
- q = 0.67 (67% LONG)
- p_L = $0.60/token

User buys $90 LONG (after 10% skim):
- Solve: C(s_L + Δs, 500) - C(1000, 500) = $90
- Newton-Raphson: Δs ≈ 145 tokens
- Mint 145 LONG tokens to user
- Update: s_L = 1145, R_L = $690
- New p_L = $0.64/token (price increased)
- New q = 0.69 (market more bullish)
```

## Settlement Mechanics

### On-Demand Settlement (User-Triggered)

**Anyone can trigger settlement for any pool at any time. User pays gas.**

**Flow:**

```
1. User clicks "Settle Pool" in UI
   ↓
2. Frontend calls edge function:
   POST /api/pool/request-settlement
   { user_wallet, pool_address }
   ↓
3. Backend runs BD for this specific pool:
   ├─ Get all beliefs for this pool's content
   ├─ Get user stakes (for BD weights)
   ├─ Run Belief Decomposition algorithm
   │  └─ Typical: 0.5-2s (5-50 beliefs)
   │  └─ Popular: 2-5s (100-500 beliefs)
   │  └─ Viral: 5-15s (1000-5000 beliefs)
   ├─ Calculate absolute relevance score x ∈ [0, 1]
   └─ Store in DB for historical record
   ↓
4. Backend builds settlement transaction:
   ├─ Create settle_epoch instruction with x_score
   ├─ Sign with protocol_authority (proves BD was run)
   ├─ Set user as feePayer (user pays gas!)
   └─ Return serialized tx
   ↓
5. User signs and submits
   ↓
6. On-chain settlement executes
   ↓
7. Backend indexes SettlementEvent
   ↓
8. [Async, separate process] Backend runs BTS for stake redistribution
   └─ This determines who gains/loses from their 10% stake
   └─ Not blocking for settlement
```

**Smart Contract: settle_epoch**

```rust
pub fn settle_epoch(ctx: Context<SettleEpoch>, x_score: u32) -> Result<()> {
    let pool = &mut ctx.accounts.content_pool;
    let clock = Clock::get()?;

    // Check settlement cooldown
    require!(
        clock.unix_timestamp >= pool.last_settle_ts + pool.min_settle_interval,
        ErrorCode::SettlementCooldown
    );

    // Anyone can call, but protocol_authority must sign (verifies BD was run)
    require!(
        ctx.accounts.protocol_authority.key() == ctx.accounts.protocol_config.authority,
        ErrorCode::UnauthorizedProtocolAuthority
    );

    // 1. Calculate market prediction
    let q = pool.R_long * Q64_ONE / (pool.R_long + pool.R_short);

    // 2. Convert BD score to Q64.64
    let x = (x_score as u128) << 32; // Q32.32 -> Q64.64

    // 3. Calculate settlement factors (ratio-based proper scoring)
    // Clamp q to [1%, 99%] to avoid division issues
    let q_safe = q.clamp(Q64_ONE / 100, Q64_ONE * 99 / 100);

    let f_long = x * Q64_ONE / q_safe;               // f_L = x/q
    let f_short = (Q64_ONE - x) * Q64_ONE / (Q64_ONE - q_safe); // f_S = (1-x)/(1-q)

    // 4. Scale reserves (supplies unchanged!)
    pool.R_long = pool.R_long * f_long / Q64_ONE;
    pool.R_short = pool.R_short * f_short / Q64_ONE;

    // 5. Emit event
    emit!(SettlementEvent {
        pool: pool.key(),
        settler: ctx.accounts.settler.key(),  // Who triggered this
        bd_score: x_score,
        market_prediction_q: q,
        f_long,
        f_short,
        timestamp: Clock::get()?.unix_timestamp,
    });

    pool.last_settle_ts = Clock::get()?.unix_timestamp;

    Ok(())
}
```

### Backend Edge Function: Request Settlement

```typescript
// POST /api/pool/request-settlement
async function requestSettlement(req) {
  const { user_wallet, pool_address } = req.body;

  // 1. Get pool and associated belief
  const poolDeployment = await supabase
    .from('pool_deployments')
    .select('belief_id, post_id')
    .eq('pool_address', pool_address)
    .single();

  if (!poolDeployment) {
    return { error: 'Pool not found' };
  }

  // 2. Get all beliefs for this content (for BD calculation)
  const beliefs = await supabase
    .from('beliefs')
    .select('*')
    .eq('post_id', poolDeployment.post_id);

  // 3. Get user stakes for weighting
  const stakes = await supabase
    .from('user_stakes')
    .select('user_wallet, balance')
    .eq('pool_address', pool_address);

  // 4. Run Belief Decomposition (this takes ~5-30 seconds)
  const bdScore = await runBeliefDecomposition(beliefs, stakes);
  // Returns: relevance score x ∈ [0, 1]

  // 5. Store BD result for historical record
  await supabase
    .from('bd_scores')
    .insert({
      belief_id: poolDeployment.belief_id,
      pool_address,
      score: bdScore,
      triggered_by: user_wallet,
      timestamp: new Date(),
    });

  // 6. Convert to Q32.32 for on-chain
  const x_score_q32 = Math.floor(bdScore * (2 ** 32));

  // 7. Build settlement transaction
  const tx = await program.methods
    .settleEpoch(x_score_q32)
    .accounts({
      settler: new PublicKey(user_wallet),  // User pays gas
      contentPool: new PublicKey(pool_address),
      protocolAuthority: PROTOCOL_AUTHORITY_PUBKEY,
      protocolConfig: PROTOCOL_CONFIG_ADDRESS,
    })
    .instruction();

  // 8. Create transaction with user as fee payer
  const transaction = new Transaction().add(tx);
  transaction.feePayer = new PublicKey(user_wallet);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // 9. Backend signs with protocol authority (proves BD was run)
  // Uses keypair from ./solana/veritas-curation/keys/authority.json
  transaction.partialSign(getProtocolAuthorityKeypair());

  // 10. Serialize and return
  const serializedTx = transaction.serialize({
    requireAllSignatures: false,
  }).toString('base64');

  return {
    success: true,
    transaction: serializedTx,
    bd_score: bdScore,
    processing_time_ms: Date.now() - startTime,
  };
}
```

**Note:** User waits for BD calculation before signing. Show loading state:
- Typical: 0.5-2 seconds
- Popular content: 2-5 seconds
- Viral content: 5-15 seconds

**BTS runs separately:** After settlement, BTS processes stake rewards/penalties async (not blocking).

### Settlement Example

```
Before settlement:
- Market: q = 0.4 (40% predicted relevance)
- LONG holders: 100 tokens @ $4/token = $400 value
- SHORT holders: 200 tokens @ $3/token = $600 value
- Total: $1000

BD scores: x = 0.6 (60% actual relevance)

Settlement factors:
- f_L = 0.6/0.4 = 1.5 (50% gain for LONG)
- f_S = 0.4/0.6 = 0.67 (33% loss for SHORT)

After settlement:
- R_L' = $400 × 1.5 = $600
- R_S' = $600 × 0.67 = $400
- LONG holders: 100 tokens @ $6/token = $600 value (+50%)
- SHORT holders: 200 tokens @ $2/token = $400 value (-33%)
- Total still $1000 (zero-sum)

New market ratio:
- q' = $600/$1000 = 0.6 (matches BD score x!)
```

**Key properties:**
- Token counts never change (no minting/burning)
- Value per token scales by settlement factor
- Reserve ratio moves to match BD score
- Zero-sum: gains = losses

### Ratio-Based Proper Scoring Rule

The settlement mechanism implements a **ratio-based strictly proper scoring rule**:

**Trader profit for marginal LONG trade:**
```
profit = p_L × (x/q - 1)
```

**Expected profit:**
```
E[profit] = p_L × (E[x]/q - 1)
```

**Proper rule:** Maximum expected profit when `q = E[x]`

**Comparison to alternatives:**
- **Logarithmic (LMSR):** Pays `ln(x/q)`, maximizes KL divergence
- **Brier (quadratic):** Pays `-(x-q)²`, minimizes MSE
- **Ratio-based (ours):** Pays linear `x/q`, maximizes fractional gain

**Why ratio-based:**
- Simple on-chain (just multiplication/division)
- Still strictly proper (incentivizes truthful prediction)
- No logs or exponentiation needed
- Gas efficient

## Stake Management & Withdrawal

### Withdrawal Flow (Backend Authorizes, User Pays Gas)

```
1. User requests withdrawal via UI
   ↓
2. Frontend calls edge function:
   POST /api/stake/request-withdrawal
   { user_wallet, pool_address, amount }
   ↓
3. Backend (Supabase Edge Function):
   ├─ Get user's current position value
   ├─ Get off-chain stake balance (with BTS adjustments)
   ├─ Calculate: available = off_chain_balance - (position × x%)
   ├─ Validate: amount <= available
   ├─ If invalid: return error
   └─ If valid: build transaction ↓
   ↓
4. Backend builds transaction:
   ├─ Create withdraw_stake instruction
   ├─ Set user as feePayer (user pays gas!)
   ├─ Add recent blockhash
   ├─ Sign with protocol_authority keypair
   ├─ Serialize (requireAllSignatures: false)
   └─ Return serialized tx to frontend
   ↓
5. Frontend receives authorized tx:
   ├─ Deserialize transaction
   ├─ Present to user for approval
   ├─ User signs (approves gas payment)
   └─ Submit to Solana
   ↓
6. Smart contract (withdraw_stake):
   ├─ Verify dual signatures:
   │   - protocol_authority (backend authorization)
   │   - user (pays gas, confirms)
   ├─ Transfer USDC from vault to user
   └─ Emit WithdrawalEvent
   ↓
7. Backend event indexer:
   ├─ Capture WithdrawalEvent
   ├─ Update user_stakes.off_chain_balance
   └─ Log transaction
```

**Key insight:** Backend has authority over stake vault (knows true balances), but user pays gas and must confirm withdrawal.

### Backend Edge Function: Request Withdrawal

```typescript
// POST /api/stake/request-withdrawal
async function requestWithdrawal(req) {
  const { user_wallet, amount } = req.body;

  // 1. Get ALL user positions across ALL pools
  const allPositions = await supabase
    .from('user_positions')
    .select('*')
    .eq('user_wallet', user_wallet);

  // 2. Calculate total position value across all pools
  let totalPositionValue = 0;
  for (const pos of allPositions) {
    const pool = await program.account.contentPool.fetch(pos.pool_address);
    const longPrice = calculatePrice(pool, 'LONG');
    const shortPrice = calculatePrice(pool, 'SHORT');
    totalPositionValue +=
      pos.long_tokens * longPrice +
      pos.short_tokens * shortPrice;
  }

  // 3. Get total stake balance across all pools (with BTS adjustments)
  const { data: stakes, error } = await supabase
    .from('user_stakes')
    .select('balance')
    .eq('user_wallet', user_wallet);

  if (!stakes || stakes.length === 0) {
    return { error: 'No stake found' };
  }

  const totalStake = stakes.reduce((sum, s) => sum + s.balance, 0);

  // 4. Calculate available withdrawal
  const requiredStake = totalPositionValue * STAKE_PERCENTAGE;
  const available = Math.max(0, totalStake - requiredStake);

  if (amount > available) {
    return {
      error: `Only ${available} available (need ${requiredStake} for position)`,
      available,
      position_value: totalPositionValue,
      required_stake: requiredStake
    };
  }

  // 4. Build authorized transaction
  const userUsdcAccount = await getAssociatedTokenAddress(
    new PublicKey(user_wallet),
    USDC_MINT
  );

  const tx = await program.methods
    .withdrawStake(new BN(amount))
    .accounts({
      user: new PublicKey(user_wallet),
      stakeVault: STAKE_VAULT_ADDRESS,
      stakeVaultTokenAccount: STAKE_VAULT_TOKEN_ACCOUNT,
      userUsdcAccount,
      protocolAuthority: PROTOCOL_AUTHORITY_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  // 5. Create transaction with user as fee payer
  const transaction = new Transaction().add(tx);
  transaction.feePayer = new PublicKey(user_wallet); // User pays gas!
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // 6. Backend signs as protocol authority
  // Uses keypair from ./solana/veritas-curation/keys/authority.json
  transaction.partialSign(getProtocolAuthorityKeypair());

  // 7. Serialize and return
  const serializedTx = transaction.serialize({
    requireAllSignatures: false, // User hasn't signed yet
  }).toString('base64');

  return {
    success: true,
    transaction: serializedTx,
    amount,
    available
  };
}
```

**Key insight:** Backend builds and signs transaction, but user pays gas and must approve.

## Data Structures

### Database Schema (Supabase)

```sql
-- Posts table (existing)
CREATE TABLE posts (
    id UUID PRIMARY KEY,
    content TEXT,
    author_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beliefs table (existing, add BTS score)
CREATE TABLE beliefs (
    id UUID PRIMARY KEY,
    agent_id UUID REFERENCES agents(id),
    post_id UUID REFERENCES posts(id),
    belief_text TEXT,
    epoch INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: BTS scores per epoch
CREATE TABLE bts_scores (
    id UUID PRIMARY KEY,
    belief_id UUID REFERENCES beliefs(id),
    epoch INTEGER NOT NULL,
    score DECIMAL NOT NULL,  -- Absolute relevance [0, 1]
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(belief_id, epoch)
);

-- NEW: Pool deployments (maps posts to on-chain pools)
CREATE TABLE pool_deployments (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES posts(id),
    pool_address TEXT UNIQUE NOT NULL,
    belief_id UUID REFERENCES beliefs(id),
    deployer_wallet TEXT NOT NULL,
    initial_deposit DECIMAL NOT NULL,
    initial_q DECIMAL NOT NULL,  -- [0, 1]
    deployed_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: ICBS trades (all buys/sells)
CREATE TABLE icbs_trades (
    id UUID PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    belief_id UUID REFERENCES beliefs(id),
    side TEXT NOT NULL,  -- 'LONG' or 'SHORT'
    trade_type TEXT NOT NULL,  -- 'BUY' or 'SELL'
    usdc_amount DECIMAL NOT NULL,
    tokens_amount DECIMAL NOT NULL,
    skim_amount DECIMAL,  -- Only for buys
    tx_signature TEXT UNIQUE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: User stakes (fully off-chain, balances change with BTS)
CREATE TABLE user_stakes (
    id UUID PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    pool_address TEXT NOT NULL,  -- ContentPool address
    balance DECIMAL NOT NULL,     -- Current stake balance (changes with BTS)
    last_bts_epoch INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_wallet, pool_address)
);

-- NEW: Track user positions (for withdrawal eligibility)
CREATE TABLE user_positions (
    id UUID PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    long_tokens DECIMAL DEFAULT 0,
    short_tokens DECIMAL DEFAULT 0,
    version INTEGER DEFAULT 1,  -- For optimistic locking
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_wallet, pool_address)
);

-- NEW: BD scores for settlement history
CREATE TABLE bd_scores (
    id UUID PRIMARY KEY,
    belief_id UUID REFERENCES beliefs(id),
    pool_address TEXT NOT NULL,
    score DECIMAL NOT NULL,  -- BD score [0, 1]
    triggered_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: User penalties (from BTS)
CREATE TABLE user_penalties (
    id UUID PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    belief_id UUID REFERENCES beliefs(id),
    amount DECIMAL NOT NULL,
    reason TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Stake withdrawals
CREATE TABLE stake_withdrawals (
    id UUID PRIMARY KEY,
    user_wallet TEXT NOT NULL,
    belief_id UUID REFERENCES beliefs(id),
    amount DECIMAL NOT NULL,
    tx_signature TEXT UNIQUE,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

## Event Indexing Architecture

### Environment-Based Implementation

Event indexing strategy depends on `SOLANA_NETWORK` environment variable:

**Local/Devnet (Current Implementation):**
- WebSocket subscription via `connection.onLogs()`
- Real-time event parsing from transaction logs
- Direct database updates

**Mainnet (Future - Not Yet Implemented):**
- Helius webhooks for reliable event delivery
- Enhanced Digital Asset API for historical data
- Automatic retries and gap detection

### Local Event Indexer Setup

**Configuration (.env.local):**
```env
SOLANA_NETWORK=localnet  # or devnet or mainnet-beta
SOLANA_RPC_URL=http://127.0.0.1:8899
PROGRAM_ID=<your_program_id>

# Protocol authority (signs trades, settlements, withdrawals)
PROTOCOL_AUTHORITY_PATH=./solana/veritas-curation/keys/authority.json  # localnet/devnet
# PROTOCOL_AUTHORITY_PATH=  # Leave blank for mainnet (not yet supported)
```

**Authority Key:**
- **Localnet/Devnet:** Pre-generated keypair at `solana/veritas-curation/keys/authority.json`
- **Mainnet:** Should use secure key management (KMS, hardware wallet, multisig)
  - Not yet implemented - will throw error if mainnet is attempted

### Trade Event Flow (Local/Devnet)

```
On-Chain (Solana)
├─ buy_long() executed
├─ TradeEvent emitted
│  └─ { user, pool, side, usdc_total, usdc_to_trade, usdc_to_stake, tokens_out }
└─ Transaction confirmed

Local Event Indexer (WebSocket)
├─ connection.onLogs() receives event
├─ Parse Anchor events from logs
├─ Process TradeEvent:
│  ├─ INSERT INTO icbs_trades
│  ├─ UPSERT INTO user_stakes (with version check)
│  └─ UPSERT INTO user_positions (with version check)
└─ Update real-time UI subscriptions
```

### Settlement Event Flow (Local/Devnet)

```
User triggers settlement
├─ Backend runs BD scoring
├─ Backend builds + signs tx
└─ User signs and submits

On-Chain (Solana)
├─ settle_epoch() executed
├─ Reserves scaled by f_L, f_S
└─ SettlementEvent emitted
   └─ { pool, settler, bd_score, q, f_long, f_short }

Local Event Indexer (WebSocket)
├─ connection.onLogs() receives event
├─ Parse SettlementEvent
└─ INSERT INTO bd_scores + settlements table
```

### Local Event Indexer Implementation

**Service: `src/services/event-indexer.service.ts`**

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, BorshCoder, EventParser } from '@coral-xyz/anchor';
import { supabase } from '@/lib/supabase';

export class EventIndexerService {
  private connection: Connection;
  private program: Program;
  private eventParser: EventParser;
  private subscriptionId: number | null = null;

  constructor(connection: Connection, program: Program) {
    this.connection = connection;
    this.program = program;
    this.eventParser = new EventParser(
      program.programId,
      new BorshCoder(program.idl)
    );
  }

  async start() {
    const network = process.env.SOLANA_NETWORK;

    if (network === 'mainnet-beta') {
      throw new Error(
        'Mainnet event indexing not yet implemented. ' +
        'Please use Helius webhooks or implement mainnet indexer.'
      );
    }

    if (network !== 'localnet' && network !== 'devnet') {
      throw new Error(`Invalid SOLANA_NETWORK: ${network}`);
    }

    console.log(`Starting event indexer for ${network}...`);

    // Subscribe to program logs
    this.subscriptionId = this.connection.onLogs(
      this.program.programId,
      async (logs, ctx) => {
        try {
          await this.processLogs(logs.logs, logs.signature);
        } catch (error) {
          console.error('Error processing logs:', error);
        }
      },
      'confirmed'
    );

    console.log('Event indexer started. Listening for events...');
  }

  async stop() {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
      console.log('Event indexer stopped.');
    }
  }

  private async processLogs(logs: string[], signature: string) {
    const events = this.parseEvents(logs);

    for (const event of events) {
      switch (event.name) {
        case 'TradeEvent':
          await this.handleTradeEvent(event.data, signature);
          break;
        case 'SettlementEvent':
          await this.handleSettlementEvent(event.data, signature);
          break;
        case 'WithdrawalEvent':
          await this.handleWithdrawalEvent(event.data, signature);
          break;
      }
    }
  }

  private parseEvents(logs: string[]) {
    const events = [];

    for (const log of logs) {
      if (log.startsWith('Program data: ')) {
        try {
          const event = this.eventParser.parseLogs([log]);
          if (event && event.length > 0) {
            events.push(event[0]);
          }
        } catch (err) {
          // Not all logs are events
          continue;
        }
      }
    }

    return events;
  }

  private async handleTradeEvent(event: TradeEvent, signature: string) {
    console.log('Trade event:', event);

    // Insert trade record
    await supabase.from('icbs_trades').insert({
      user_wallet: event.trader.toString(),
      pool_address: event.pool.toString(),
      side: event.side.long ? 'LONG' : 'SHORT',
      trade_type: 'BUY',
      usdc_amount: event.usdcTotal,
      tokens_amount: event.tokensOut,
      skim_amount: event.usdcToStake,
      tx_signature: signature,
    });

    // Update user position with optimistic locking
    const { data: existing } = await supabase
      .from('user_positions')
      .select('*')
      .eq('user_wallet', event.trader.toString())
      .eq('pool_address', event.pool.toString())
      .single();

    const side = event.side.long ? 'long_tokens' : 'short_tokens';
    const newTokens = (existing?.[side] || 0) + Number(event.tokensOut);

    await supabase
      .from('user_positions')
      .upsert({
        user_wallet: event.trader.toString(),
        pool_address: event.pool.toString(),
        [side]: newTokens,
        version: (existing?.version || 0) + 1,
      });

    // Update stake balance
    await supabase
      .from('user_stakes')
      .upsert({
        user_wallet: event.trader.toString(),
        pool_address: event.pool.toString(),
        balance: supabase.raw(`COALESCE(balance, 0) + ${event.usdcToStake}`),
      });
  }

  private async handleSettlementEvent(event: SettlementEvent, signature: string) {
    console.log('Settlement event:', event);

    // Store BD score
    await supabase.from('bd_scores').insert({
      pool_address: event.pool.toString(),
      score: Number(event.bdScore) / (2 ** 32),  // Convert from Q32.32
      triggered_by: event.settler.toString(),
    });

    // Store settlement record
    await supabase.from('settlements').insert({
      pool_address: event.pool.toString(),
      bd_relevance_score: Number(event.bdScore) / (2 ** 32),
      market_prediction_q: Number(event.marketPredictionQ) / (2 ** 64),
      f_long: Number(event.fLong) / (2 ** 64),
      f_short: Number(event.fShort) / (2 ** 64),
      tx_signature: signature,
    });
  }

  private async handleWithdrawalEvent(event: WithdrawalEvent, signature: string) {
    console.log('Withdrawal event:', event);

    // Update stake balance
    const { data: existing } = await supabase
      .from('user_stakes')
      .select('balance')
      .eq('user_wallet', event.user.toString())
      .single();

    await supabase
      .from('user_stakes')
      .update({
        balance: existing.balance - Number(event.amount),
      })
      .eq('user_wallet', event.user.toString());

    // Record withdrawal
    await supabase.from('stake_withdrawals').insert({
      user_wallet: event.user.toString(),
      amount: event.amount,
      tx_signature: signature,
      completed_at: new Date(),
    });
  }
}

// Type definitions
interface TradeEvent {
  pool: PublicKey;
  trader: PublicKey;
  side: { long?: {} } | { short?: {} };
  usdcTotal: number;
  usdcToTrade: number;
  usdcToStake: number;
  tokensOut: number;
}

interface SettlementEvent {
  pool: PublicKey;
  settler: PublicKey;
  bdScore: number;
  marketPredictionQ: number;
  fLong: number;
  fShort: number;
}

interface WithdrawalEvent {
  user: PublicKey;
  amount: number;
}
```

**Utility: `src/lib/protocol-authority.ts`**

```typescript
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

let cachedAuthority: Keypair | null = null;

export function getProtocolAuthorityKeypair(): Keypair {
  if (cachedAuthority) {
    return cachedAuthority;
  }

  const network = process.env.SOLANA_NETWORK;

  if (network === 'mainnet-beta') {
    throw new Error(
      '❌ Mainnet protocol authority not configured.\n' +
      'TODO: Implement secure key management (KMS/hardware wallet/multisig).\n' +
      'Do NOT use a simple keypair file for mainnet!'
    );
  }

  const authorityPath = process.env.PROTOCOL_AUTHORITY_PATH ||
    './solana/veritas-curation/keys/authority.json';

  if (!fs.existsSync(authorityPath)) {
    throw new Error(
      `Protocol authority keypair not found at: ${authorityPath}\n` +
      'Run: solana-keygen new -o ${authorityPath}'
    );
  }

  const keypairData = JSON.parse(fs.readFileSync(authorityPath, 'utf-8'));
  cachedAuthority = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log(`Loaded protocol authority: ${cachedAuthority.publicKey.toString()}`);

  return cachedAuthority;
}
```

**Initialization: `src/lib/event-indexer.ts`**

```typescript
import { Connection } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { EventIndexerService } from '@/services/event-indexer.service';
import { getProtocolAuthorityKeypair } from './protocol-authority';
import idl from '@/idl/veritas_curation.json';

let indexer: EventIndexerService | null = null;

export async function startEventIndexer() {
  if (indexer) {
    console.warn('Event indexer already running');
    return indexer;
  }

  const network = process.env.SOLANA_NETWORK;

  if (network === 'mainnet-beta') {
    throw new Error(
      '❌ Mainnet event indexing not implemented.\n' +
      'TODO: Implement Helius webhook integration for production.\n' +
      'See: https://docs.helius.dev/webhooks-and-websockets/webhooks'
    );
  }

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899',
    'confirmed'
  );

  // Use protocol authority as wallet for provider (read-only for indexing)
  const authority = getProtocolAuthorityKeypair();
  const wallet = new Wallet(authority);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  const program = new Program(idl, provider);

  indexer = new EventIndexerService(connection, program);
  await indexer.start();

  return indexer;
}

export async function stopEventIndexer() {
  if (indexer) {
    await indexer.stop();
    indexer = null;
  }
}

// Start on app initialization (for local/devnet only)
if (process.env.NODE_ENV !== 'production' ||
    process.env.SOLANA_NETWORK !== 'mainnet-beta') {
  startEventIndexer().catch(console.error);
}
```

### Protocol Authority Management

**Current (Local/Devnet):**
- Keypair stored at: `solana/veritas-curation/keys/authority.json`
- Loaded via `getProtocolAuthorityKeypair()` utility
- Used to sign: trades, settlements, withdrawals
- **Security:** File-based storage acceptable for testing

**Future (Mainnet):**
- **DO NOT use file-based keypair**
- Required: Secure key management solution
- Options:
  - AWS KMS / Google Cloud KMS
  - Hardware wallet (Ledger)
  - Multisig (Squads Protocol)
- Update `getProtocolAuthorityKeypair()` to integrate with chosen solution

### Migration to Mainnet (Future)

When moving to mainnet, replace local event indexer with Helius:

**Required changes:**
1. **Set up Helius webhook:**
   ```typescript
   // POST to Helius API
   const webhook = await helius.createWebhook({
     accountAddresses: [PROGRAM_ID],
     transactionTypes: ['PROGRAM_INSTRUCTION'],
     webhookURL: 'https://your-domain.com/api/webhooks/helius',
   });
   ```

2. **Create webhook handler:**
   ```typescript
   // app/api/webhooks/helius/route.ts
   export async function POST(req: Request) {
     const events = await req.json();

     for (const event of events) {
       // Parse and process events same as local indexer
       await processEvent(event);
     }

     return Response.json({ success: true });
   }
   ```

3. **Update environment check:**
   ```typescript
   if (network === 'mainnet-beta') {
     console.log('Using Helius webhooks for event indexing');
     // Verify webhook is configured
     await verifyHeliusWebhook();
   }
   ```

### Withdrawal Event Flow

```
Frontend
├─ User requests withdrawal
├─ Check on-chain stake
├─ Call backend eligibility API
└─ If eligible:
    └─ Call withdraw_stake()

On-Chain (Solana)
├─ withdraw_stake() executed
├─ USDC transferred to user
└─ WithdrawalEvent emitted
   └─ { user, belief_id, amount }

Backend Event Indexer
└─ Index WithdrawalEvent
   └─ INSERT INTO stake_withdrawals
```

## Key Design Decisions

### Self-Contained Pools (No Cross-Pool Redistribution)

**Old Design (Archived):**
- Pools competed for share of protocol value
- Used delta relative relevance
- Required ProtocolTreasury to shuttle USDC
- Complex penalty/reward calculations

**Current Design:**
- Each pool settles independently
- Uses absolute BTS score `x ∈ [0, 1]`
- No cross-pool dependencies
- Settlement factors: `f_L = x/q`, `f_S = (1-x)/(1-q)`

**Why the change:**
- Simpler implementation
- No coordination needed
- Scales better (O(1) per pool)
- Cleaner game theory

### Non-Custodial Stakes (Per-User-Per-Belief PDAs)

**Old Design (Archived):**
- Pooled custody (all stakes in one vault)
- Balances tracked in Supabase
- Protocol-controlled everything

**Current Design:**
- One PDA per (user, belief_id)
- User owns PDA
- Smart contract enforces rules
- Backend checks eligibility

**Why the change:**
- Truly non-custodial
- Transparent on-chain
- No custody risk
- Users trust smart contract, not protocol

### Market Deployment (Not Automatic)

**Design:**
- Posts created free (anyone can post)
- Markets deployed by first trader ($100+ deposit)
- Deployer sets initial q

**Why:**
- Solves cold-start problem (deployer provides liquidity)
- Natural quality filter (only tradeable content gets markets)
- No protocol capital needed
- Incentivizes discovery (deployer profits if correct)

## Mathematical Properties

### Invariants

1. **Reserve conservation:**
   ```
   R_L + R_S = vault_balance (always)
   ```

2. **Homogeneity:**
   ```
   R_L = s_L × p_L (exact, due to 1-homogeneity)
   ```

3. **Zero-sum settlement:**
   ```
   R_L' + R_S' = R_L + R_S (total unchanged)
   ```

4. **Settlement convergence:**
   ```
   q' = R_L' / (R_L' + R_S') = x (after settlement)
   ```

### Security Properties

**Non-custodial:**
- Users own stake PDAs
- Smart contract enforces rules
- Protocol cannot arbitrarily take funds

**Manipulation resistant:**
- Inverse coupling penalizes one-sided pumping
- Settlement based on external BTS oracle
- Proper scoring rule incentivizes truth-telling

**Sybil resistant (via stakes):**
- Trading requires real USDC
- Stakes accumulate from trades (skin in the game)
- BTS weighs by stakes (no free votes)

## Implementation Status

### Completed ✅
- [x] ICBS specification documents
- [x] Architecture design
- [x] Database schema design
- [x] Event flow design

### In Progress 🚧
- [ ] ICBS ContentPool smart contract
- [ ] VeritasStake contract
- [ ] Event indexer service
- [ ] Settlement bot (triggers settle_epoch)
- [ ] Withdrawal eligibility API

### Upcoming 📋
- [ ] Frontend integration (trade UI)
- [ ] Stake display UI
- [ ] Withdrawal flow UI
- [ ] Real-time event subscriptions
- [ ] Analytics dashboard

## References

**Specifications:**
- [ICBS Market Spec](smart-contracts/ICBS-market.md) - Detailed implementation
- [ICBS Anchor Spec](smart-contracts/ICBS-anchor-spec.md) - Anchor guide
- [ICBS Explained](smart-contracts/ICBS-EXPLAINED.md) - Conceptual overview
- [System Architecture](ICBS-SYSTEM-ARCHITECTURE.md) - Complete integration

**Academic:**
- Hanson, R. (2007). "Logarithmic Market Scoring Rules"
- Abernethy, J. & Frongillo, R. (2011). "A Characterization of Scoring Rules"

**Archived (Historical):**
- See [archive/](archive/) for previous designs (delta relevance, pooled custody, elastic-k)
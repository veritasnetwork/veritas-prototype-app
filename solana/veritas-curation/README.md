# Veritas Curation - Solana Program

ICBS (Inversely Coupled Bonding Surface) implementation for two-sided prediction markets on content relevance, with epoch-based settlement tied to Belief Decomposition scores.

## Architecture Overview

Veritas uses a three-layer architecture:
- **ContentPool** (ICBS markets) - Two-sided prediction markets with LONG/SHORT tokens
- **PoolFactory** - Standardized pool deployment and configuration
- **VeritasCustodian** - User USDC custody for trading

Each post gets its own ContentPool where users trade:
- **LONG tokens** = bullish on content relevance
- **SHORT tokens** = bearish on content relevance

Markets settle independently each epoch based on Belief Decomposition (BD) scores from the Veritas Protocol.

## Building

```bash
anchor build
```

This automatically:
- Builds the Solana program
- Generates TypeScript types in `target/types/`
- Creates IDL in `target/idl/`

## Rust Toolchain

This project uses **Rust nightly** (configured via `rust-toolchain.toml`).

The nightly toolchain is required for Anchor's IDL generation which depends on unstable features in `solana-zk-sdk`.

## Testing

Run all tests:
```bash
anchor test
```

Run specific test file:
```bash
./test-isolated.sh tests/content-pool-icbs.test.ts
```

## Project Structure

```
programs/veritas-curation/src/
├── lib.rs                              # Main program entry
├── constants.rs                        # Shared constants
├── errors.rs                           # Error definitions
├── utils.rs                            # Helper functions
├── content_pool/
│   ├── mod.rs                          # Module exports
│   ├── state.rs                        # ContentPool account structure
│   ├── curve.rs                        # ICBS pricing mathematics
│   ├── math.rs                         # Fixed-point math helpers
│   ├── errors.rs                       # Pool-specific errors
│   ├── events.rs                       # Solana event logs
│   └── instructions/
│       ├── mod.rs
│       ├── deploy_market.rs            # Create new ICBS pool
│       ├── trade.rs                    # Buy/sell LONG/SHORT tokens
│       ├── add_liquidity.rs            # Bilateral liquidity provision
│       ├── settle_epoch.rs             # BD-based settlement
│       └── close_pool.rs               # Admin pool closure
├── pool_factory/
│   ├── mod.rs
│   ├── state.rs                        # PoolFactory account
│   ├── errors.rs
│   ├── events.rs
│   └── instructions/
│       ├── mod.rs
│       ├── initialize_factory.rs       # Bootstrap factory
│       ├── create_pool.rs              # Factory-based pool creation
│       ├── update_factory_authority.rs
│       ├── update_pool_authority.rs
│       └── update_defaults.rs          # Update ICBS default params
└── veritas_custodian/
    ├── mod.rs
    ├── state.rs                        # User custody accounts
    ├── errors.rs
    ├── events.rs
    └── instructions/
        ├── mod.rs
        ├── initialize_custodian.rs     # Create custody account
        ├── deposit.rs                  # Deposit USDC
        ├── withdraw.rs                 # Withdraw USDC
        ├── update_protocol_authority.rs
        ├── update_owner.rs
        └── toggle_emergency_pause.rs
```

## Smart Contracts

### ContentPool (ICBS Market)

Two-sided prediction market for content relevance speculation.

**Key Instructions:**
- `deploy_market` - Create new pool with LONG/SHORT token mints
- `trade` - Buy or sell LONG/SHORT tokens
- `add_liquidity` - Bootstrap liquidity (bilateral)
- `settle_epoch` - Apply BD-based settlement (scales reserves)
- `close_pool` - Admin emergency closure

**ICBS Pricing:**
- Uses inversely coupled bonding surface mathematics
- Price formula: `p = λ × F × s^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)`
- Prices stored as `sqrt(price) * 2^96` to prevent overflow
- Default parameters: F=3, β=0.5 (1/2)

**Settlement:**
- Each pool settles independently based on its BD score
- Reserves scale up/down based on `q_market` vs `q_actual`
- Accurate traders gain value, inaccurate traders lose

### PoolFactory

Centralized factory for standardized pool deployment.

**Key Instructions:**
- `initialize_factory` - Bootstrap factory with authority
- `create_pool` - Deploy new ContentPool via factory
- `update_defaults` - Change default ICBS parameters
- `update_factory_authority` - Transfer factory control
- `update_pool_authority` - Transfer pool authority

**Purpose:**
- Ensures consistent pool configuration
- Tracks all deployed pools
- Simplifies client-side pool creation

### VeritasCustodian

User USDC custody for trading operations.

**Key Instructions:**
- `initialize_custodian` - Create user custody account
- `deposit` - Deposit USDC from wallet
- `withdraw` - Withdraw USDC to wallet
- `toggle_emergency_pause` - Admin emergency controls

**Features:**
- Per-user PDA-based custody
- Emergency pause mechanism
- Owner-controlled withdrawals

## Key ICBS Features

- **Two-Sided Markets**: Separate LONG/SHORT token mints per pool
- **Square Root Prices**: Stored as `sqrt(price) * 2^96` for precision
- **Market Predictions**: Calculated as `q = R_L / (R_L + R_S)`
- **BD-Based Settlement**: Reserves scale based on prediction accuracy
- **Independent Pools**: Each post's market settles separately

## Deployment Scripts

Available in `scripts/`:
- `initialize-factory.ts` - Deploy PoolFactory
- `initialize-custodian.ts` - Create user custody account
- `create-test-pool.ts` - Deploy test ContentPool
- `update-pool-authority.ts` - Transfer pool control
- `update-settle-interval.ts` - Adjust settlement timing

## Documentation

Comprehensive specifications available in `/specs/solana-specs/`:
- `solana_architecture_spec.md` - Overall architecture
- `smart-contracts/ContentPool.md` - Detailed ContentPool spec
- `smart-contracts/PoolFactory.md` - Factory spec
- `smart-contracts/icbs-high-level.md` - ICBS mathematics
- `pool-deployment-flow.md` - Pool creation workflow
- `pool-settlement-service.md` - Settlement process

## Testing

Test files in `tests/`:
- `content-pool-icbs.test.ts` - Core ICBS trading and settlement
- `pool-factory-icbs.test.ts` - Factory deployment and configuration

Run isolated tests:
```bash
./test-isolated.sh tests/content-pool-icbs.test.ts
```

# Veritas Curation - Solana Program

Elastic-coefficient piecewise bonding curve implementation for content speculation with epoch-based momentum rewards.

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

```bash
anchor test
```

## Project Structure

```
programs/veritas-curation/src/
├── lib.rs                              # Main program entry
├── constants.rs                        # Shared constants
├── errors.rs                           # Error definitions
├── utils.rs                            # Helper functions
└── content_pool/
    ├── mod.rs                          # Module exports
    ├── state.rs                        # Account structures
    ├── curve.rs                        # Bonding curve calculations
    └── instructions/
        ├── mod.rs
        ├── initialize_pool.rs
        ├── buy.rs
        ├── sell.rs
        ├── apply_penalty.rs
        └── apply_reward.rs
```

## Smart Contracts

### Implemented
- ✅ **ContentPool** - Elastic-k piecewise bonding curve with buy/sell/penalty/reward

### Planned
- ⏳ **ProtocolTreasury** - Zero-sum epoch settlement intermediary
- ⏳ **PoolFactory** - Standardized pool deployment
- ⏳ **VeristasCustodian** - User stake custody

## Key Features

- **Elastic-K Mechanism**: Curve coefficients scale proportionally when reserves change
- **Piecewise Curve**: Quadratic → Linear at supply_cap for late-entry protection
- **Epoch Settlements**: Two-phase treasury flow (penalties → rewards)
- **Zero-Sum Rewards**: Parimutuel distribution across pools

## Documentation

Comprehensive specifications available in `/specs/high-level-solana-specs/`:
- `solana_architecture_spec.md` - Overall architecture
- `smart-contracts/ContentPool.md` - Detailed ContentPool spec
- `smart-contracts/ProtocolTreasury.md` - Treasury spec
- `smart-contracts/PoolFactory.md` - Factory spec
- `smart-contracts/VeristasCustodian.md` - Custodian spec

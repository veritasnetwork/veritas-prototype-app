# Veritas Curation SDK

Transaction builders and utilities for ICBS two-sided prediction markets on Solana.

## Overview

The Veritas SDK provides TypeScript transaction builders for:
- **ContentPool** - Two-sided ICBS markets (LONG/SHORT tokens)
- **PoolFactory** - Standardized pool deployment
- **VeritasCustodian** - User USDC custody (global)

## Installation

The SDK is part of the Anchor workspace. To use it in your Next.js app:

1. **Build the program first:**
   ```bash
   cd solana/veritas-curation
   anchor build
   ```

2. **Copy the IDL to your SDK directory:**
   ```bash
   cp target/idl/veritas_curation.json ../../src/lib/solana/target/idl/
   ```

3. **Install dependencies in your Next.js app:**
   ```bash
   cd ../..
   npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
   ```

## Configuration

Add these to your `.env.local`:

```env
# Program ID
NEXT_PUBLIC_PROGRAM_ID=6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz

# Factory PDA (from deployment)
NEXT_PUBLIC_FACTORY_PDA=<factory_pda>

# Protocol Authority (backend service wallet)
NEXT_PUBLIC_PROTOCOL_AUTHORITY=<authority_pubkey>

# Network configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com

# USDC Mint (devnet)
NEXT_PUBLIC_USDC_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
```

## Quick Start

### Initialize Anchor Connection

```typescript
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { VeritasCuration } from './types/veritas_curation';
import idl from './idl/veritas_curation.json';

// Initialize provider
const connection = new anchor.web3.Connection(
  process.env.NEXT_PUBLIC_RPC_ENDPOINT!
);
const wallet = /* your wallet adapter */;
const provider = new anchor.AnchorProvider(connection, wallet, {});
anchor.setProvider(provider);

// Initialize program
const program = new Program<VeritasCuration>(
  idl as VeritasCuration,
  new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
  provider
);
```

### Deploy a ContentPool (ICBS Market)

```typescript
import { buildDeployMarketTx } from './sdk/transaction-builders';
import { PublicKey } from '@solana/web3.js';

const contentId = new PublicKey(postId); // Post ID as PublicKey
const deployer = wallet.publicKey;

const tx = await buildDeployMarketTx(
  program,
  {
    deployer,
    contentId,
    initialDeposit: new anchor.BN(1_000_000), // 1 USDC in micro-USDC
    usdcMint: new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!),
    protocolAuthority: new PublicKey(process.env.NEXT_PUBLIC_PROTOCOL_AUTHORITY!),
    factoryAddress: new PublicKey(process.env.NEXT_PUBLIC_FACTORY_PDA!),
    // Optional: custom ICBS parameters
    f: 3, // Growth exponent (default)
    betaNum: 1, // Beta numerator (default)
    betaDen: 2, // Beta denominator (β = 0.5, default)
  }
);

// Sign and send
const signature = await wallet.sendTransaction(tx, connection);
await connection.confirmTransaction(signature);
```

### Execute a Trade (Buy/Sell LONG or SHORT)

```typescript
import { buildTradeTx, TokenSide, TradeType } from './sdk/transaction-builders';

// Buy LONG tokens
const buyLongTx = await buildTradeTx(
  program,
  {
    trader: wallet.publicKey,
    contentId: new PublicKey(postId),
    side: TokenSide.Long,
    tradeType: TradeType.Buy,
    amount: new anchor.BN(5_000_000), // 5 USDC
    stakeSkim: new anchor.BN(500_000), // 0.5 USDC stake skim
    minTokensOut: new anchor.BN(0), // Set slippage protection
    minUsdcOut: new anchor.BN(0),
    protocolAuthority: new PublicKey(process.env.NEXT_PUBLIC_PROTOCOL_AUTHORITY!),
    usdcMint: new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!),
    factoryAddress: new PublicKey(process.env.NEXT_PUBLIC_FACTORY_PDA!),
  }
);

// Sell SHORT tokens
const sellShortTx = await buildTradeTx(
  program,
  {
    trader: wallet.publicKey,
    contentId: new PublicKey(postId),
    side: TokenSide.Short,
    tradeType: TradeType.Sell,
    amount: new anchor.BN(1_000_000), // 1 SHORT token (atomic units)
    stakeSkim: new anchor.BN(0),
    minTokensOut: new anchor.BN(0),
    minUsdcOut: new anchor.BN(4_500_000), // Expect at least 4.5 USDC back
    protocolAuthority: new PublicKey(process.env.NEXT_PUBLIC_PROTOCOL_AUTHORITY!),
    usdcMint: new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!),
    factoryAddress: new PublicKey(process.env.NEXT_PUBLIC_FACTORY_PDA!),
  }
);
```

### Settle Pool Epoch (Backend Service)

```typescript
import { buildSettleEpochTx } from './sdk/transaction-builders';

const settleTx = await buildSettleEpochTx(
  program,
  settler.publicKey, // Service wallet
  new PublicKey(postId), // Content ID
  0.65, // BD score (0-1 range, 65% relevance)
  protocolAuthority, // Must sign
  new PublicKey(process.env.NEXT_PUBLIC_FACTORY_PDA!)
);

// Protocol authority must pre-sign or co-sign
const signature = await program.provider.sendAndConfirm(settleTx, [
  settler,
  protocolAuthority
]);
```

## Transaction Builders

All builders are in `transaction-builders.ts`:

### ContentPool Transactions
- `buildDeployMarketTx()` - Deploy new ICBS market with LONG/SHORT mints
- `buildTradeTx()` - Unified buy/sell for LONG/SHORT tokens
- `buildAddLiquidityTx()` - Add bilateral liquidity to both sides
- `buildSettleEpochTx()` - Apply BD-based settlement (scales reserves)
- `buildClosePoolTx()` - Admin emergency pool closure

### PoolFactory Transactions
- `buildInitializeFactoryTx()` - Bootstrap factory (one-time)
- `buildCreatePoolTx()` - Create pool via factory
- `buildUpdateDefaultsTx()` - Update default ICBS parameters
- `buildUpdateFactoryAuthorityTx()` - Transfer factory control
- `buildUpdatePoolAuthorityTx()` - Transfer pool authority

## PDA Helpers

The `PDAHelper` class provides methods to derive program-derived addresses:

```typescript
import { PDAHelper } from './sdk/pda-helper';

const pdaHelper = new PDAHelper(program.programId);

// ContentPool PDAs
const [poolPda, poolBump] = pdaHelper.getContentPoolPda(contentIdPubkey);
const [longMintPda] = pdaHelper.getLongMintPda(contentIdPubkey);
const [shortMintPda] = pdaHelper.getShortMintPda(contentIdPubkey);
const [vaultPda] = pdaHelper.getPoolVaultPda(contentIdPubkey);

// PoolFactory PDAs
const [factoryPda] = pdaHelper.getPoolFactoryPda();
const [registryPda] = pdaHelper.getPoolRegistryPda(contentIdPubkey);

// VeritasCustodian PDAs (global, not per-user)
const [custodianPda] = pdaHelper.getGlobalCustodianPda();
const [custodianVaultPda] = pdaHelper.getGlobalCustodianVaultPda();
```

## ICBS Pricing (Client-Side Estimation)

Calculate prices locally for UI display:

```typescript
import { calculateICBSPrice, TokenSide, calculateMarketPrediction } from './icbs-pricing';

// Get current marginal price
const longPrice = calculateICBSPrice(
  pool.supplyLong, // Atomic units (6 decimals)
  pool.supplyShort,
  TokenSide.Long,
  1.0, // Lambda scaling (default)
  3, // F growth exponent
  1, // Beta numerator
  2  // Beta denominator (β = 0.5)
);

// Calculate market prediction (q)
const prediction = calculateMarketPrediction(
  pool.supplyLong,
  pool.supplyShort
);
console.log(`Market predicts ${(prediction * 100).toFixed(1)}% relevance`);

// Estimate trade outcomes
import { estimateTokensOut, estimateUsdcOut } from './icbs-pricing';

const tokensReceived = estimateTokensOut(
  pool.supplyLong, // Current side supply
  pool.supplyShort, // Other side supply
  5.0, // USDC to spend
  TokenSide.Long
);

const usdcReceived = estimateUsdcOut(
  pool.supplyLong,
  pool.supplyShort,
  1.0, // Tokens to sell
  TokenSide.Long
);
```

## Square Root Price Conversion

On-chain prices are stored as `sqrt(price) * 2^96`. Convert for display:

```typescript
import { sqrtPriceX96ToPrice } from './sqrt-price-helpers';

// From on-chain to human-readable
const pool = await program.account.contentPool.fetch(poolPda);
const longPrice = sqrtPriceX96ToPrice(pool.sqrtPriceLongX96);
const shortPrice = sqrtPriceX96ToPrice(pool.sqrtPriceShortX96);

console.log(`LONG: $${longPrice.toFixed(4)}, SHORT: $${shortPrice.toFixed(4)}`);
```

## Token Side and Trade Type Enums

```typescript
export enum TokenSide {
  Long = 0,
  Short = 1,
}

export enum TradeType {
  Buy = 0,
  Sell = 1,
}
```

## Error Handling

```typescript
try {
  const tx = await buildTradeTx(program, params);
  const sig = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(sig);
} catch (error) {
  if (error.message.includes('InsufficientBalance')) {
    console.error('Not enough USDC in wallet');
  } else if (error.message.includes('SlippageExceeded')) {
    console.error('Price moved too much, adjust minTokensOut/minUsdcOut');
  } else {
    console.error('Transaction failed:', error);
  }
}
```

## Testing

Run SDK tests:

```bash
cd solana/veritas-curation
anchor test
```

Test specific functionality:

```bash
./test-isolated.sh tests/content-pool-icbs.test.ts
```

## Architecture Notes

### ICBS Markets
- Each post gets its own ContentPool with separate LONG/SHORT token mints
- Prices follow the formula: `p = λ × F × s^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)`
- Market prediction: `q = R_L / (R_L + R_S)` where `R = supply × price`

### Settlement
- Pools settle independently each epoch based on BD scores
- Reserves scale proportionally: accurate predictions gain value, inaccurate lose
- No zero-sum redistribution between pools

### Global Custodian
- Single `VeritasCustodian` account for the entire protocol
- Users don't need individual custodian accounts
- Simplifies trading flow and reduces account rent

## Documentation

Full specifications in `/specs/solana-specs/`:
- `solana_architecture_spec.md` - Overall architecture
- `smart-contracts/ContentPool.md` - ContentPool details
- `smart-contracts/PoolFactory.md` - Factory details
- `smart-contracts/icbs-high-level.md` - ICBS mathematics
- `pool-deployment-flow.md` - Deployment workflow

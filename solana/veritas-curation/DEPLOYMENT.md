# Veritas Curation Protocol - Deployment Guide

## Prerequisites

1. **Solana CLI installed**

   ```bash
   solana --version
   ```

2. **Anchor installed** (v0.31.1+)

   ```bash
   anchor --version
   ```

3. **Node.js and Yarn**
   ```bash
   node --version
   yarn --version
   ```

## 📦 Step 2: Build the Program

```bash
# Clean build
anchor clean
anchor build

# Verify the program ID matches Anchor.toml
anchor keys list
```

## 🌐 Step 3: Choose Network & Configure

### Localnet (Development)

```bash
# Start local validator
solana-test-validator

# In another terminal, configure
solana config set --url localhost
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET=~/.config/solana/id.json
```

**Note:** For localnet, you'll need to create a mock USDC mint. See test files for examples.

### Devnet (Testing)

```bash
solana config set --url devnet
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

# Airdrop SOL for deployment costs
solana airdrop 2 $(solana address)
```

Devnet uses USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

### Mainnet (Production)

```bash
solana config set --url mainnet-beta
export ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

# Ensure wallet has sufficient SOL for deployment (~5 SOL recommended)
solana balance
```

Mainnet uses USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## 🚀 Step 4: Deploy Program

```bash
# Deploy the program
anchor deploy

# Verify deployment
solana program show <PROGRAM_ID>
```

The program ID should match what's in `Anchor.toml` and `lib.rs`.

## ⚙️ Step 5: Initialize Protocol

You have two options:

### Option A: Run All Steps at Once (Recommended)

```bash
npx ts-node scripts/deploy-all.ts
```

This will:

1. Verify program deployment
2. Initialize protocol config
3. Initialize treasury
4. Initialize factory

### Option B: Run Steps Individually

```bash
# Step 1: Verify program
npx ts-node scripts/1-deploy-program.ts

# Step 2: Initialize config
npx ts-node scripts/2-initialize-config.ts

# Step 3: Initialize treasury
npx ts-node scripts/3-initialize-treasury.ts

# Step 4: Initialize factory
npx ts-node scripts/4-initialize-factory.ts
```

## 📋 Step 6: Verify Deployment

Check the `deployments/` directory for deployment artifacts:

```bash
ls -la deployments/

# You should see:
# - program-{network}.json
# - config-{network}.json
# - treasury-{network}.json
# - factory-{network}.json
```

Each file contains addresses, transaction IDs, and deployment metadata.

## 🔧 Configuration Parameters

Default values are in `config/default.json`:

| Parameter           | Value           | Description                        |
| ------------------- | --------------- | ---------------------------------- |
| `defaultKQuadratic` | 1,000,000       | 0.001 curvature (moderate bonding) |
| `defaultReserveCap` | 5,000,000,000   | 5,000 USDC max reserve             |
| `minKQuadratic`     | 100,000         | 0.0001 (shallow curve)             |
| `maxKQuadratic`     | 10,000,000      | 0.01 (steep curve)                 |
| `minReserveCap`     | 1,000,000,000   | 1,000 USDC minimum                 |
| `maxReserveCap`     | 100,000,000,000 | 100,000 USDC maximum               |
| `minTradeAmount`    | 100,000         | 0.1 USDC minimum trade             |

To modify these values, edit `config/default.json` before running initialization scripts.

## 🔐 Security Checklist

- [ ] Authority keypair generated and backed up securely
- [ ] Authority keypair NOT committed to git
- [ ] Hardware wallet considered for mainnet
- [ ] Deployment artifacts saved and documented
- [ ] Program verified on-chain
- [ ] All PDAs initialized successfully
- [ ] Config parameters reviewed and validated

## 🛠️ Post-Deployment

### Update Next.js App Configuration

Add these to your `.env.local`:

```bash
# From deployments/program-{network}.json
NEXT_PUBLIC_PROGRAM_ID=<program_id>

# From deployments/config-{network}.json
NEXT_PUBLIC_CONFIG_PDA=<config_pda>

# From deployments/treasury-{network}.json
NEXT_PUBLIC_TREASURY_PDA=<treasury_pda>

# From deployments/factory-{network}.json
NEXT_PUBLIC_FACTORY_PDA=<factory_pda>

# Network
NEXT_PUBLIC_SOLANA_NETWORK=<devnet|mainnet>
NEXT_PUBLIC_RPC_ENDPOINT=<rpc_url>

# USDC Mint
NEXT_PUBLIC_USDC_MINT=<usdc_mint_address>
```

### Next Steps

1. **User Onboarding**: Implement custodian initialization in your Next.js app
2. **Pool Creation**: Implement pool creation via factory in your app
3. **Trading Interface**: Build UI for buy/sell operations
4. **Monitoring**: Set up logging and alerts for protocol activity

## 📚 Additional Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [SPL Token Program](https://spl.solana.com/token)

## 🆘 Troubleshooting

### "Authority keypair not found"

Generate the keypair with:

```bash
solana-keygen new --outfile keys/authority.json
```

### "Insufficient funds"

Ensure your wallet has enough SOL:

```bash
solana balance
# Devnet: solana airdrop 2
```

### "Account already initialized"

This is normal if you're re-running scripts. The scripts will skip re-initialization.

### "Program not deployed"

Run `anchor deploy` first before running initialization scripts.

## 🔄 Updating Configuration

To update protocol config after deployment:

```bash
# Use the update_config instruction
# Example script coming soon
```

## 📞 Support

For issues or questions:

- Open an issue on GitHub
- Check deployment artifacts in `deployments/` directory
- Review transaction logs on Solana Explorer

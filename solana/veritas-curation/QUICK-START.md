# Veritas Curation - Quick Start Guide

## 📦 What We Built

Complete deployment infrastructure for your Solana smart contracts:

1. **Authority Management** - Secure keypair handling with .gitignore
2. **Configuration System** - JSON-based protocol parameters
3. **Deployment Scripts** - Individual + unified deployment
4. **Transaction Builders** - SDK for Next.js integration
5. **Client Examples** - Ready-to-use code for your app

## 🚀 Deployment Checklist

### Step 1: Generate Authority Keypair

```bash
cd solana/veritas-curation
solana-keygen new --outfile keys/authority.json
```

**⚠️ CRITICAL: Back up this file immediately! It controls all protocol authorities.**

### Step 2: Build & Deploy

```bash
# Build program
anchor build

# Deploy to devnet
solana config set --url devnet
anchor deploy

# Initialize protocol (runs all 4 steps)
npx ts-node scripts/deploy-all.ts
```

This will:
- ✅ Verify program deployment
- ✅ Initialize protocol config (5k USDC reserve cap, 0.001 k_quadratic)
- ✅ Initialize treasury (fee collection)
- ✅ Initialize factory (permissionless pool creation)

### Step 3: Save Deployment Info

After deployment, you'll have files in `deployments/`:
- `program-devnet.json` - Program ID
- `config-devnet.json` - Config PDA and parameters
- `treasury-devnet.json` - Treasury PDA and vault
- `factory-devnet.json` - Factory PDA

Add these to your Next.js `.env.local`:

```bash
NEXT_PUBLIC_PROGRAM_ID=<from program-devnet.json>
NEXT_PUBLIC_CONFIG_PDA=<from config-devnet.json>
NEXT_PUBLIC_TREASURY_PDA=<from treasury-devnet.json>
NEXT_PUBLIC_FACTORY_PDA=<from factory-devnet.json>
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

## 🔧 Protocol Configuration

Default parameters (in `config/default.json`):

| Parameter | Value | Meaning |
|-----------|-------|---------|
| Default Reserve Cap | 5,000 USDC | Max USDC per pool |
| Default K Quadratic | 1,000,000 | 0.001 curvature |
| Min Reserve Cap | 1,000 USDC | Minimum |
| Max Reserve Cap | 100,000 USDC | Maximum |
| Min Trade Amount | 0.1 USDC | Smallest trade |

To change these, edit `config/default.json` before running deployment scripts.

## 📚 Integration Guide

### 1. User Onboarding (Create Custodian)

When a user signs up:

```typescript
import { initializeUserCustodian } from "@/solana/sdk/client-example";

// On first login
const tx = await initializeUserCustodian(
  program,
  userWallet,
  protocolAuthority,
  usdcMint
);

if (tx) {
  await sendTransaction(tx, connection);
}
```

### 2. Post Creation (Create Pool)

When a user creates a post:

```typescript
import { createPoolForPost } from "@/solana/sdk/client-example";

const tx = await createPoolForPost(
  program,
  userWallet,
  postId, // Your DB post ID
  addresses
);

const sig = await sendTransaction(tx, connection);

// Save pool address to database
```

### 3. Trading (Buy/Sell)

```typescript
// Buy tokens
const buyTx = await buyPoolTokens(program, userWallet, postId, 10, addresses);
await sendTransaction(buyTx, connection);

// Sell tokens
const sellTx = await sellPoolTokens(program, userWallet, postId, 100, addresses);
await sendTransaction(sellTx, connection);
```

## 📁 File Structure

```
solana/veritas-curation/
├── config/
│   └── default.json          # Protocol parameters
├── keys/
│   └── authority.json        # YOUR AUTHORITY KEYPAIR (gitignored)
├── deployments/
│   ├── program-*.json        # Deployment artifacts (gitignored)
│   ├── config-*.json
│   ├── treasury-*.json
│   └── factory-*.json
├── scripts/
│   ├── 1-deploy-program.ts   # Verify deployment
│   ├── 2-initialize-config.ts
│   ├── 3-initialize-treasury.ts
│   ├── 4-initialize-factory.ts
│   └── deploy-all.ts         # Run all steps
├── sdk/
│   ├── transaction-builders.ts  # Transaction utilities
│   ├── client-example.ts        # Next.js examples
│   └── README.md                # SDK documentation
├── DEPLOYMENT.md             # Full deployment guide
└── QUICK-START.md           # This file
```

## 🔐 Security Notes

1. **Authority keypair** (`keys/authority.json`):
   - Controls ALL protocol settings
   - NEVER commit to git (already gitignored)
   - Back up to secure location immediately
   - Consider hardware wallet for mainnet

2. **Deployment artifacts** (`deployments/*.json`):
   - Gitignored to prevent accidental commits
   - Safe to share PDAs publicly
   - Keep transaction signatures for audit trail

3. **For production (mainnet)**:
   - Use hardware wallet (Ledger)
   - Test thoroughly on devnet first
   - Set up monitoring/alerts
   - Document recovery procedures

## 🛠️ Development Workflow

### Local Development

```bash
# Terminal 1: Start validator
solana-test-validator

# Terminal 2: Deploy and test
anchor test --skip-local-validator
```

### Devnet Testing

```bash
solana config set --url devnet
anchor deploy
npx ts-node scripts/deploy-all.ts
```

### Mainnet Deployment

```bash
solana config set --url mainnet-beta

# IMPORTANT: Use hardware wallet or secure authority
anchor deploy
npx ts-node scripts/deploy-all.ts
```

## 📖 Documentation

- **Full Deployment Guide**: See `DEPLOYMENT.md`
- **SDK Documentation**: See `sdk/README.md`
- **Test Specs**: See `specs/test-specs/solana/`
- **Smart Contract Specs**: See `specs/solana-specs/`

## 🆘 Common Issues

### "Authority keypair not found"
→ Run `solana-keygen new --outfile keys/authority.json`

### "Insufficient funds"
→ Devnet: `solana airdrop 2`
→ Mainnet: Fund your wallet

### "Account already initialized"
→ This is normal on re-runs. Scripts skip re-initialization.

### "Transaction simulation failed"
→ Check SOL balance for rent
→ Verify all accounts initialized

## 🎯 Next Steps

1. ✅ Complete deployment on devnet
2. ✅ Save deployment artifacts
3. ✅ Configure Next.js environment
4. 🔨 Integrate transaction builders into your app
5. 🔨 Build UI for pool creation and trading
6. 🔨 Add monitoring and analytics
7. 🚀 Deploy to mainnet when ready

## 💡 Tips

- **Test on devnet first** - It's free and safe
- **Keep deployment artifacts** - You'll need the PDAs
- **Monitor transactions** - Use Solana Explorer
- **Log everything** - Helpful for debugging
- **Start simple** - Get one flow working before adding complexity

## 🤝 Support

Questions? Check:
1. `DEPLOYMENT.md` for detailed deployment steps
2. `sdk/README.md` for integration examples
3. Test files in `tests/` for usage patterns
4. Deployment artifacts in `deployments/`

---

**Ready to deploy?** Start with Step 1 above! 🚀

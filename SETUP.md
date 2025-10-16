# Veritas Setup Guide

Complete setup instructions for new developers pulling this repository.

## Prerequisites

Before you begin, install these tools:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/) (for local Supabase)
- **Supabase CLI** - `npm install -g supabase`
- **Solana CLI** - [Install Guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor CLI** - `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked`
- **Rust** - [Install](https://rustup.rs/) (required for Anchor)

## Quick Start (5 minutes)

For a complete local development environment:

```bash
# 1. Clone and install
git clone <repo-url>
cd veritas-prototype-app
npm install

# 2. Copy environment variables
cp .env.local.example .env.local

# 3. Start Supabase (Docker must be running)
npx supabase start

# 4. Run the automated setup script
./scripts/setup-local-test.sh

# 5. Start the dev server
npm run dev
```

The setup script will:
- ✅ Deploy Solana contracts to localnet
- ✅ Create and fund test wallets with SOL and USDC
- ✅ Initialize the protocol (config, treasury, factory)
- ✅ Auto-update your `.env.local` with all addresses
- ✅ Reset and migrate the database

**Open http://localhost:3000** - You're ready to go!

---

## Manual Setup (Step by Step)

If you prefer to set up manually or the automated script fails:

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

**Required files:**
- `.env.local` (root directory)

Copy the example and fill in values:

```bash
cp .env.local.example .env.local
```

**Edit `.env.local`:**

```bash
# ============================================================================
# SUPABASE (Get from: npx supabase status)
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get_from_supabase_status>
SUPABASE_SERVICE_ROLE_KEY=<get_from_supabase_status>

# ============================================================================
# PRIVY AUTH (Get from: https://dashboard.privy.io)
# ============================================================================
NEXT_PUBLIC_PRIVY_APP_ID=<your_privy_app_id>
PRIVY_APP_SECRET=<your_privy_app_secret>

# Optional: Skip auth for local testing (NEVER in production)
NEXT_PUBLIC_BYPASS_AUTH=false

# ============================================================================
# SOLANA LOCALNET
# ============================================================================
NEXT_PUBLIC_SOLANA_NETWORK=localnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899

# These will be auto-filled by setup-local-test.sh:
NEXT_PUBLIC_VERITAS_PROGRAM_ID=<from_setup_script>
NEXT_PUBLIC_USDC_MINT_LOCALNET=<from_setup_script>
```

### 3. Start Local Supabase

```bash
npx supabase start
```

**Copy the output values** into your `.env.local`:
- `API URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Deploy Solana Contracts

```bash
# Navigate to Solana contracts
cd solana/veritas-curation

# Start local validator (in a separate terminal)
solana-test-validator

# Build and deploy (in original terminal)
anchor build
anchor deploy

# Copy the Program ID from output and add to .env.local:
# NEXT_PUBLIC_VERITAS_PROGRAM_ID=<program_id>
```

### 5. Initialize Protocol

```bash
# Still in solana/veritas-curation/
cd scripts

# Deploy all components
npx ts-node deploy-all.ts
```

This will:
- Initialize ProtocolConfig
- Initialize ProtocolTreasury
- Initialize PoolFactory
- Create test USDC mint
- Fund test wallet

### 6. Update Environment with Addresses

After running `deploy-all.ts`, copy the USDC mint address to `.env.local`:

```bash
NEXT_PUBLIC_USDC_MINT_LOCALNET=<usdc_mint_from_deploy>
```

### 7. Run Database Migrations

```bash
# From root directory
npx supabase db reset
```

This applies all migrations in `supabase/migrations/`.

### 8. Start Development Server

```bash
npm run dev
```

Visit **http://localhost:3000**

---

## Get Privy Credentials

Veritas uses Privy for authentication (wallet, email, Apple).

1. Go to https://dashboard.privy.io
2. Create a new app (or use existing)
3. Go to **Settings** → **Basics**
4. Copy:
   - **App ID** → `NEXT_PUBLIC_PRIVY_APP_ID`
   - **App Secret** → `PRIVY_APP_SECRET`
5. Configure allowed chains:
   - Go to **Settings** → **Chains**
   - Enable **Solana**

---

## Troubleshooting

### "Cannot connect to Supabase"
```bash
# Check if Supabase is running
npx supabase status

# If not, start it
npx supabase start
```

### "Solana program not found"
```bash
# Check if validator is running
solana config get

# Start validator
solana-test-validator

# Redeploy
cd solana/veritas-curation
anchor deploy
```

### "Invalid program ID"
Your `.env.local` has an outdated program ID. Re-run:
```bash
./scripts/setup-local-test.sh
```

### "Pool data not syncing"
The frontend expects specific pool data format. Check:
1. Program is deployed (`anchor deploy`)
2. Migrations ran (`npx supabase db reset`)
3. `.env.local` has correct `NEXT_PUBLIC_VERITAS_PROGRAM_ID`

---

## Production Deployment

### Vercel (Frontend)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables (use production values):
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `NEXT_PUBLIC_PRIVY_APP_ID` - Your Privy app ID
   - `PRIVY_APP_SECRET` - Your Privy app secret
   - `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
   - `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` - Your RPC endpoint (e.g., Helius)
   - `NEXT_PUBLIC_VERITAS_PROGRAM_ID` - Deployed program address
   - `NEXT_PUBLIC_USDC_MINT_MAINNET` - Official USDC mint

### Supabase (Database)

1. Create project at https://supabase.com
2. Link local project: `npx supabase link --project-ref <ref>`
3. Push migrations: `npx supabase db push`

### Solana (Contracts)

```bash
# Switch to devnet/mainnet
solana config set --url https://api.devnet.solana.com

# Deploy
cd solana/veritas-curation
anchor build
anchor deploy --provider.cluster devnet
```

---

## Next Steps

- Read [CLAUDE.md](./CLAUDE.md) for architecture overview
- Check [specs/](./specs/) for detailed specifications
- Review [Database Schema](./specs/data-structures/)

## Need Help?

- Check existing issues: https://github.com/veritasnetwork/veritas-prototype-app/issues
- Create a new issue with:
  - Steps to reproduce
  - Error messages
  - Output of `npx supabase status` and `solana config get`

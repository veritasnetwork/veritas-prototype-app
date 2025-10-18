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

Veritas uses Privy for authentication (wallet, email, Apple). **Each developer needs their own Privy app for local development.**

### Step-by-Step Privy Setup

#### 1. Create Privy Account

1. Go to **https://dashboard.privy.io**
2. Sign up with your email or GitHub
3. Verify your email

#### 2. Create a New App

1. Click **"Create new app"**
2. Enter app name: `Veritas Local Dev - [Your Name]`
3. Click **Create**

#### 3. Get Your Credentials

1. You'll land on the app dashboard
2. Copy the **App ID** (visible at top, starts with `clp...`)
   - Add to `.env.local`: `NEXT_PUBLIC_PRIVY_APP_ID=clp...`
3. Click **Settings** → **Basics** in sidebar
4. Under **App Secret**, click **"Create new secret"**
5. Copy the secret (starts with `...`)
   - Add to `.env.local`: `PRIVY_APP_SECRET=...`
   - ⚠️ **Save this now** - you can't view it again!

#### 4. Configure Login Methods

1. In sidebar, go to **Login methods**
2. Enable the methods you want:
   - ✅ **Email** - Simple, works everywhere
   - ✅ **Wallet** - For Solana wallet connection
   - ✅ **Apple** - Social login (optional)
   - ⚠️ Google, Discord, etc. require additional OAuth setup

#### 5. Configure Solana Chain

1. Go to **Chains** in sidebar
2. Click **"Add chain"**
3. Select **Solana** from the list
4. Choose network:
   - **Mainnet** - For production
   - **Devnet** - For testing
   - **Localnet** - Won't work (Privy can't reach localhost validator)
5. Click **Save**

#### 6. Configure Allowed Domains (Important!)

1. Go to **Settings** → **Basics**
2. Scroll to **Allowed domains**
3. Add your development domain:
   ```
   http://localhost:3000
   ```
4. For production, add:
   ```
   https://your-vercel-app.vercel.app
   https://yourdomain.com
   ```
5. Click **Save**

#### 7. Test Your Setup

1. Your `.env.local` should now have:
   ```bash
   NEXT_PUBLIC_PRIVY_APP_ID=clp...
   PRIVY_APP_SECRET=...
   ```
2. Start your dev server: `npm run dev`
3. Visit http://localhost:3000
4. Click **"Connect Wallet"**
5. You should see the Privy login modal
6. Try logging in with email or wallet

### Troubleshooting Privy

#### "App ID is invalid"
- Check that `NEXT_PUBLIC_PRIVY_APP_ID` in `.env.local` matches the dashboard
- Restart your dev server after changing `.env.local`

#### "Domain not allowed"
- Add `http://localhost:3000` to **Allowed domains** in Privy dashboard
- Make sure you're accessing the app at exactly `localhost:3000`, not `127.0.0.1:3000`

#### "Solana wallet not showing"
- Enable **Solana** chain in Privy dashboard under **Chains**
- Install Phantom browser extension from https://phantom.app
- Refresh your browser after installing Phantom

#### "Phantom redirects to website instead of opening"
- Ensure Phantom browser extension is installed and enabled
- Check browser popup blocker settings (allow popups for localhost)
- Try a different browser (Chrome, Brave, or Edge work best)

### Development Bypass (Optional)

For faster iteration without auth (NOT for production):

```bash
# Add to .env.local
NEXT_PUBLIC_BYPASS_AUTH=true
```

This skips Privy entirely and uses a mock user. Useful for:
- Testing UI without auth flow
- Working on features that don't need real auth
- CI/CD testing

⚠️ **Never set this to `true` in production** - pre-commit hooks will block it.

### Team Development

**Each developer should create their own Privy app** for local development:
- Free tier: 1,000 monthly active users (plenty for local testing)
- Keeps test users isolated
- Avoids shared secret issues
- No conflicts with production app

**For staging/production**, create separate shared Privy apps:
- `Veritas Staging` - Shared staging environment
- `Veritas Production` - Production app
- Store credentials in Vercel/deployment platform environment variables

---

## Using Shared Cloud Supabase (Alternative to Local)

By default, the setup uses **local Supabase** (Docker-based, isolated per developer). For team collaboration, you can use a **shared cloud Supabase** instead.

### When to Use Shared Supabase

**Use shared cloud Supabase if:**
- ✅ You want to share posts/users between developers
- ✅ Docker is unavailable or problematic
- ✅ You're okay with shared test data

**Use local Supabase if:**
- ✅ You want isolated development environments
- ✅ You need to test migrations safely
- ✅ You prefer not sharing credentials

### Setup with Shared Cloud Supabase

1. **Get credentials from project owner:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   ```

2. **Add to your `.env.local`** (skip `npx supabase start`)

3. **Skip database migrations** - they're already applied on the shared instance

4. **Continue with Solana setup** (still runs locally)

### Credentials Locations

**Local Supabase:**
- Run `npx supabase status` to see credentials
- Same for all developers (standard Docker keys)
- Database resets don't affect others

**Cloud Supabase:**
- Get from project owner or Supabase dashboard
- Unique per project
- Changes affect all developers using it

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

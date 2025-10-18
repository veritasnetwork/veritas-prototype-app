# Veritas Setup

## Prerequisites

Install these first:
- Node.js 18+, Docker Desktop, Supabase CLI (`npm i -g supabase`), Solana CLI, Anchor CLI, Rust

## Quick Setup

```bash
git clone <repo>
cd veritas-prototype-app
npm install
cp .env.local.example .env.local
npx supabase start
./scripts/setup-local-test.sh
npm run dev
```

## Get Privy Credentials

**Option 1: Use team credentials** (ask team lead)

**Option 2: Create your own** (5 min, free):
1. Go to https://dashboard.privy.io
2. Create new app
3. Copy **App ID** and **App Secret** to `.env.local`
4. Enable **Email** and **Wallet** login methods
5. Add **Solana** chain
6. Add `http://localhost:3000` to allowed domains

## Environment Variables

After `npx supabase start`, add to `.env.local`:

```bash
# Supabase (from: npx supabase status)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from_supabase_status>
SUPABASE_SERVICE_ROLE_KEY=<from_supabase_status>

# Privy (from: dashboard.privy.io)
NEXT_PUBLIC_PRIVY_APP_ID=<your_app_id>
PRIVY_APP_SECRET=<your_secret>

# Solana (auto-filled by setup script)
NEXT_PUBLIC_SOLANA_NETWORK=localnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899
NEXT_PUBLIC_VERITAS_PROGRAM_ID=<from_setup_script>
NEXT_PUBLIC_USDC_MINT_LOCALNET=<from_setup_script>
```

## Troubleshooting

**Supabase not connecting:**
```bash
npx supabase status  # Check if running
npx supabase start   # Start if needed
```

**Phantom wallet not showing:**
- Install Phantom extension from https://phantom.app
- Allow popups for localhost
- Use Chrome, Brave, or Edge (not Safari)

**Reset everything:**
```bash
./scripts/setup-local-test.sh
```

## Production Deployment

**Vercel:**
- Connect GitHub repo
- Add environment variables (use production values)
- Deploy

**Supabase:**
```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

**Solana:**
```bash
solana config set --url devnet
anchor build && anchor deploy --provider.cluster devnet
```

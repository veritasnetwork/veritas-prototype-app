# Veritas

Social consensus platform combining content curation with on-chain speculation via Solana bonding curves.

## Quick Start

```bash
npm install
cp .env.local.example .env.local
npx supabase start
./scripts/setup-local-test.sh
npm run dev
```

Open http://localhost:3000

## What You Need

**Credentials:**
- **Privy** - Get free app at [dashboard.privy.io](https://dashboard.privy.io) OR ask team for shared credentials
- **Supabase** - Auto-configured by `npx supabase start` (local Docker)
- **Solana** - Auto-deployed by setup script

**Tools:**
- Node.js 18+, Docker Desktop, Supabase CLI, Solana CLI, Anchor CLI, Rust

See [SETUP.md](./SETUP.md) for detailed instructions.

## Daily Workflow

```bash
npx supabase start          # Terminal 1
solana-test-validator       # Terminal 2
npm run dev                 # Terminal 3
```

**Reset everything:** `./scripts/setup-local-test.sh`

## Docs

- [SETUP.md](./SETUP.md) - Detailed setup
- [CLAUDE.md](./CLAUDE.md) - Architecture
- [specs/](./specs/) - Technical specs

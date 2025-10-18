# Veritas - Intersubjective Social Consensus Platform

Veritas is a consumer web application combining content curation with on-chain speculation. Users create posts, each backed by a Solana bonding curve pool. The Veritas Protocol validates pool relevance through Bayesian Truth Serum and redistributes value between pools based on relative quality.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.local.example .env.local

# 3. Start Supabase (requires Docker)
npx supabase start

# 4. Run automated setup (deploys contracts, creates wallets, initializes protocol)
./scripts/setup-local-test.sh

# 5. Start development server
npm run dev
```

**📖 Full setup guide:** [SETUP.md](./SETUP.md)

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Solana (Anchor framework)
- **Auth**: Privy (wallet, email, Apple)

## Architecture

**Three Layers:**
1. **App Layer** - User-facing content and social features
2. **Protocol Layer** - Veritas consensus protocol (BTS, belief decomposition)
3. **Solana Layer** - Smart contracts for content pool speculation

**Key Concepts:**
- Each post gets a bonding curve pool (ContentPool)
- Users buy/sell tokens to speculate on content quality
- Every epoch, protocol validates pools and redistributes value
- Losing pools pay winning pools → incentivizes quality discovery

**📖 Architecture details:** [CLAUDE.md](./CLAUDE.md)

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── feed/        # Feed-related components
│   └── layout/      # Layout components
├── hooks/           # Custom React hooks
├── lib/             # External library configs
├── providers/       # React context providers
├── styles/          # Global styles
└── types/           # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Development Workflow

### First Time Setup
See [SETUP.md](./SETUP.md) for complete instructions.

### Daily Development
```bash
# Terminal 1: Supabase (if not running)
npx supabase start

# Terminal 2: Solana validator (if not running)
solana-test-validator

# Terminal 3: Next.js dev server
npm run dev
```

### Reset Everything
```bash
./scripts/setup-local-test.sh
```

This resets Solana state, redeploys contracts, and updates your `.env.local`.

## Key Documentation

- [SETUP.md](./SETUP.md) - Complete setup instructions
- [CLAUDE.md](./CLAUDE.md) - Architecture overview
- [specs/](./specs/) - Technical specifications
  - [Database Schema](./specs/data-structures/)
  - [API Specs](./specs/api/)
  - [UI Components](./specs/ui/)
  - [Solana Contracts](./specs/solana-specs/)

## Environment Variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - From `npx supabase status`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From `npx supabase status`
- `SUPABASE_SERVICE_ROLE_KEY` - From `npx supabase status`
- `NEXT_PUBLIC_PRIVY_APP_ID` - Create free app at [dashboard.privy.io](https://dashboard.privy.io)
- `PRIVY_APP_SECRET` - From Privy dashboard (each dev needs their own)
- `NEXT_PUBLIC_SOLANA_NETWORK` - `localnet` for development
- `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` - `http://127.0.0.1:8899` for localnet
- `NEXT_PUBLIC_VERITAS_PROGRAM_ID` - Auto-filled by setup script
- `NEXT_PUBLIC_USDC_MINT_LOCALNET` - Auto-filled by setup script

**Note:** Privy credentials are free and each developer should create their own app for local development (1,000 MAU free tier). See [SETUP.md](./SETUP.md#get-privy-credentials) for step-by-step instructions.

See [.env.local.example](./.env.local.example) for all variables and descriptions.

## Contributing

1. Read [CLAUDE.md](./CLAUDE.md) to understand the architecture
2. Check existing issues or create a new one
3. Make your changes following the development principles in CLAUDE.md
4. Update relevant specs in [specs/](./specs/)
5. Submit a pull request

## License

[Add license information]
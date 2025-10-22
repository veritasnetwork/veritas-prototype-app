# Veritas - Intersubjective Social Consensus Platform

## Architecture Overview

Veritas is a consumer web application with three distinct layers:

1. **App Layer** - User-facing content and social features (Supabase + Next.js)
2. **Protocol Layer** - Veritas Protocol for intersubjective social consensus using Bayesian Truth Serum and belief decomposition
3. **Solana Layer** - Smart contracts for speculation on content via ICBS two-sided prediction markets

### How It Works

- Users create posts in the app layer
- Each post gets a Solana ICBS market deployed (ContentPool with LONG/SHORT tokens)
- Users trade LONG tokens (bullish on relevance) or SHORT tokens (bearish on relevance)
- Every Veritas epoch, the protocol calculates absolute BD relevance scores
- Each pool settles independently: reserves scale based on market prediction vs actual relevance
- Accurate traders gain value, inaccurate traders lose → incentivizes truthful speculation

## Current Status

✅ **Solana Smart Contracts** - ContentPool (ICBS), PoolFactory, VeritasCustodian deployed to local devnet
✅ **Core Veritas Protocol** - Full implementation of epistemic weights, belief decomposition, BTS scoring, stake redistribution
✅ **Privy Auth & Onboarding** - Complete auth flow with email/Apple/Solana, user onboarding with profile photos
✅ **Database Schema** - 29 migrations covering all protocol, app, and trading tables
✅ **Pool Settlement** - BD-score based independent pool settlement with event indexing
✅ **Trading Infrastructure** - ICBS pricing library, LONG/SHORT token trading, USDC deposits/withdrawals
✅ **REST API** - 23+ Next.js API routes for posts, pools, trades, media, users, admin
✅ **Edge Functions** - 24 Supabase functions for protocol execution and chain syncing
✅ **Full UI** - Post creation (rich text + media), feed, trading interface, profile pages, wallet integration
✅ **Event Indexing** - WebSocket-based indexer for real-time on-chain event processing
✅ **Mobile Responsive** - Full mobile UX with responsive design and touch optimization
✅ **Media Handling** - Image and video upload with Supabase Storage integration
✅ **Local Dev Setup** - Automated setup scripts for local Solana + Supabase development

## Technical Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Privy (auth), Tiptap (rich text editor)
- **Backend**: Supabase (PostgreSQL + Edge Functions), Next.js API Routes
- **Blockchain**: Solana (Anchor framework), SPL Token Program
- **Auth**: Privy (embedded wallets, email, social) - NOT Supabase Auth
- **Testing**: Vitest (protocol tests), Anchor (smart contract tests)

## Key Directories

- `/specs` - All specifications (~85 spec files)
  - `/specs/api` - REST API specifications (auth, posts, pools, users, media, webhooks, admin)
  - `/specs/data-structures` - Database schema documentation (protocol, app, trading tables)
  - `/specs/edge-function-specs` - Supabase Edge Function specifications
  - `/specs/solana-specs` - Solana smart contract specs (ContentPool, PoolFactory, VeritasCustodian)
  - `/specs/architecture` - System architecture (event indexing, trading flow, stake system)
  - `/specs/veritas-protocol` - Protocol algorithm documentation
  - `/specs/test-specs` - Test specifications for all components
  - `/specs/ui-specs` - UI component and page specifications
- `/solana/veritas-curation` - Anchor programs and scripts
  - `programs/veritas-curation/src` - Smart contract source code
  - `scripts/` - Deployment and initialization scripts
  - `tests/` - Integration tests for ContentPool and PoolFactory
- `/src/lib/solana` - Transaction building utilities and ICBS pricing library
- `/app/api` - Next.js API routes (auth, posts, pools, trades, media, users, admin, webhooks)
- `/supabase` - Database migrations (29 files) and edge functions (24 functions)
- `/src/components` - React components (auth, feed, post, profile, pool, wallet, layout)
- `/src/hooks` - React hooks (trading, wallet, balances, API queries)
- `/src/services` - Service layer (posts, event processor, pool sync, websocket indexer)

## Development Principles

1. **Make minimal assumptions** - Check variables and validate data at all times
2. **Maintain consistency** - Cross-reference specs when implementing features
3. **Layer separation** - Keep app, protocol, and Solana layers distinct
4. **Test thoroughly** - All specs have corresponding test files in `/specs/test-specs`
5. **Document as you go** - Update specs when implementation changes

## Database Schema (Supabase)

See `/specs/data-structures` for full documentation.

**Protocol Tables:**
- `agents` - Protocol agents (linked to Solana addresses)
- `beliefs` - Protocol belief markets with BD relevance scores
- `belief_submissions` - User belief submissions and predictions
- `epistemic_weights` - Calculated trust weights per agent
- `belief_aggregates` - Aggregated belief states
- `belief_relevance_history` - Historical BD scores per epoch

**App Tables:**
- `users` - App users (mapped to protocol agents)
- `posts` - User content (all posts require `belief_id`)
- `invite_codes` - Invite code system for controlled onboarding

**Trading Tables:**
- `pool_deployments` - Solana ContentPool tracking (ICBS params, LONG/SHORT mints, sqrt prices)
- `settlements` - Historical pool settlement records from on-chain events
- `trades` - Individual trade history (buy/sell LONG/SHORT tokens with sqrt price tracking)
- `custodian_deposits` / `custodian_withdrawals` - USDC deposit/withdrawal tracking

## Important Implementation Details

### Authentication Flow
- Privy handles all auth (email OTP, Apple Sign In, Solana wallets)
- User onboarding creates both `users` and `agents` records
- Profile photos stored in Supabase Storage bucket `profile-photos`
- Each user gets an embedded Solana wallet for trading

### Trading Architecture
- All pools use ICBS (Informed Constant β-Sum) two-sided markets
- LONG tokens = bullish on content relevance
- SHORT tokens = bearish on content relevance
- Pricing uses sqrt price math (Q64.64 fixed point)
- Real-time event indexing via WebSocket connection to Solana RPC

### Pool Settlement Process
1. Epoch ends and protocol calculates BD relevance scores for all beliefs
2. Each pool settles independently based on its belief's BD score
3. `settle_epoch` instruction scales reserves: accurate side grows, inaccurate side shrinks
4. Settlement events indexed to `settlements` table
5. Token holders gain/lose value proportionally

### Local Development
- Run `scripts/setup-local-test.sh` to set up Solana devnet + Supabase
- Local deployment addresses stored in `.local-deployment.json`
- Test wallets automatically funded with SOL and USDC
- Comprehensive SETUP.md and SETUP-PRIVY.md guides available

## Next Steps

1. **Production Deployment** - Deploy to mainnet with proper authority key management
2. **Analytics Dashboard** - Add pool performance charts, leaderboards, and user stats
3. **Automated Epoch Processing** - Set up cron jobs for epoch transitions and pool settlements
4. **Social Features** - Follow/unfollow, comments, notifications
5. **Content Moderation** - Community reporting and admin moderation tools
6. **Performance Optimization** - Query optimization, caching, bundle size reduction
7. **Mobile App** - Native iOS/Android apps using React Native

---

*Last updated: October 2025*
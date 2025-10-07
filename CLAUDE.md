# Veritas - Intersubjective Social Consensus Platform

## Architecture Overview

Veritas is a consumer web application with three distinct layers:

1. **App Layer** - User-facing content and social features (Supabase + Next.js)
2. **Protocol Layer** - Veritas Protocol for intersubjective social consensus using Bayesian Truth Serum and belief decomposition
3. **Solana Layer** - Smart contracts for speculation on content via bonding curve pools

### How It Works

- Users create posts in the app layer
- Each post gets a Solana bonding curve pool deployed (ContentPool)
- Users can buy tokens to speculate on post relevance/quality
- Every Veritas epoch, the protocol validates pool relevance as an aggregate
- Delta relative relevance is calculated and redistributed between pools
- Losing pools pay winning pools → incentivizes discovery of truthful, high-quality content

## Current Status

✅ **Solana Smart Contracts** - ContentPool, PoolFactory, VeritasCustodian, ProtocolTreasury deployed and tested
✅ **Core Veritas Protocol** - Mirror descent, BTS scoring, stake redistribution implemented
✅ **Privy Auth Integration** - Email, Apple, and Solana wallet authentication
✅ **Database Schema** - Supabase tables for users, posts, beliefs, pool deployments, custodian deposits/withdrawals
⚠️ **Protocol Lifecycle** - Currently iterating on missing pieces of epoch processing and pool redistribution
🚧 **UI** - Not yet built, next priority after protocol completion

## Technical Stack

- **Frontend**: Next.js, React, TailwindCSS, Privy (auth)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Blockchain**: Solana (Anchor framework)
- **Auth**: Privy (NOT Supabase Auth)

## Key Directories

- `/specs` - All specifications
  - `/specs/data-structures` - Database schema documentation
  - `/specs/edge-function-specs` - Edge function specifications
  - `/specs/test-specs` - Test specifications
  - `/specs/solana-specs` - Solana smart contract specs
- `/solana` - Solana smart contracts and transaction builders
  - `/solana/veritas-curation` - Anchor programs
  - `/src/lib/solana` - Transaction building utilities
- `/supabase` - Database migrations and edge functions
- `/src` - Next.js application code

## Development Principles

1. **Make minimal assumptions** - Check variables and validate data at all times
2. **Maintain consistency** - Cross-reference specs when implementing features
3. **Layer separation** - Keep app, protocol, and Solana layers distinct
4. **Test thoroughly** - All specs have corresponding test files in `/specs/test-specs`
5. **Document as you go** - Update specs when implementation changes

## Database Schema (Supabase)

See `/specs/data-structures` for full documentation.

**Key tables:**
- `agents` - Protocol agents (linked to Solana addresses)
- `users` - App users (mapped to protocol agents)
- `beliefs` - Protocol belief markets
- `posts` - User content (all posts require `belief_id`)
- `pool_deployments` - Solana ContentPool tracking
- `custodian_deposits` / `custodian_withdrawals` - USDC deposit/withdrawal tracking

## Next Steps

1. Complete protocol lifecycle implementation (epoch processing, pool redistribution)
2. Build UI for post creation, feed display, and belief submission
3. Implement pool price display and token buying UI
4. Add user profiles and stake balance display

---

*Last updated: October 2025*
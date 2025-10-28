# Data Fetching Architecture

## Single Source of Truth Principle

All data fetching follows environment-aware configuration through `src/lib/solana/network-config.ts`.

## When to Use RPC vs API

### ✅ Use Direct RPC Calls (Client-Side)
**Purpose:** Real-time, user-specific data that requires immediate chain access

1. **Wallet Balances** (SOL, USDC, tokens)
   - Hook: `useWalletBalances` or `useSwapBalances`
   - Why: User-specific, needs to be real-time
   - Location: `src/hooks/useWalletBalances.ts`

2. **Transaction Submission** (Deploy, Trade, Settle, Withdraw, Rebase)
   - Hooks: `useDeployPool`, `useBuyTokens`, `useSellTokens`, etc.
   - Why: Requires direct wallet signing and chain interaction
   - Location: `src/hooks/use*.ts`

### ✅ Use Backend API (No Direct RPC)
**Purpose:** Shared data that benefits from caching and database indexing

1. **Pool Data** (prices, reserves, supplies, state)
   - API: `/api/posts/[id]` returns pool data
   - Why: Shared across users, cached, kept fresh by event indexer
   - Database: `pool_deployments` table

2. **Holdings** (user positions, P&L, balances)
   - API: `/api/users/[username]/holdings`
   - Why: Complex calculations, needs historical data
   - Database: `user_pool_balances`, `trades` tables

3. **Trade History**
   - API: `/api/posts/[id]/trades`
   - Why: Historical data from database
   - Database: `trades` table

4. **Post/Feed Data**
   - API: `/api/posts/*`, `/api/feed`
   - Why: Complex queries, RLS policies, aggregations
   - Database: `posts`, `beliefs` tables

## Environment Configuration

All RPC endpoints are environment-aware:

```typescript
import { getRpcEndpoint, getUsdcMint } from '@/lib/solana/network-config';

// Automatically uses correct endpoint based on NEXT_PUBLIC_SOLANA_NETWORK
const rpcEndpoint = getRpcEndpoint(); // localnet/devnet/mainnet
const usdcMint = getUsdcMint(); // network-specific USDC mint
```

## Migration Path

### Before (❌ Anti-pattern)
```typescript
// ProfilePage.tsx - BAD
const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT, 'confirmed');
const balance = await connection.getBalance(wallet);
```

### After (✅ Best Practice)
```typescript
// ProfilePage.tsx - GOOD
const { sol, usdc, loading } = useWalletBalances(walletAddress);
```

## Key Takeaways

1. **Centralize RPC logic** - Use hooks, don't instantiate `Connection` directly in components
2. **Environment-aware** - Always use `getRpcEndpoint()` and `getUsdcMint()`
3. **API for shared data** - Pool state, trades, posts come from backend
4. **RPC for user data** - Balances and transaction submission need direct chain access

## Updated: January 2025

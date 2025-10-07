# Edge Function Shared Utilities

This directory contains code shared across multiple edge functions.

## Files

### `pool-sync.ts`
Syncs ContentPool data from Solana to database using Anchor IDL deserialization.

**Important:** Uses type-safe Anchor deserialization instead of manual byte slicing.

### `veritas_curation_idl.json`
Anchor IDL (Interface Definition Language) for the Veritas Curation program.

**CRITICAL:** This file must be kept in sync with the deployed Solana program.

**When to update:**
1. After rebuilding the Solana program with `anchor build`
2. After deploying a new program version
3. Whenever ContentPool struct changes

**How to update:**
```bash
# Copy the generated IDL after building
cp solana/veritas-curation/target/idl/veritas_curation.json \
   supabase/functions/_shared/veritas_curation_idl.json

# Or run this from project root
npm run sync-idl  # (if you add this script to package.json)
```

**Why we need this:**
- Prevents hardcoded byte offsets that break silently
- Type-safe deserialization using Anchor
- Automatically adapts to struct layout changes
- Matches on-chain program exactly

**Without this:**
```typescript
// ❌ BAD: Hardcoded offsets break silently
const tokenSupply = deserializeU128(data.slice(56, 72))
const reserve = deserializeU128(data.slice(72, 88))
```

**With IDL:**
```typescript
// ✅ GOOD: Type-safe, adapts to changes
const pool = await program.account.contentPool.fetch(address)
const tokenSupply = pool.tokenSupply
const reserve = pool.reserve
```

## Adding New Shared Utilities

Place reusable code here to avoid duplication across edge functions.

Examples of good shared utilities:
- Database helpers
- Solana connection setup
- Common validation functions
- Type definitions
- IDL imports

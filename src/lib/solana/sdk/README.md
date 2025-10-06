# Veritas Curation SDK

Transaction builders and utilities for integrating Veritas Curation Protocol into your Next.js app.

## Installation

The SDK is part of the Anchor workspace. To use it in your Next.js app:

1. **Build the program first:**

   ```bash
   cd solana/veritas-curation
   anchor build
   ```

2. **Copy the IDL to your Next.js app:**

   ```bash
   cp target/idl/veritas_curation.json ../../src/solana/idl/
   cp target/types/veritas_curation.ts ../../src/solana/types/
   ```

3. **Install dependencies in your Next.js app:**
   ```bash
   cd ../..
   npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
   ```

## Configuration

Add these to your `.env.local`:

```env
# From deployments/program-{network}.json
NEXT_PUBLIC_PROGRAM_ID=GMwWgtvi2USgPa7BeVhDhxGprwpWEAjLm6VTMYHmyxAu

# From deployments/config-{network}.json
NEXT_PUBLIC_CONFIG_PDA=<config_pda>

# From deployments/treasury-{network}.json
NEXT_PUBLIC_TREASURY_PDA=<treasury_pda>

# From deployments/factory-{network}.json
NEXT_PUBLIC_FACTORY_PDA=<factory_pda>

# Network configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com

# USDC Mint (devnet)
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

## Usage

### 1. Initialize a User's Custodian (on signup)

```typescript
import {
  initProgram,
  initializeUserCustodian,
} from "@/solana/sdk/client-example";
import { usePrivy, useSolana } from "@privy-io/react-auth";

const { wallet, sendTransaction } = useSolana();

const tx = await initializeUserCustodian(
  program,
  wallet.publicKey,
  protocolAuthority,
  usdcMint
);

if (tx) {
  const sig = await sendTransaction(tx, connection);
  console.log("Custodian initialized:", sig);
}
```

### 2. Create a Pool (when user creates a post)

```typescript
import { createPoolForPost } from "@/solana/sdk/client-example";

const tx = await createPoolForPost(
  program,
  wallet.publicKey,
  postId, // Your database post ID
  addresses
);

const sig = await sendTransaction(tx, connection);

// Save pool address to your database
const poolPda = derivePoolPda(postId);
await db.posts.update({ id: postId, poolAddress: poolPda });
```

### 3. Buy Tokens (user makes a prediction)

```typescript
import { buyPoolTokens } from "@/solana/sdk/client-example";

const tx = await buyPoolTokens(
  program,
  wallet.publicKey,
  postId,
  10, // 10 USDC
  addresses
);

const sig = await sendTransaction(tx, connection);
```

### 4. Sell Tokens

```typescript
import { sellPoolTokens } from "@/solana/sdk/client-example";

const tx = await sellPoolTokens(
  program,
  wallet.publicKey,
  postId,
  100, // 100 tokens
  addresses
);

const sig = await sendTransaction(tx, connection);
```

## Transaction Builders

### Available Functions

- `buildInitializeCustodianTx()` - Create user custody account
- `buildCreatePoolTx()` - Create new content pool
- `buildBuyTx()` - Buy pool tokens
- `buildSellTx()` - Sell pool tokens
- `buildDepositTx()` - Deposit USDC to custodian
- `buildWithdrawTx()` - Withdraw USDC from custodian

### Helper Functions

- `custodianExists()` - Check if user has custodian
- `poolExists()` - Check if pool exists for post
- `getPoolData()` - Fetch pool state
- `getCustodianData()` - Fetch custodian state

## PDA Helper

Derive program-derived addresses:

```typescript
import { PDAHelper } from "./transaction-builders";

const pdaHelper = new PDAHelper(programId);

const [poolPda, poolBump] = pdaHelper.getPoolPda(postIdBuffer);
const [custodianPda] = pdaHelper.getCustodianPda(userWallet);
```

## Integration Patterns

### Pattern 1: API Routes (Server-side transaction building)

```typescript
// app/api/solana/create-pool/route.ts
export async function POST(req: NextRequest) {
  const tx = await buildCreatePoolTx(...);

  // Serialize for client to sign
  const serialized = tx.serialize({ requireAllSignatures: false });

  return NextResponse.json({
    transaction: serialized.toString("base64")
  });
}
```

### Pattern 2: Client-side (with Privy/Phantom)

```typescript
"use client";

import { usePrivy, useSolana } from "@privy-io/react-auth";

const { wallet, sendTransaction } = useSolana();
const tx = await buildCreatePoolTx(...);
const sig = await sendTransaction(tx, connection);
```

### Pattern 3: Read-only queries

```typescript
import { getPoolData } from "./transaction-builders";

const pool = await getPoolData(program, postIdBuffer);
console.log("Reserve:", pool.reserve.toString());
console.log("Token supply:", pool.tokenSupply.toString());
```

## Error Handling

```typescript
try {
  const tx = await buyPoolTokens(...);
  const sig = await sendTransaction(tx, connection);

  // Wait for confirmation
  await connection.confirmTransaction(sig, "confirmed");

  console.log("Success:", sig);
} catch (error) {
  if (error.message.includes("InsufficientFunds")) {
    // Handle insufficient balance
  } else if (error.message.includes("ReserveCap")) {
    // Handle reserve cap exceeded
  }
}
```

## Best Practices

1. **Always check if accounts exist** before initializing

   ```typescript
   const exists = await custodianExists(program, wallet.publicKey);
   if (!exists) {
     await initializeUserCustodian(...);
   }
   ```

2. **Handle transaction failures gracefully**

   - Show user-friendly error messages
   - Retry with exponential backoff for network errors
   - Log failures for debugging

3. **Update your database atomically**

   ```typescript
   const sig = await sendTransaction(tx, connection);
   await connection.confirmTransaction(sig);

   // Only after confirmation
   await db.updatePostPoolAddress(postId, poolPda);
   ```

4. **Use connection pooling** for better performance
   ```typescript
   const connection = new Connection(rpcUrl, {
     commitment: "confirmed",
     confirmTransactionInitialTimeout: 60000,
   });
   ```

## Troubleshooting

### "Transaction simulation failed"

- Check user has enough SOL for rent
- Verify all accounts are initialized
- Check USDC balance for buy transactions

### "Account already exists"

- User already has a custodian → skip initialization
- Pool already exists → fetch existing pool

### "Custom program error: 0x1771"

- This is `InsufficientFunds` - user needs more USDC

## Support

For issues:

1. Check deployment artifacts in `deployments/`
2. Verify environment variables
3. Test on devnet first
4. Review Anchor program logs

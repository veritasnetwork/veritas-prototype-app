# Phantom Wallet Setup for Veritas Local Testing

## Issue
Your Phantom wallet is currently connected in **Ethereum mode** (address starts with `0x`), but Veritas requires **Solana mode** for transaction signing.

## Steps to Fix

### 1. Switch Phantom to Solana Network
1. Open your Phantom browser extension
2. Click the network selector at the top (currently showing "Ethereum")
3. Select **"Solana"** from the dropdown
4. Your wallet address should now be a Solana address (base58 encoded, NOT starting with `0x`)

### 2. Logout and Reconnect to Privy
1. In your Veritas app (localhost:3000), click logout
2. Click login again
3. When Phantom prompts, make sure it shows your **Solana address**
4. Approve the connection

### 3. Fund Your Phantom Wallet with Test SOL
Once reconnected with Solana wallet:

1. Copy your Solana wallet address from Phantom
2. Run the setup script with your address:
   ```bash
   ./scripts/setup-local-test.sh YOUR_SOLANA_ADDRESS_HERE
   ```

This will:
- Airdrop 100 test SOL to your Phantom wallet
- Deploy the Veritas program to localnet
- Update your .env.local with the correct program ID

### 4. Test Post Creation
1. Make sure Next.js is running: `npm run dev`
2. Click "Create Post" in your app
3. You should see Phantom prompt you to sign a transaction
4. Approve the transaction
5. The post should be created successfully

## Debugging

Check your browser console for these logs:
```
Wallet 0: {
  chainType: 'solana',  // Should be 'solana', not undefined
  address: '<BASE58_ADDRESS>',  // Should NOT start with 0x
  walletClientType: 'privy'
}
```

If `chainType` is still `undefined` but address looks like Solana (no 0x prefix), the transaction signing should still work - the `useSolanaWallet` hook has fallback detection.

## Current Configuration
- ✅ Privy configured for Solana-only external wallets
- ✅ Embedded wallets disabled
- ✅ Transaction signing flow implemented
- ✅ Wallet detection with fallback for undefined chainType

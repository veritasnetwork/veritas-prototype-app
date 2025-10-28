#!/bin/bash

# Fund your wallet with USDC for local testing
# This script:
# 1. Creates USDC token account if needed
# 2. Mints test USDC to your wallet
# 3. You can then deposit to VeritasCustodian through the UI

USDC_MINT="6cfDduf54MDJgeiRafSHeL3UWg4RbJYH5oks6PgKgRDt"
WALLET="5Kp53XUxEUeBAGjbwgR8byf5SGhW82L6S1NWtzYrzwqe"
AMOUNT=${1:-100000}  # Default 100,000 USDC

echo "💰 Funding wallet with USDC..."
echo "   Wallet: $WALLET"
echo "   Amount: $AMOUNT USDC"
echo ""

# Check if token account exists, if not create it
echo "1. Checking for USDC token account..."
TOKEN_ACCOUNT=$(spl-token accounts --owner $WALLET 2>/dev/null | grep "$USDC_MINT" | awk '{print $1}')

if [ -z "$TOKEN_ACCOUNT" ]; then
    echo "   Creating USDC token account..."
    TOKEN_ACCOUNT=$(spl-token create-account $USDC_MINT --owner ~/.config/solana/id.json 2>&1 | grep "Creating account" | awk '{print $3}')
    echo "   ✅ Created: $TOKEN_ACCOUNT"
else
    echo "   ✅ Already exists: $TOKEN_ACCOUNT"
fi

echo ""
echo "2. Minting $AMOUNT USDC to your wallet..."
spl-token mint $USDC_MINT $AMOUNT $TOKEN_ACCOUNT

echo ""
echo "3. Checking balance..."
spl-token balance $USDC_MINT --owner $WALLET

echo ""
echo "✅ Done! Now deposit USDC through the app UI:"
echo "   1. Click your profile/wallet"
echo "   2. Click 'Deposit'"
echo "   3. Enter amount (e.g., 10000)"
echo "   4. Confirm transaction"
echo ""
echo "   Then you can trade!"

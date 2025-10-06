#!/bin/bash

# Setup Local Testing Environment for Veritas
# Usage: ./scripts/setup-local-test.sh [WALLET_ADDRESS]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Veritas Local Testing Environment Setup${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will RESET your local Solana state completely!${NC}"
echo -e "${YELLOW}   - All validators will be killed${NC}"
echo -e "${YELLOW}   - All cached state and build artifacts will be removed${NC}"
echo -e "${YELLOW}   - Contracts will be rebuilt and redeployed${NC}"
echo -e "${YELLOW}   - Existing pool PDAs will be invalid${NC}"
echo ""
echo -e "${YELLOW}💡 This script will automatically reset your database to clear stale pool PDAs${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Setup cancelled${NC}"
    exit 1
fi
echo ""

# Get wallet address from argument or use default keypair
if [ -n "$1" ]; then
    WALLET_ADDRESS="$1"
    echo -e "${GREEN}✅ Using provided wallet address for airdrop: $WALLET_ADDRESS${NC}"
    AIRDROP_TO_PRIVY=true
else
    # Check if default keypair exists
    if [ ! -f ~/.config/solana/id.json ]; then
        echo -e "${YELLOW}🔑 Creating new Solana keypair...${NC}"
        solana-keygen new --no-bip39-passphrase
    fi
    WALLET_ADDRESS=$(solana address)
    echo -e "${GREEN}✅ Using default wallet: $WALLET_ADDRESS${NC}"
    AIRDROP_TO_PRIVY=false
fi

# Kill any existing validators
echo -e "${YELLOW}🧹 Cleaning up existing validators...${NC}"
pkill -9 solana-test-validator 2>/dev/null || true
sleep 2

# Store the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Clean ALL state to avoid stale cache issues
echo -e "${YELLOW}🗑️  Removing all cached state...${NC}"
rm -rf "$ROOT_DIR/test-ledger" 2>/dev/null || true
rm -rf ~/.cache/solana 2>/dev/null || true

# Clean Anchor build artifacts (preserve keypair to avoid ID mismatch)
echo -e "${YELLOW}🗑️  Cleaning Anchor build cache...${NC}"
# Save the program keypair if it exists
if [ -f "$ROOT_DIR/solana/veritas-curation/target/deploy/veritas_curation-keypair.json" ]; then
    cp "$ROOT_DIR/solana/veritas-curation/target/deploy/veritas_curation-keypair.json" /tmp/veritas_curation-keypair.json.bak
fi
rm -rf "$ROOT_DIR/solana/veritas-curation/target" 2>/dev/null || true
rm -rf "$ROOT_DIR/solana/veritas-curation/.anchor" 2>/dev/null || true
# Restore the program keypair
if [ -f /tmp/veritas_curation-keypair.json.bak ]; then
    mkdir -p "$ROOT_DIR/solana/veritas-curation/target/deploy"
    mv /tmp/veritas_curation-keypair.json.bak "$ROOT_DIR/solana/veritas-curation/target/deploy/veritas_curation-keypair.json"
fi

# Set Solana to localhost
echo -e "${YELLOW}📡 Configuring Solana for localhost...${NC}"
solana config set --url http://localhost:8899 > /dev/null

# Navigate to Solana project
cd "$ROOT_DIR/solana/veritas-curation"

# Start validator using Anchor (avoids genesis issues)
echo -e "${YELLOW}🔧 Starting Anchor localnet...${NC}"
export PATH="$HOME/.local/share/solana/install/releases/stable-342b9503bea8248c9ab3facc1fe40624d0e79ed5/solana-release/bin:$PATH"

# Start validator in background
solana-test-validator \
  --ledger test-ledger \
  --rpc-port 8899 \
  --quiet \
  --reset &

VALIDATOR_PID=$!
echo -e "${GREEN}✅ Validator started (PID: $VALIDATOR_PID)${NC}"

# Wait for validator to be ready
echo -e "${YELLOW}⏳ Waiting for validator to be ready...${NC}"
sleep 5

# Check if validator is running
if ! solana cluster-version &>/dev/null; then
    echo -e "${RED}❌ Validator failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Validator is ready!${NC}"

# Airdrop SOL to the wallet
echo -e "${YELLOW}💰 Airdropping 100 SOL to $WALLET_ADDRESS...${NC}"
solana airdrop 100 "$WALLET_ADDRESS" || echo "Airdrop may have failed, checking balance..."
sleep 2

BALANCE=$(solana balance "$WALLET_ADDRESS" 2>/dev/null || echo "0 SOL")
echo -e "${GREEN}✅ Wallet balance: $BALANCE${NC}"

# Build and deploy contracts with clean build
echo -e "${YELLOW}🔨 Building Anchor project (clean build)...${NC}"
cargo clean 2>/dev/null || true
anchor build

# Get program ID from keypair (the source of truth)
PROGRAM_ID=$(solana address -k target/deploy/veritas_curation-keypair.json)
echo -e "${YELLOW}🔄 Syncing program ID in source files...${NC}"
echo -e "${YELLOW}   Program ID: $PROGRAM_ID${NC}"

# Update lib.rs with the correct program ID
sed -i '' "s/declare_id!(\"[^\"]*\")/declare_id!(\"$PROGRAM_ID\")/" programs/veritas-curation/src/lib.rs

# Update Anchor.toml with the correct program ID
sed -i '' "s/veritas_curation = \"[^\"]*\"/veritas_curation = \"$PROGRAM_ID\"/" Anchor.toml

echo -e "${GREEN}✅ Program ID synced in source files${NC}"

# Rebuild with correct program ID
echo -e "${YELLOW}🔨 Rebuilding with synced program ID...${NC}"
anchor build

echo -e "${YELLOW}📦 Deploying contracts...${NC}"
anchor deploy

echo -e "${GREEN}✅ Program deployed!${NC}"
echo -e "${GREEN}   Program ID: $PROGRAM_ID${NC}"

# Create mock USDC token (using original Token Program, not Token-2022)
echo -e "${YELLOW}💰 Creating mock USDC token...${NC}"
USDC_MINT=$(spl-token create-token --decimals 6 --program-id TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA 2>&1 | grep "Creating token" | awk '{print $3}')
echo -e "${GREEN}✅ Mock USDC created: $USDC_MINT${NC}"

# Create token account and mint test USDC to default wallet
echo -e "${YELLOW}💵 Minting test USDC to default wallet...${NC}"
spl-token create-account $USDC_MINT
spl-token mint $USDC_MINT 1000000 $WALLET_ADDRESS
USDC_BALANCE=$(spl-token balance $USDC_MINT 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Minted 1,000 USDC to $WALLET_ADDRESS${NC}"
echo -e "${GREEN}   USDC Balance: $USDC_BALANCE${NC}"

# Initialize protocol config
echo -e "${YELLOW}⚙️  Initializing protocol config...${NC}"
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/2-initialize-config.ts
echo -e "${GREEN}✅ Config initialized!${NC}"

# Initialize protocol factory
echo -e "${YELLOW}🏭 Initializing protocol factory...${NC}"
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/4-initialize-factory.ts
echo -e "${GREEN}✅ Factory initialized!${NC}"

# Note: Pools are created when posts are made via the frontend
echo -e "${YELLOW}📝 Note: Content pools will be created when you create posts in the app${NC}"

# Copy updated IDL to frontend
echo -e "${YELLOW}📄 Copying IDL to frontend...${NC}"
cp target/idl/veritas_curation.json ../../src/lib/solana/target/idl/veritas_curation.json
echo -e "${GREEN}✅ IDL copied!${NC}"

# Update .env.local
cd "$ROOT_DIR"
echo -e "${YELLOW}⚙️  Updating .env.local...${NC}"

# Backup existing .env.local
if [ -f .env.local ]; then
    cp .env.local .env.local.backup
fi

# Update or add Solana config
if grep -q "NEXT_PUBLIC_SOLANA_NETWORK" .env.local 2>/dev/null; then
    # Update existing
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|NEXT_PUBLIC_SOLANA_NETWORK=.*|NEXT_PUBLIC_SOLANA_NETWORK=localnet|" .env.local
        sed -i '' "s|NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=.*|NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899|" .env.local
        sed -i '' "s|NEXT_PUBLIC_VERITAS_PROGRAM_ID=.*|NEXT_PUBLIC_VERITAS_PROGRAM_ID=$PROGRAM_ID|" .env.local
        # Add or update USDC mint
        if grep -q "NEXT_PUBLIC_USDC_MINT_LOCALNET" .env.local 2>/dev/null; then
            sed -i '' "s|NEXT_PUBLIC_USDC_MINT_LOCALNET=.*|NEXT_PUBLIC_USDC_MINT_LOCALNET=$USDC_MINT|" .env.local
        else
            echo "NEXT_PUBLIC_USDC_MINT_LOCALNET=$USDC_MINT" >> .env.local
        fi
    else
        sed -i "s|NEXT_PUBLIC_SOLANA_NETWORK=.*|NEXT_PUBLIC_SOLANA_NETWORK=localnet|" .env.local
        sed -i "s|NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=.*|NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899|" .env.local
        sed -i "s|NEXT_PUBLIC_VERITAS_PROGRAM_ID=.*|NEXT_PUBLIC_VERITAS_PROGRAM_ID=$PROGRAM_ID|" .env.local
        # Add or update USDC mint
        if grep -q "NEXT_PUBLIC_USDC_MINT_LOCALNET" .env.local 2>/dev/null; then
            sed -i "s|NEXT_PUBLIC_USDC_MINT_LOCALNET=.*|NEXT_PUBLIC_USDC_MINT_LOCALNET=$USDC_MINT|" .env.local
        else
            echo "NEXT_PUBLIC_USDC_MINT_LOCALNET=$USDC_MINT" >> .env.local
        fi
    fi
else
    # Add new
    cat >> .env.local << EOF

# Local Solana Testing (auto-generated by setup-local-test.sh)
NEXT_PUBLIC_SOLANA_NETWORK=localnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899
NEXT_PUBLIC_VERITAS_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_USDC_MINT_LOCALNET=$USDC_MINT
EOF
fi

echo -e "${GREEN}✅ Environment configured!${NC}"

# Reset database to clean state (remove old pool PDAs)
echo ""
echo -e "${YELLOW}🗄️  Resetting database to remove stale pool PDAs...${NC}"
npm run reset:posts
echo -e "${GREEN}✅ Database reset complete!${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Your Test Wallet:${NC}"
echo -e "   Address: ${GREEN}$WALLET_ADDRESS${NC}"
echo -e "   SOL Balance: ${GREEN}$BALANCE${NC}"
echo -e "   USDC Balance: ${GREEN}$USDC_BALANCE${NC}"
echo ""
echo -e "${YELLOW}Solana Localnet:${NC}"
echo -e "   RPC: ${GREEN}http://127.0.0.1:8899${NC}"
echo -e "   Program ID: ${GREEN}$PROGRAM_ID${NC}"
echo -e "   USDC Mint: ${GREEN}$USDC_MINT${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "   1. Make sure Supabase is running: ${BLUE}npx supabase status${NC}"
echo -e "   2. Start Next.js dev server: ${BLUE}npm run dev${NC}"
if [ "$AIRDROP_TO_PRIVY" = true ]; then
echo -e "   3. Login with Privy - your wallet ${GREEN}$WALLET_ADDRESS${NC} is funded!"
echo -e "   4. Start buying tokens!"
else
echo -e "   3. Login with Privy, then mint test USDC to your wallet:"
echo -e "      ${BLUE}spl-token create-account $USDC_MINT${NC}"
echo -e "      ${BLUE}spl-token mint $USDC_MINT 1000000 YOUR_WALLET_ADDRESS${NC}"
echo -e "   4. Create a test post and buy some tokens!"
fi
echo ""
echo -e "${YELLOW}To stop the validator:${NC}"
echo -e "   ${BLUE}kill $VALIDATOR_PID${NC}"
echo -e "   or"
echo -e "   ${BLUE}pkill solana-test-validator${NC}"
echo ""
echo -e "${YELLOW}To view validator logs:${NC}"
echo -e "   ${BLUE}solana logs${NC}"
echo ""

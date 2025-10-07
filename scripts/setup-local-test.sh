#!/bin/bash

# Setup Local Testing Environment for Veritas
# Usage: ./scripts/setup-local-test.sh [TEST_WALLET_ADDRESS]
# Example: ./scripts/setup-local-test.sh 7gZWQiUr4bfJMHCSyXGfExQMsjVuy4bgHJowhgxwhkz9

set -e  # Exit on any error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Store the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${BLUE}🚀 Veritas Local Testing Environment Setup${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will RESET your local Solana state completely!${NC}"
echo -e "${YELLOW}   - All validators will be killed${NC}"
echo -e "${YELLOW}   - All cached state and build artifacts will be removed${NC}"
echo -e "${YELLOW}   - Contracts will be rebuilt and redeployed${NC}"
echo -e "${YELLOW}   - Database will be reset${NC}"
echo -e "${YELLOW}   - All existing pool PDAs will be invalid${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Setup cancelled${NC}"
    exit 1
fi
echo ""

# ============================================================================
# STEP 1: CLEANUP & PREREQUISITES
# ============================================================================

echo -e "${BLUE}━━━ STEP 1/7: Cleanup & Prerequisites ━━━${NC}"

# Kill any existing validators
echo -e "${YELLOW}🧹 Killing existing validators...${NC}"
pkill -9 solana-test-validator 2>/dev/null || true
sleep 2

# Clean ALL state to avoid stale cache issues
echo -e "${YELLOW}🗑️  Removing all cached state...${NC}"
rm -rf "$ROOT_DIR/test-ledger" 2>/dev/null || true
rm -rf "$ROOT_DIR/solana/veritas-curation/test-ledger" 2>/dev/null || true
rm -rf ~/.cache/solana 2>/dev/null || true
# Remove macOS metadata files that can corrupt ledger
find "$ROOT_DIR/solana/veritas-curation" -name "._*" -delete 2>/dev/null || true
find ~/.local/share/solana/install -name "._*" -delete 2>/dev/null || true

# Clean Anchor build artifacts (preserve keypair to avoid ID mismatch)
echo -e "${YELLOW}🗑️  Cleaning Anchor build cache...${NC}"
if [ -f "$ROOT_DIR/solana/veritas-curation/target/deploy/veritas_curation-keypair.json" ]; then
    cp "$ROOT_DIR/solana/veritas-curation/target/deploy/veritas_curation-keypair.json" /tmp/veritas_curation-keypair.json.bak
fi
rm -rf "$ROOT_DIR/solana/veritas-curation/target" 2>/dev/null || true
rm -rf "$ROOT_DIR/solana/veritas-curation/.anchor" 2>/dev/null || true
if [ -f /tmp/veritas_curation-keypair.json.bak ]; then
    mkdir -p "$ROOT_DIR/solana/veritas-curation/target/deploy"
    mv /tmp/veritas_curation-keypair.json.bak "$ROOT_DIR/solana/veritas-curation/target/deploy/veritas_curation-keypair.json"
fi

# Check for default keypair
if [ ! -f ~/.config/solana/id.json ]; then
    echo -e "${YELLOW}🔑 Creating new Solana keypair...${NC}"
    solana-keygen new --no-bip39-passphrase --force
fi

DEFAULT_WALLET=$(solana address)
echo -e "${GREEN}✅ Default wallet: $DEFAULT_WALLET${NC}"

# Get test wallet address from argument
TEST_WALLET=""
if [ -n "$1" ]; then
    TEST_WALLET="$1"
    echo -e "${GREEN}✅ Test wallet to fund: $TEST_WALLET${NC}"
fi

echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# ============================================================================
# STEP 2: RESET DATABASE FIRST (before deploying contracts)
# ============================================================================

echo -e "${BLUE}━━━ STEP 2/7: Reset Database ━━━${NC}"

cd "$ROOT_DIR"
echo -e "${YELLOW}🗄️  Resetting database to clean state...${NC}"
npm run reset:posts || {
    echo -e "${RED}❌ Failed to reset database${NC}"
    exit 1
}
echo -e "${GREEN}✅ Database reset complete${NC}"
echo ""

# ============================================================================
# STEP 3: START VALIDATOR
# ============================================================================

echo -e "${BLUE}━━━ STEP 3/7: Start Solana Validator ━━━${NC}"

# Set Solana to localhost
echo -e "${YELLOW}📡 Configuring Solana CLI for localhost...${NC}"
solana config set --url http://localhost:8899 > /dev/null

cd "$ROOT_DIR/solana/veritas-curation"

# Clean macOS metadata one more time right before starting validator
find ~/.local/share/solana -name "._*" -delete 2>/dev/null || true

# Start validator in background
echo -e "${YELLOW}🔧 Starting validator...${NC}"
solana-test-validator \
  --ledger test-ledger \
  --rpc-port 8899 \
  --quiet \
  --reset &

VALIDATOR_PID=$!
echo -e "${GREEN}✅ Validator started (PID: $VALIDATOR_PID)${NC}"

# Wait for validator to be ready (with retries)
echo -e "${YELLOW}⏳ Waiting for validator to be ready...${NC}"
for i in {1..30}; do
    if solana cluster-version &>/dev/null; then
        echo -e "${GREEN}✅ Validator is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Validator failed to start after 30 seconds${NC}"
        kill $VALIDATOR_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo ""

# ============================================================================
# STEP 4: FUND WALLETS WITH SOL
# ============================================================================

echo -e "${BLUE}━━━ STEP 4/7: Fund Wallets with SOL ━━━${NC}"

# Airdrop to default wallet
echo -e "${YELLOW}💰 Airdropping 100 SOL to default wallet...${NC}"
solana airdrop 100 "$DEFAULT_WALLET" || {
    echo -e "${RED}❌ Failed to airdrop to default wallet${NC}"
    exit 1
}
sleep 2

DEFAULT_SOL_BALANCE=$(solana balance "$DEFAULT_WALLET" 2>/dev/null || echo "0 SOL")
echo -e "${GREEN}✅ Default wallet balance: $DEFAULT_SOL_BALANCE${NC}"

# Airdrop to test wallet if provided
if [ -n "$TEST_WALLET" ]; then
    echo -e "${YELLOW}💰 Airdropping 100 SOL to test wallet...${NC}"
    solana airdrop 100 "$TEST_WALLET" || {
        echo -e "${YELLOW}⚠️  Failed to airdrop to test wallet (continuing anyway)${NC}"
    }
    sleep 2
    TEST_SOL_BALANCE=$(solana balance "$TEST_WALLET" 2>/dev/null || echo "0 SOL")
    echo -e "${GREEN}✅ Test wallet balance: $TEST_SOL_BALANCE${NC}"
fi
echo ""

# ============================================================================
# STEP 5: BUILD & DEPLOY SMART CONTRACT
# ============================================================================

echo -e "${BLUE}━━━ STEP 5/7: Build & Deploy Smart Contract ━━━${NC}"

cd "$ROOT_DIR/solana/veritas-curation"

# Get program ID from keypair (preserved from previous runs)
PROGRAM_ID=$(solana address -k target/deploy/veritas_curation-keypair.json)
echo -e "${YELLOW}📋 Program ID from keypair: $PROGRAM_ID${NC}"

# Check if source files need updating
CURRENT_LIB_ID=$(grep 'declare_id!' programs/veritas-curation/src/lib.rs | sed -n 's/.*declare_id!("\([^"]*\)").*/\1/p')
CURRENT_TOML_ID=$(grep 'veritas_curation = ' Anchor.toml | sed -n 's/.*veritas_curation = "\([^"]*\)".*/\1/p')

if [ "$CURRENT_LIB_ID" != "$PROGRAM_ID" ] || [ "$CURRENT_TOML_ID" != "$PROGRAM_ID" ]; then
    echo -e "${YELLOW}🔄 Syncing program ID in source files...${NC}"
    sed -i.bak "s/declare_id!(\"[^\"]*\")/declare_id!(\"$PROGRAM_ID\")/" programs/veritas-curation/src/lib.rs
    rm -f programs/veritas-curation/src/lib.rs.bak
    sed -i.bak "s/veritas_curation = \"[^\"]*\"/veritas_curation = \"$PROGRAM_ID\"/" Anchor.toml
    rm -f Anchor.toml.bak
    echo -e "${GREEN}✅ Program ID synced${NC}"
fi

# Build once (only if needed)
echo -e "${YELLOW}🔨 Building Anchor project...${NC}"
anchor build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

# Deploy
echo -e "${YELLOW}📦 Deploying program...${NC}"
anchor deploy || {
    echo -e "${RED}❌ Deploy failed${NC}"
    exit 1
}

# Verify deployment by checking the program exists on-chain
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
if ! solana account "$PROGRAM_ID" &>/dev/null; then
    echo -e "${RED}❌ Program deployment verification failed - program not found on-chain${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Program deployed and verified!${NC}"
echo -e "${GREEN}   Program ID: $PROGRAM_ID${NC}"
echo ""

# ============================================================================
# STEP 6: CREATE USDC & FUND WALLETS
# ============================================================================

echo -e "${BLUE}━━━ STEP 6/7: Create Mock USDC & Fund Wallets ━━━${NC}"

# Create mock USDC token (using original Token Program, not Token-2022)
echo -e "${YELLOW}💰 Creating mock USDC token...${NC}"
USDC_MINT=$(spl-token create-token --decimals 6 --program-id TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA 2>&1 | grep "Creating token" | awk '{print $3}')

if [ -z "$USDC_MINT" ]; then
    echo -e "${RED}❌ Failed to create USDC mint${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Mock USDC created: $USDC_MINT${NC}"

# Fund default wallet with USDC
echo -e "${YELLOW}💵 Funding default wallet with USDC...${NC}"
DEFAULT_USDC_ACCOUNT=$(spl-token create-account $USDC_MINT 2>&1 | grep "Creating account" | awk '{print $3}')
if [ -z "$DEFAULT_USDC_ACCOUNT" ]; then
    DEFAULT_USDC_ACCOUNT=$(spl-token accounts $USDC_MINT 2>/dev/null | grep -E "^[A-Za-z0-9]{32,}" | head -1 | awk '{print $1}')
fi

if [ -z "$DEFAULT_USDC_ACCOUNT" ]; then
    echo -e "${RED}❌ Failed to create USDC token account for default wallet${NC}"
    exit 1
fi

echo -e "${GREEN}   Token account: $DEFAULT_USDC_ACCOUNT${NC}"
spl-token mint $USDC_MINT 1000000 $DEFAULT_USDC_ACCOUNT || {
    echo -e "${RED}❌ Failed to mint USDC to default wallet${NC}"
    exit 1
}

DEFAULT_USDC_BALANCE=$(spl-token balance $USDC_MINT 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Default wallet funded with 1,000 USDC${NC}"
echo -e "${GREEN}   Balance: $DEFAULT_USDC_BALANCE USDC${NC}"

# Fund test wallet with USDC if provided
if [ -n "$TEST_WALLET" ]; then
    echo -e "${YELLOW}💵 Funding test wallet with USDC...${NC}"
    TEST_USDC_ACCOUNT=$(spl-token create-account $USDC_MINT --owner $TEST_WALLET --fee-payer ~/.config/solana/id.json 2>&1 | grep "Creating account" | awk '{print $3}')

    if [ -z "$TEST_USDC_ACCOUNT" ]; then
        TEST_USDC_ACCOUNT=$(spl-token accounts $USDC_MINT --owner $TEST_WALLET 2>/dev/null | grep -E "^[A-Za-z0-9]{32,}" | head -1 | awk '{print $1}')
    fi

    if [ -n "$TEST_USDC_ACCOUNT" ]; then
        echo -e "${GREEN}   Token account: $TEST_USDC_ACCOUNT${NC}"
        spl-token mint $USDC_MINT 1000000 $TEST_USDC_ACCOUNT || {
            echo -e "${YELLOW}⚠️  Failed to mint USDC to test wallet${NC}"
        }
        TEST_USDC_BALANCE=$(spl-token accounts $USDC_MINT --owner $TEST_WALLET 2>/dev/null | grep "Balance:" | awk '{print $2}')
        echo -e "${GREEN}✅ Test wallet funded with 1,000 USDC${NC}"
        echo -e "${GREEN}   Balance: $TEST_USDC_BALANCE USDC${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not create USDC token account for test wallet${NC}"
    fi
fi
echo ""

# ============================================================================
# STEP 7: INITIALIZE PROTOCOL & UPDATE ENV
# ============================================================================

echo -e "${BLUE}━━━ STEP 7/7: Initialize Protocol & Update Environment ━━━${NC}"

# Initialize protocol config
echo -e "${YELLOW}⚙️  Initializing protocol config...${NC}"
cd "$ROOT_DIR/solana/veritas-curation"
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/2-initialize-config.ts || {
    echo -e "${RED}❌ Failed to initialize config${NC}"
    exit 1
}
echo -e "${GREEN}✅ Config initialized!${NC}"

# Initialize protocol factory
echo -e "${YELLOW}🏭 Initializing protocol factory...${NC}"
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/4-initialize-factory.ts || {
    echo -e "${RED}❌ Failed to initialize factory${NC}"
    exit 1
}
echo -e "${GREEN}✅ Factory initialized!${NC}"

# Copy updated IDL to frontend
echo -e "${YELLOW}📄 Copying IDL to frontend...${NC}"
mkdir -p "$ROOT_DIR/src/lib/solana/target/idl"
cp target/idl/veritas_curation.json "$ROOT_DIR/src/lib/solana/target/idl/veritas_curation.json" || {
    echo -e "${RED}❌ Failed to copy IDL${NC}"
    exit 1
}
echo -e "${GREEN}✅ IDL copied!${NC}"

# Update .env.local
cd "$ROOT_DIR"
echo -e "${YELLOW}⚙️  Updating .env.local...${NC}"

# Backup existing .env.local
if [ -f .env.local ]; then
    cp .env.local .env.local.backup
fi

# Create or update .env.local with all required variables
cat > .env.local.new << EOF
# Local Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=cmfmujde9004yl50ba40keo4a
PRIVY_APP_SECRET=V4TLNZSSPCjuEGMZGweDrdobdMdfXRjjDkNdNtUyebYMpdjkuxnDU8vDDSXf1urp5zpN4gR3yErHKvt9N2qvQPR

# Solana Configuration (auto-generated by setup-local-test.sh)
NEXT_PUBLIC_SOLANA_NETWORK=localnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://127.0.0.1:8899
NEXT_PUBLIC_VERITAS_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_USDC_MINT_LOCALNET=$USDC_MINT
EOF

mv .env.local.new .env.local

# Verify the env file was updated correctly
VERIFY_PROGRAM_ID=$(grep "NEXT_PUBLIC_VERITAS_PROGRAM_ID=" .env.local | cut -d'=' -f2)
VERIFY_USDC_MINT=$(grep "NEXT_PUBLIC_USDC_MINT_LOCALNET=" .env.local | cut -d'=' -f2)

if [ "$VERIFY_PROGRAM_ID" != "$PROGRAM_ID" ]; then
    echo -e "${RED}❌ Failed to update program ID in .env.local${NC}"
    exit 1
fi

if [ "$VERIFY_USDC_MINT" != "$USDC_MINT" ]; then
    echo -e "${RED}❌ Failed to update USDC mint in .env.local${NC}"
    exit 1
fi

echo -e "${GREEN}✅ .env.local updated and verified!${NC}"
echo ""

# ============================================================================
# SETUP COMPLETE
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Summary:${NC}"
echo ""
echo -e "${YELLOW}Solana Localnet:${NC}"
echo -e "   RPC Endpoint: ${GREEN}http://127.0.0.1:8899${NC}"
echo -e "   Program ID: ${GREEN}$PROGRAM_ID${NC}"
echo -e "   USDC Mint: ${GREEN}$USDC_MINT${NC}"
echo -e "   Validator PID: ${GREEN}$VALIDATOR_PID${NC}"
echo ""
echo -e "${YELLOW}Default Wallet (Deploy & Authority):${NC}"
echo -e "   Address: ${GREEN}$DEFAULT_WALLET${NC}"
echo -e "   SOL Balance: ${GREEN}$DEFAULT_SOL_BALANCE${NC}"
echo -e "   USDC Balance: ${GREEN}$DEFAULT_USDC_BALANCE USDC${NC}"
echo ""
if [ -n "$TEST_WALLET" ]; then
echo -e "${YELLOW}Test Wallet (For UI Testing):${NC}"
echo -e "   Address: ${GREEN}$TEST_WALLET${NC}"
echo -e "   SOL Balance: ${GREEN}$TEST_SOL_BALANCE${NC}"
echo -e "   USDC Balance: ${GREEN}$TEST_USDC_BALANCE USDC${NC}"
echo ""
fi
echo -e "${YELLOW}✅ Environment verified:${NC}"
echo -e "   ✓ Database reset"
echo -e "   ✓ Program deployed and on-chain"
echo -e "   ✓ Config initialized"
echo -e "   ✓ Factory initialized"
echo -e "   ✓ .env.local updated and verified"
echo -e "   ✓ Wallets funded with SOL and USDC"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "   1. Ensure Supabase is running: ${BLUE}npx supabase status${NC}"
echo -e "   2. Start Next.js dev server: ${BLUE}npm run dev${NC}"
echo -e "   3. Login with Privy using wallet ${GREEN}$TEST_WALLET${NC}"
echo -e "   4. Create a post and test buying tokens!"
echo ""
echo -e "${YELLOW}Validator Management:${NC}"
echo -e "   Stop validator: ${BLUE}kill $VALIDATOR_PID${NC} or ${BLUE}pkill solana-test-validator${NC}"
echo -e "   View logs: ${BLUE}solana logs${NC}"
echo ""

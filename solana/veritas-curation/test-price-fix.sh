#!/bin/bash
#
# Test Price Fix - Focused test for lambda_q96 price calculation bug
#
# This script runs only the price-related tests to verify the fix:
# - "calculates marginal prices correctly"
# - "maintains price × supply = reserve invariant"
# - "maintains precision in X96 sqrt price calculations"
#

set -e  # Exit on error

# Get script directory and cd to it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Price Calculation Fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment variables
if [ -f .env.local ]; then
  echo "✅ Loading .env.local..."
  source .env.local
else
  echo "⚠️  No .env.local found - using fallback test authority"
fi

# Kill any existing validators
echo "🧹 Cleaning up existing validators..."
pkill -f solana-test-validator 2>/dev/null || true
sleep 2

# Set Solana path (use active release)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Clean old test ledger
rm -rf .anchor/test-ledger 2>/dev/null || true

# Start fresh validator
echo "🚀 Starting fresh test validator..."
solana-test-validator --reset --quiet &
VALIDATOR_PID=$!

# Wait for validator to be ready
echo "⏳ Waiting for validator to be ready..."
sleep 10

# Build the program first
echo "🔨 Building program..."
anchor build

# Run only price-related tests using --grep
echo "🧪 Running price calculation tests..."
echo ""
npx mocha \
  --require @coral-xyz/anchor/mocha \
  --timeout 300000 \
  --grep "price" \
  'tests/**/*.test.ts'

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill validator
echo ""
echo "🧹 Cleaning up validator..."
kill $VALIDATOR_PID 2>/dev/null || true
pkill -f solana-test-validator 2>/dev/null || true

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Price calculation tests PASSED!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Price calculation tests FAILED!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

exit $TEST_EXIT_CODE

#!/bin/bash
#
# Minimal Price Sanity Check
#
# Runs only the single price sanity check test that reproduces the exact bug scenario.
# This is the FASTEST way to verify the price fix works.
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Quick Price Sanity Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment
if [ -f .env.local ]; then
  source .env.local
fi

# Clean up
pkill -f solana-test-validator 2>/dev/null || true
sleep 2
rm -rf .anchor/test-ledger 2>/dev/null || true

# Start validator
echo "🚀 Starting validator..."
solana-test-validator --reset --quiet &
VALIDATOR_PID=$!
sleep 10

# Build
echo "🔨 Building..."
anchor build 2>&1 | grep -E "(Finished|error)" || true

# Run just the sanity check test
echo "🧪 Running sanity check..."
anchor test --skip-local-validator tests/price-sanity-check.test.ts

TEST_EXIT_CODE=$?

# Cleanup
kill $VALIDATOR_PID 2>/dev/null || true
pkill -f solana-test-validator 2>/dev/null || true

exit $TEST_EXIT_CODE

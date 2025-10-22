#!/bin/bash

# Get script directory and cd to it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Kill any existing validators
pkill -f solana-test-validator 2>/dev/null
sleep 2

# Set Solana path (use active release)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Clean old test ledger
rm -rf .anchor/test-ledger 2>/dev/null

# Start fresh validator
echo "Starting fresh test validator..."
solana-test-validator --reset --quiet &
VALIDATOR_PID=$!

# Wait for validator to be ready
echo "Waiting for validator to be ready..."
sleep 10

# Run tests
echo "Running tests with fresh validator..."
anchor test --skip-local-validator

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill validator
echo "Cleaning up validator..."
kill $VALIDATOR_PID 2>/dev/null
pkill -f solana-test-validator 2>/dev/null

exit $TEST_EXIT_CODE
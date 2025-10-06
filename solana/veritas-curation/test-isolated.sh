#!/bin/bash

# Kill any existing validators
pkill -f solana-test-validator 2>/dev/null
sleep 2

# Set Solana path
export PATH="$HOME/.local/share/solana/install/releases/stable-342b9503bea8248c9ab3facc1fe40624d0e79ed5/solana-release/bin:$PATH"

# Start fresh validator
echo "Starting fresh test validator..."
solana-test-validator --reset &
VALIDATOR_PID=$!

# Wait for validator to be ready
sleep 5

# Run tests
echo "Running tests with fresh validator..."
anchor test --skip-local-validator

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill validator
kill $VALIDATOR_PID 2>/dev/null

exit $TEST_EXIT_CODE
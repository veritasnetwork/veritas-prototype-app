#!/bin/bash

# Setup script for Solana testing environment
set -e

echo "Setting up Solana testing environment..."

# Add Solana build tools to PATH
export PATH="$HOME/.local/share/solana/install/releases/stable-342b9503bea8248c9ab3facc1fe40624d0e79ed5/solana-release/bin:$PATH"

echo "✅ Solana build tools added to PATH"
echo "✅ Rust version: $(rustc --version)"
echo "✅ Solana version: $(solana --version)"
echo "✅ Anchor version: $(anchor --version)"
echo "✅ Cargo build-sbf: $(cargo-build-sbf --version)"

# Check if wallet exists
if [ -f ~/.config/solana/id.json ]; then
    echo "✅ Wallet keypair exists"
else
    echo "⚠️  Wallet keypair not found"
fi

# Check Solana config
echo ""
echo "Solana Configuration:"
solana config get

echo ""
echo "Environment ready! You can now run:"
echo "  - anchor build (to build the program)"
echo "  - anchor test  (to run tests)"
echo "  - solana-test-validator (to start local validator)"

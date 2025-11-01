#!/bin/bash

# ===================================================================
# Run Production-like Environment Locally
# ===================================================================
# This script builds and runs the app in production mode locally,
# connecting to your actual production Supabase and Solana mainnet.
# ===================================================================

set -e

echo "🏗️  Building production bundle..."
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "🚀 Starting production server..."
echo "   - Using production Supabase database"
echo "   - Using Solana mainnet"
echo "   - Running at http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

npm start
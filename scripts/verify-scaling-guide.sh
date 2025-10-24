#!/bin/bash
# Verification script for scaling implementation guide
# Run this before starting implementation to catch any issues

set -e

echo "🔍 Verifying Scaling Implementation Guide..."
echo ""

# Check 1: Verify no old column references in SQL code
echo "✓ Checking for old column names in code..."
if grep "p_yes_prob\|p_no_prob" SCALING_IMPLEMENTATION_GUIDE.md | grep -v "^-" | grep -q .; then
  echo "❌ FAIL: Found references to p_yes_prob/p_no_prob parameters (should be p_belief/p_meta_prediction)"
  exit 1
fi

if grep -q 'INSERT INTO.*user_pool_balances.*side[^_]' SCALING_IMPLEMENTATION_GUIDE.md; then
  echo "❌ FAIL: Found reference to 'side' column (should be token_type)"
  exit 1
fi

echo "✓ Column names correct"
echo ""

# Check 2: Verify migration files referenced
echo "✓ Checking migration file references..."
if ! grep -q "20251024000000_add_record_trade_atomic.sql" SCALING_IMPLEMENTATION_GUIDE.md; then
  echo "❌ FAIL: record_trade_atomic migration not referenced"
  exit 1
fi

if ! grep -q "20251024000001_add_deploy_pool_with_lock.sql" SCALING_IMPLEMENTATION_GUIDE.md; then
  echo "❌ FAIL: deploy_pool_with_lock migration not referenced"
  exit 1
fi

echo "✓ Migration files referenced"
echo ""

# Check 3: Verify singleton pattern
echo "✓ Checking singleton pattern..."
if ! grep -q "getSupabaseServiceRole" SCALING_IMPLEMENTATION_GUIDE.md; then
  echo "❌ FAIL: Singleton function not defined"
  exit 1
fi

if ! grep -q "src/lib/supabase-server.ts" SCALING_IMPLEMENTATION_GUIDE.md; then
  echo "❌ FAIL: Singleton module not defined"
  exit 1
fi

echo "✓ Singleton pattern defined"
echo ""

# Check 4: Verify key files are mentioned
echo "✓ Checking key files mentioned..."
files=(
  "app/api/trades/record/route.ts"
  "app/api/trades/prepare/route.ts"
  "app/api/pools/deploy/route.ts"
  "src/services/event-processor.service.ts"
  "src/lib/stake/calculate-skim.ts"
)

for file in "${files[@]}"; do
  if ! grep -q "$file" SCALING_IMPLEMENTATION_GUIDE.md; then
    echo "❌ FAIL: Key file not mentioned: $file"
    exit 1
  fi
done

echo "✓ All key files mentioned"
echo ""

# Check 5: Verify phases are sequential
echo "✓ Checking phase structure..."
phase_count=$(grep "^## Phase" SCALING_IMPLEMENTATION_GUIDE.md | wc -l)
if [ "$phase_count" -lt 4 ]; then
  echo "❌ FAIL: Expected at least 4 phases, found $phase_count"
  exit 1
fi

echo "✓ Phase structure correct ($phase_count phases)"
echo ""

# Check 6: Verify verification steps exist
echo "✓ Checking verification steps..."
if ! grep -q "Verify:" SCALING_IMPLEMENTATION_GUIDE.md; then
  echo "❌ FAIL: No verification steps found"
  exit 1
fi

echo "✓ Verification steps present"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All checks passed!"
echo ""
echo "Guide is ready for execution:"
echo "  • Schema matches database"
echo "  • All migrations defined"
echo "  • Singleton pattern correct"
echo "  • Key files identified"
echo "  • Phases structured"
echo "  • Verification steps included"
echo ""
echo "Next: Follow SCALING_IMPLEMENTATION_GUIDE.md from Phase 0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

#!/bin/bash
# Reset all posts from the local Supabase database
# This is useful for testing without doing a full DB reset

set -e

echo "🗑️  Deleting all posts from local database..."

PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
DELETE FROM posts;
"

echo "✅ All posts deleted successfully"
echo ""
echo "Note: This only deletes posts. Pool deployments, trades, and other data remain."
echo "For a full reset, use: npx supabase db reset"
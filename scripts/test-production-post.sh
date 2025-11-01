#!/bin/bash

# Test if a post exists in production Supabase
# Usage: ./scripts/test-production-post.sh <post-id>

POST_ID="${1}"

if [ -z "$POST_ID" ]; then
  echo "Usage: ./scripts/test-production-post.sh <post-id>"
  exit 1
fi

echo "Testing post $POST_ID on production database..."
echo ""

# Source production env
if [ -f .env.production.local ]; then
  export $(cat .env.production.local | grep -v '^#' | xargs)
fi

# Query Supabase directly
echo "Querying Supabase production database..."
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts?id=eq.${POST_ID}&select=id,user_id,post_type,created_at" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | jq .

echo ""
echo "Testing API route locally (production config)..."
curl -s "http://localhost:3000/api/posts/${POST_ID}" | jq .

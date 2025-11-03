#!/bin/bash

# Load production credentials and run backfill
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)
npx tsx scripts/backfill-media-dimensions.ts

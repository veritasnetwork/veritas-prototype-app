# Veritas Protocol Implementation

## Development Approach
Building the Bayesian Truth Serum protocol function-by-function using a test dashboard to validate each component: belief aggregation, mirror descent, BTS scoring, and stake redistribution.

## Test Dashboard
- **User dropdown** - Select which user to act as (creates protocol agents)
- **Opinion posts** - Create belief markets with duration
- **Belief submission** - Submit beliefs/meta-predictions to any market
- **Epoch controls** - Manual trigger or configurable cron (30s for testing)
- **State monitoring** - View aggregates, entropy, stakes before/after processing

## Implementation Strategy
1. Create Supabase migrations for existing schema specs
2. Build app layer functions (/app/posts/create-with-opinion, /app/posts/submit-opinion)
3. Implement protocol functions one-by-one (/protocol/beliefs/aggregate, mirror-descent, etc.)
4. Test each function through dashboard with real state changes
5. Validate end-to-end epoch processing

Function-by-function development ensures we can test each component in isolation before building the complete system.
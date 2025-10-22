# Belief Decomposition Test Specification

**Implementation:** `/tests/protocol/belief-decomposition.test.ts`
**Purpose:** Validate belief decomposition into common prior, local expectations matrix, and leave-one-out aggregates

## Algorithm Under Test

Decomposes weighted agent beliefs into:
- **Common Prior (π₀)**: Baseline shared knowledge
- **Local Expectations Matrix (W)**: 2×2 row-stochastic matrix mapping world states to signal interpretations
- **Leave-One-Out Aggregates**: Belief/meta aggregates excluding each agent (required for BTS scoring)

**Key Property:** Row-stochastic matrix (rows sum to 1.0)

## Test Coverage

### 1. Core Functionality

| Test | Scenario | Validates |
|------|----------|-----------|
| Diverse Opinions | 4 agents, varied beliefs (0.3-0.8) | All outputs in [0,1], matrix row-stochastic, leave-one-out fields exist |
| Consensus | All beliefs ≈ 0.8 | Low disagreement (<0.1), high certainty (>0.9) |
| Extreme Disagreement | Beliefs {0.1, 0.9} | High disagreement (>0.3), balanced prior (≈0.5) |

### 2. Weight Handling

- **Weighted Decomposition**: Non-uniform weights → aggregate closer to high-weight agents
- **Invalid Weights**: Sum ≠ 1.0 → 422 error

### 3. Leave-One-Out Integration (Critical)

**Test:** Main decomposition output includes `leave_one_out_aggregates` and `leave_one_out_meta_aggregates`

**Validates:**
- Fields exist (required for BTS scoring pipeline)
- Entry for each participating agent
- All values in [0, 1]
- Correct exclusion logic (removing high-belief agent lowers aggregate)

**Why Critical:** Epoch processing passes decomposition output directly to BTS scoring. Missing these fields causes BTS to receive `undefined` → failure.

### 4. Edge Cases

| Test | Input | Expected Behavior |
|------|-------|-------------------|
| Minimum Participants | 1 agent | 409 error (need ≥2) |
| Extreme Values | Beliefs {0.001, 0.999} | No NaN, all finite |
| Identical Beliefs | All 0.6 | Aggregate = 0.6, disagreement = 0, certainty = 1.0 |
| Matrix Validation | Any valid input | Rows sum to 1.0, all entries in [0,1] |

### 5. Separate Endpoints

**Leave-One-Out Endpoint:** `/protocol-beliefs-decompose/leave-one-out`
- Excludes specified agent
- Returns single aggregate (not array)
- Used for individual agent calculations

## Success Criteria

**Must Pass:**
- ✅ All outputs in [0, 1]
- ✅ Matrix is row-stochastic
- ✅ `leave_one_out_aggregates` and `leave_one_out_meta_aggregates` returned
- ✅ Numerical stability (no NaN/Infinity)
- ✅ Input validation (minimum participants, invalid weights)

**Should Pass:**
- ✅ Decomposition quality > 0.5 for well-behaved inputs
- ✅ Consensus → low disagreement, high certainty
- ✅ Disagreement → high disagreement entropy

## Integration Chain

```
protocol-belief-epoch-process
  → protocol-beliefs-decompose/decompose
      Returns: { aggregate, common_prior, matrix,
                 leave_one_out_aggregates ✓,      // NEW
                 leave_one_out_meta_aggregates ✓  // NEW
               }
  → protocol-beliefs-bts-scoring
      Requires: leave_one_out_aggregates[agent_id]
                leave_one_out_meta_aggregates[agent_id]
```

## Running Tests

```bash
deno test tests/protocol/belief-decomposition.test.ts --allow-net --allow-env
deno test --filter "Leave-One-Out Aggregates" --allow-net --allow-env
```

---
**Last Updated:** 2025-01-27

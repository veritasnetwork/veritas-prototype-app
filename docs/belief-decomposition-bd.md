# Belief Decomposition (BD) Aggregation

## Overview

This document describes the Belief Decomposition (BD) aggregation method, implemented in parallel to the existing naive weighted average aggregation.

## Two Aggregation Methods

### 1. Naive Weighted Average (Current Default)
**Function:** `protocol-beliefs-aggregate`

Simple weighted average of agent beliefs:
```
P_aggregate = Σ(w_i × p_i)
```

**Pros:**
- Simple, fast, predictable
- Easy to understand and debug
- No assumptions about agent behavior

**Cons:**
- Ignores information in meta-predictions
- Doesn't account for common priors or informational structure
- Treats all beliefs equally regardless of predictive track record

### 2. Belief Decomposition (BD)
**Function:** `protocol-beliefs-aggregate-bd`

Sophisticated aggregation based on McCoy & Prelec that decomposes beliefs into:
- **Common prior** (p̃): What agents collectively believe before seeing private information
- **Local expectations** (W): How each agent's information updates beliefs
- **Full information posterior**: What we'd believe with all agents' information

**Formula:**
```
f(w=1) ∝ ∏(x_r) / p̃^(n-1)
```

Where:
- `x_r` = each agent's belief
- `p̃` = estimated common prior (from eigenvector of W matrix)
- `W` = local expectations matrix (estimated via ridge regression)

**Pros:**
- Leverages meta-predictions for better aggregation
- Accounts for informational dependencies between agents
- Theoretically optimal under certain conditions
- Can detect and correct for biased priors

**Cons:**
- More complex, harder to debug
- Requires meta-predictions to be meaningful
- May be slower (though optimized for binary case)
- More sensitive to numerical issues

## Binary Optimization

The BD implementation is optimized for binary beliefs (m=2 states).

### Conversion
Binary belief `p` is converted to 2-state distribution:
```
p → [p, 1-p]
```

### Simplifications
For m=2:
- Matrix operations become 2×2 (fast)
- Eigenvalue computation is analytical
- Matrix inversion has closed form
- Ridge regularization parameter: ε = 1e-6

## API Comparison

### Naive Aggregation
```typescript
POST /protocol-beliefs-aggregate
{
  "belief_id": "uuid",
  "weights": {"agent1": 0.5, "agent2": 0.5}
}

Response:
{
  "pre_mirror_descent_aggregate": 0.55,
  "jensen_shannon_disagreement_entropy": 0.12,
  "normalized_disagreement_entropy": 0.12,
  "certainty": 0.88,
  "agent_meta_predictions": {...},
  "active_agent_indicators": [...],
  "leave_one_out_aggregates": {...},
  "leave_one_out_meta_aggregates": {...}
}
```

### BD Aggregation
```typescript
POST /protocol-beliefs-aggregate-bd
{
  "belief_id": "uuid",
  "weights": {"agent1": 0.5, "agent2": 0.5},
  "alpha": 0.5,    // optional, default 0.5
  "lambda": 0.5    // optional, default 0.5
}

Response:
{
  "pre_mirror_descent_aggregate": 0.52,  // Different from naive!
  "jensen_shannon_disagreement_entropy": 0.12,
  "normalized_disagreement_entropy": 0.12,
  "certainty": 0.88,
  "agent_meta_predictions": {...},
  "active_agent_indicators": [...],
  "leave_one_out_aggregates": {...},
  "leave_one_out_meta_aggregates": {...},
  "bd_prior": 0.48  // BD-specific: estimated common prior
}
```

### Additional BD Parameters

- **alpha** (α ∈ [0,1]): Weighting parameter for scoring
  - Higher α gives more weight to belief accuracy vs meta-prediction accuracy
  - Default: 0.5 (equal weight)

- **lambda** (λ ∈ [0,1]): Lambda parameter for consistency scoring
  - Controls importance of self-prediction consistency
  - Default: 0.5

## When to Use Each Method

### Use Naive Aggregation When:
- You want simple, predictable results
- Meta-predictions are not meaningful
- You have very few agents (n < 3)
- You need maximum performance
- Debugging is important

### Use BD Aggregation When:
- Meta-predictions are informative
- You have sufficient agents (n ≥ 3)
- You want theoretically optimal aggregation
- Agent beliefs may have correlated information
- You want to estimate common priors

## Migration Path

### Phase 1: Parallel Testing (Current)
- Both functions available
- Tests compare outputs
- Gather data on differences

### Phase 2: Gradual Adoption
- Use BD for specific belief types
- Fall back to naive if BD fails
- Monitor performance and accuracy

### Phase 3: Full Migration (Future)
- Replace `protocol-beliefs-aggregate` internals with BD
- Keep naive as fallback option
- Update all tests

## Testing

Run tests for both methods:
```bash
# Naive aggregation tests
deno test --allow-net --allow-env tests/protocol/belief-aggregation.test.ts

# BD aggregation tests
deno test --allow-net --allow-env tests/protocol/belief-aggregation-bd.test.ts
```

Compare results:
```bash
# Run comparison test
deno test --allow-net --allow-env tests/protocol/belief-aggregation-bd.test.ts -A "Compare with naive"
```

## Implementation Details

### Ridge Regression
Uses ε = 1e-6 for numerical stability:
```
W = (X^T X - εI)^(-1} X^T Y
```

Note: The paper uses NEGATIVE epsilon (subtracts εI), unlike standard ridge regression.

### Prior Estimation
For 2×2 matrix W = [[a,b], [c,d]], the common prior is:
```
p̃ = c / (c + b)
```

With fallback to uniform (0.5) if denominator near zero.

### Posterior Computation
```
posterior ∝ ∏(beliefs) / prior^(n-1)
```

Clamped to [ε, 1-ε] for numerical stability.

### Leave-One-Out
For each agent i, runs BD on beliefs excluding agent i.
Used for BTS scoring downstream.

## Performance Considerations

### Time Complexity
- **Naive:** O(n) where n = number of agents
- **BD:** O(n²) due to leave-one-out calculations
  - Main BD: O(n) for binary case (2×2 matrices)
  - LOO: O(n) iterations × O(n) per iteration

### Space Complexity
- **Naive:** O(n)
- **BD:** O(n²) for storing LOO results

### Optimization Tips
- For n > 100, consider approximations
- Cache W matrix if re-aggregating
- Use parallel LOO calculations (future)

## References

- McCoy & Prelec: "A Bayesian Approach to the 'Wisdom of Crowds'"
- Original Python implementation (provided)
- Veritas Protocol Specs: `specs/high-level-protocol-specs/04-belief-aggregation.md`

## Future Enhancements

1. **Full multi-state support** (m > 2)
2. **Adaptive epsilon** based on data
3. **Scoring mechanism** using BD scores
4. **Caching** for repeated aggregations
5. **Parallel LOO** computation
6. **Fallback detection** (auto-switch to naive if BD fails)


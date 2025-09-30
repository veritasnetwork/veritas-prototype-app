# Certainty Calculation Implementation

**Endpoint:** `/protocol/beliefs/certainty-calculation`
**Complexity:** O(1)

## Interface

### Input
- `belief_id`: string (required)
- `current_disagreement_entropy`: number ∈ [0, 1]
- `current_aggregate`: number ∈ [0, 1]

### Output
- `certainty`: number ∈ [0, 1]
- `disagreement_entropy`: number ∈ [0, 1] (for reference)

## Algorithm

1. **Validate inputs:**
   - Verify `belief_id` is non-empty
   - Verify entropy ∈ [0,1]
   - Verify aggregate ∈ [0,1]
   - Return error 422/400 if invalid

2. **Retrieve belief state:**
   - Query `beliefs` table by belief_id
   - Return error 404 if not found
   - Verify belief status is "scoring"

3. **Calculate certainty:**
   - certainty = 1 - current_disagreement_entropy
   - Ensure numerical stability

4. **Return:** Certainty metrics (for reference only)

## Protocol Chain Integration

**Note:** Pure calculation function that does not modify any database state. Used for final certainty metrics in single-shot scoring.

## Error Handling

### Input Validation
- Missing belief_id → 422
- Entropy out of range → 400
- Aggregate out of range → 400
- Belief not found → 404
- Invalid belief status → 409

### Numerical Stability
- Handle near-zero entropy values
- Use EPSILON_PROBABILITY for comparisons

## Database Operations
- **beliefs**: READ ONLY (no state changes)

## Constants
- EPSILON_PROBABILITY: 1e-10 (see configuration spec)
# Mirror Descent Test Specification

Test specification for `/protocol/beliefs/mirror-descent` function.

## Critical Properties to Verify

### **P1: Active Agent Immunity**
**Property**: Active agents' beliefs remain unchanged
**Test**: `∀ agent_i ∈ active_agents: belief_i(new) = belief_i(old)`

### **P2: Passive Agent Convergence**
**Property**: Passive agents move toward pre-mirror descent aggregate
**Test**: `∀ agent_i ∈ passive_agents: belief_i(new)` is between `belief_i(old)` and `aggregate`

### **P3: Learning Rate Effect**
**Property**: Higher certainty (learning rate) → stronger convergence
**Test**: Verify proportional relationship between certainty and belief movement

### **P4: Probability Bounds Preservation**
**Property**: All updated beliefs remain in [ε, 1-ε]
**Test**: No belief escapes valid probability range after update

### **P5: Multiplicative Update Formula**
**Property**: Updates follow exact multiplicative weights formula
**Test**: `p_new = numerator/denominator` where numerator and denominator computed correctly

### **P6: Convergence Limits**
**Property**: When certainty → 1, passive beliefs → aggregate
**Property**: When certainty → 0, passive beliefs → unchanged
**Test**: Verify limiting behavior is mathematically correct

## Unit Tests - Basic Update Cases

### **Single Agent Cases**

#### Test 1.1: Single Active Agent
```
Input:
- belief_id: valid belief
- pre_mirror_descent_aggregate: 0.6
- certainty: 0.8
- active_agent_indicators: [agent_1]
- submissions: [{agent_1: belief=0.3}]

Expected:
- updated_beliefs: {agent_1: 0.3}  # unchanged (active)
- post_mirror_descent_aggregate: 0.3  # same as agent's belief
- No database updates (agent was active)
```

#### Test 1.2: Single Passive Agent
```
Input:
- pre_mirror_descent_aggregate: 0.7
- certainty: 0.5
- active_agent_indicators: []  # agent_1 is passive
- submissions: [{agent_1: belief=0.3}]

Expected:
- updated_beliefs: {agent_1: 0.5}  # moved toward aggregate
- Verify exact multiplicative formula application
- Database updated with new belief
```

### **Multiple Agent Cases**

#### Test 2.1: Mixed Active/Passive Agents
```
Setup:
- agent_1: belief=0.2, active
- agent_2: belief=0.8, passive
- aggregate: 0.5, certainty: 0.6

Expected:
- agent_1: belief unchanged (0.2)
- agent_2: belief moves toward 0.5
- Only agent_2's submission updated in database
```

#### Test 2.2: All Active Agents
```
Setup: All agents in active_agent_indicators
Expected:
- No belief updates
- post_aggregate = pre_aggregate (no changes)
- No database writes
```

#### Test 2.3: All Passive Agents
```
Setup: No agents in active_agent_indicators, certainty=0.7
Expected:
- All agents move toward aggregate
- Bulk database update
- Post-aggregate recalculated with new beliefs
```

### **Learning Rate (Certainty) Cases**

#### Test 3.1: Zero Certainty (No Learning)
```
Input: certainty = 0.0
Expected:
- All passive agents' beliefs unchanged
- No database updates
- Post-aggregate = pre-aggregate
```

#### Test 3.2: Maximum Certainty (Full Convergence)
```
Input: certainty = 1.0
Expected:
- All passive agents converge to pre_aggregate exactly
- Strong convergence toward consensus
```

#### Test 3.3: Intermediate Certainty
```
Input: certainty = 0.5
Expected:
- Partial movement toward aggregate
- Verify exact multiplicative formula: p_new = f(p_old, aggregate, 0.5)
```

#### Test 3.4: Near-Boundary Certainty
```
Input: certainty = 1.0 - EPSILON_PROBABILITY
Expected:
- Near-complete convergence
- Numerical stability maintained
```

### **Boundary Value Cases**

#### Test 4.1: Extreme Initial Beliefs
```
Setup:
- Passive agent with belief = 0.0 (minimum)
- Aggregate = 0.5, certainty = 0.8

Expected:
- Belief clamped to ε before calculation
- Update moves away from boundary
- Result properly clamped to [ε, 1-ε]
```

#### Test 4.2: Belief Equals Aggregate
```
Setup:
- Passive agent belief = aggregate = 0.6
- certainty = 0.9

Expected:
- Belief remains unchanged (already at target)
- No numerical instability from self-convergence
```

#### Test 4.3: Aggregate at Boundaries
```
Test with aggregate = ε and aggregate = 1-ε
Expected: Proper convergence behavior, no overflow
```

## Multiplicative Update Formula Tests

### **Mathematical Verification**

#### Test 5.1: Formula Correctness
```
Manual Calculation:
- p_old = 0.3, P_agg = 0.7, α = 0.6
- numerator = p_old^(1-α) × P_agg^α = 0.3^0.4 × 0.7^0.6
- denominator = numerator + (1-p_old)^(1-α) × (1-P_agg)^α
- p_new = numerator / denominator

Expected: Function result matches manual calculation exactly
```

#### Test 5.2: Symmetry Properties
```
Test: If p_old and (1-p_old) swapped, and P_agg and (1-P_agg) swapped
Expected: Result should be (1 - original_result)
```

#### Test 5.3: Boundary Behavior
```
Test: As α → 0, p_new → p_old
Test: As α → 1, p_new → P_agg
Expected: Limiting behavior matches mathematical theory
```

### **Numerical Stability in Formula**

#### Test 5.4: Near-Zero Denominators
```
Setup: Probabilities that make denominator very small
Expected: Fallback to aggregate, no division by zero
```

#### Test 5.5: Extreme Learning Rates
```
Setup: α very close to 0 or 1
Expected: Power calculations don't overflow/underflow
```

#### Test 5.6: Floating Point Precision
```
Setup: Probabilities differing by machine epsilon
Expected: Updates computed accurately despite precision limits
```

## Property-Based Tests

### **Convergence Direction**
```
Generator: Random beliefs, aggregates, and certainties
Property: Passive agents always move toward aggregate
Test: sign(p_new - p_old) = sign(P_agg - p_old) for all passive agents
Iterations: 10000+ random configurations
```

### **Convergence Monotonicity**
```
Property: Higher certainty → stronger convergence
Test: For same initial conditions, certainty_a > certainty_b → |p_new_a - p_old| > |p_new_b - p_old|
```

### **Update Symmetry**
```
Property: Update function is symmetric around 0.5
Test: Verify symmetric behavior for beliefs and aggregates around midpoint
```

### **Idempotency at Convergence**
```
Property: If all beliefs equal aggregate, no updates occur
Test: Verify no changes when system is already converged
```

## Invalid Input Cases

### **Missing Required Fields**

#### Test 6.1: Missing Inputs
```
Input: belief_id = null
Expected: ERROR_MISSING_REQUIRED_FIELDS

Input: pre_mirror_descent_aggregate = null
Expected: ERROR_MISSING_REQUIRED_FIELDS

Input: certainty = null
Expected: ERROR_MISSING_REQUIRED_FIELDS
```

#### Test 6.2: Invalid Value Ranges
```
Input: pre_mirror_descent_aggregate = -0.1
Expected: ERROR_INVALID_INPUT

Input: pre_mirror_descent_aggregate = 1.1
Expected: ERROR_INVALID_INPUT

Input: certainty = -0.1
Expected: ERROR_INVALID_INPUT

Input: certainty = 1.1
Expected: ERROR_INVALID_INPUT
```

#### Test 6.3: No Submissions Found
```
Input: belief_id with no submissions
Expected: ERROR_NOT_FOUND
```

### **Malformed Data**

#### Test 6.4: Invalid Active Agent List
```
Input: active_agent_indicators contains nonexistent agent IDs
Expected: Should handle gracefully (ignore invalid IDs)
```

#### Test 6.5: Corrupted Submission Data
```
Setup: Submissions with null beliefs or invalid values
Expected: ERROR_INVALID_STATE or data validation failure
```

## Database Transaction Tests

### **Atomic Bulk Updates**

#### Test 7.1: Successful Bulk Update
```
Setup: 5 passive agents needing updates
Expected: All submissions updated atomically
```

#### Test 7.2: Partial Update Failure
```
Setup: Database failure after updating 3 of 5 submissions
Expected: Complete rollback, original state restored
```

#### Test 7.3: Concurrent Mirror Descent
```
Setup: Multiple threads running mirror descent on same belief
Expected: Proper serialization, consistent final state
```

#### Test 7.4: Transaction Timeout
```
Setup: Very slow database during bulk update
Expected: Timeout handling, appropriate error response
```

## Performance Tests

### **Scalability Requirements**
```
Test 8.1: 1 agent: < 10ms
Test 8.2: 100 agents: < 100ms
Test 8.3: 1000 agents: < 500ms
Test 8.4: MAX_AGENTS_PER_BELIEF agents: < 2000ms
```

### **Mathematical Computation Performance**
```
Test 8.5: Power calculations don't dominate runtime
Test 8.6: Memory usage scales linearly with agent count
Test 8.7: No performance regression with extreme probability values
```

## Integration Tests

### **Post-Mirror Descent Processing**

#### Test 9.1: Mirror Descent → Aggregation Chain
```
Flow: Run mirror descent → re-run aggregation with updated beliefs
Verify: Post-aggregation produces expected result
```

#### Test 9.2: Belief Update Consistency
```
Flow: Update beliefs → verify all downstream functions see new values
Verify: Database consistency across function calls
```

#### Test 9.3: Active/Passive Agent State
```
Flow: Check agent active status doesn't change during processing
Verify: Active/passive designation preserved
```

### **Cross-Function Data Flow**

#### Test 9.4: Aggregation Output → Mirror Descent Input
```
Verify: Data format compatibility between functions
Verify: No precision loss in data transfer
```

#### Test 9.5: Mirror Descent Output → Learning Assessment Input
```
Verify: Post-aggregation entropy calculation uses updated beliefs
```

## Edge Cases and Error Recovery

### **System Resource Limits**

#### Test 10.1: Memory Exhaustion
```
Setup: Very large number of agents with limited memory
Expected: Graceful degradation or clean failure
```

#### Test 10.2: CPU Timeout
```
Setup: Complex calculations with time limits
Expected: Timeout detection and clean abort
```

### **Database Corruption Scenarios**

#### Test 10.3: Inconsistent Submission State
```
Setup: Some submissions have invalid belief values
Expected: Data validation catches corruption
```

#### Test 10.4: Missing Foreign Key References
```
Setup: Agent IDs in submissions don't exist in agents table
Expected: Referential integrity error handling
```

## Validation Rules

### **Mathematical Correctness**
- All probability calculations verified against manual computation
- Multiplicative update formula implemented exactly as specified
- Convergence behavior matches theoretical predictions
- Numerical stability maintained across all value ranges

### **Database Integrity**
- All belief updates must be atomic
- Original submission metadata (created_at, etc.) preserved
- Only belief values modified during updates
- Transaction rollback leaves database in original state

### **Test Data Quality**
- All test beliefs must have valid submissions
- Active/passive agent designations must be consistent
- All probability values in valid [0,1] range
- No NaN or Infinity values in test inputs

### **Coverage Requirements**
- 100% branch coverage including all error paths
- All mathematical edge cases tested exhaustively
- Every numerical stability safeguard verified
- All database transaction scenarios covered
- Concurrent access patterns tested thoroughly
# BTS Scoring Test Specification

Test specification for `/protocol/beliefs/bts-scoring` function.

## Critical Properties to Verify

### **P1: BTS Score Formula Correctness**
**Property**: `BTS_score = (D_KL(p_i || meta_-i) - D_KL(p_i || belief_-i)) - D_KL(belief_-i || meta_i)`
**Test**: Manual calculation matches function output exactly

### **P2: Information Score Consistency**
**Property**: `information_score = weight × BTS_score` for each agent
**Test**: Verify proportional relationship between weight and information score

### **P3: Winner/Loser Partition Correctness**
**Property**: Winners have `information_score > 0`, losers have `information_score < 0`
**Test**: Partition is exclusive and exhaustive for non-zero scores

### **P4: KL Divergence Bounds**
**Property**: All KL divergences ≥ 0, with D_KL(p||p) = 0
**Test**: Verify KL calculations respect mathematical bounds

### **P5: Leave-One-Out Consistency**
**Property**: Leave-one-out aggregates exclude target agent correctly
**Test**: Verify LOO aggregation matches expected mathematical result

### **P6: Minimum Participants Requirement**
**Property**: BTS scoring requires ≥ MIN_PARTICIPANTS_FOR_SCORING agents
**Test**: Function fails appropriately with insufficient participants

## Unit Tests - Basic Scoring Cases

### **Two Agent Cases**

#### Test 1.1: Simple Two Agent BTS
```
Setup:
- agent_1: belief=0.3, meta=0.4, weight=0.6
- agent_2: belief=0.7, meta=0.6, weight=0.4
- Both active

Manual Calculation for agent_1:
- belief_-1 = 0.7 (only agent_2)
- meta_-1 = 0.6 (only agent_2)
- D_KL1 = D_KL(0.3 || 0.6)
- D_KL2 = D_KL(0.3 || 0.7)
- D_KL3 = D_KL(0.7 || 0.4)
- BTS_1 = (D_KL1 - D_KL2) - D_KL3

Expected:
- BTS scores computed exactly as manual calculation
- Information scores = weight × BTS score
- Winner/loser partition based on information scores
```

#### Test 1.2: Identical Beliefs (No Information)
```
Setup: Both agents have identical beliefs and meta-predictions
Expected:
- All KL divergences = 0
- All BTS scores = 0
- No winners or losers (all neutral)
```

#### Test 1.3: Perfect Meta-Prediction
```
Setup: Agent's meta-prediction exactly matches other's belief
Expected:
- D_KL(belief_-i || meta_i) = 0 for perfect predictor
- Positive contribution to BTS score
```

### **Multi-Agent Cases**

#### Test 2.1: Three Agent Configuration
```
Setup:
- agent_1: belief=0.2, meta=0.5, weight=0.5, active
- agent_2: belief=0.8, meta=0.6, weight=0.3, active  
- agent_3: belief=0.5, meta=0.4, weight=0.2, active

Expected:
- Leave-one-out calculations exclude each agent properly
- BTS scores computed for all three agents
- Information scores reflect both BTS and weights
- Proper winner/loser partitioning
```

#### Test 2.2: Large Agent Pool
```
Setup: 20 agents with diverse beliefs and meta-predictions
Expected:
- All leave-one-out calculations correct
- Performance acceptable (< 1 second)
- No numerical instability with many agents
```

#### Test 2.3: Passive Agents
```
Setup: Mix of active and passive agents
Expected:
- Only active agents get BTS scores
- Passive agents get score = 0
- Information scores only for active agents
```

### **Edge Case Beliefs and Meta-Predictions**

#### Test 3.1: Extreme Beliefs
```
Setup:
- agent_1: belief=0.0, meta=0.5
- agent_2: belief=1.0, meta=0.5

Expected:
- Beliefs clamped to [ε, 1-ε] for KL calculation
- No infinite or NaN KL divergences
- Proper numerical handling
```

#### Test 3.2: Near-Identical Values
```
Setup: Beliefs differing by 1e-10
Expected:
- Very small but finite KL divergences
- No numerical underflow issues
- Stable BTS calculations
```

#### Test 3.3: Boundary Probabilities
```
Setup: Beliefs exactly at EPSILON_PROBABILITY boundaries
Expected:
- Proper clamping behavior
- Consistent KL calculations
```

## KL Divergence Tests

### **Binary KL Divergence Verification**

#### Test 4.1: Known KL Values
```
Manual Calculations:
- D_KL(0.5 || 0.5) = 0.0
- D_KL(0.0 || 0.5) = undefined (but clamped: D_KL(ε || 0.5))
- D_KL(0.9 || 0.1) = large positive value

Expected: Function matches manual calculations
```

#### Test 4.2: KL Divergence Symmetry
```
Test: D_KL(p||q) ≠ D_KL(q||p) in general
Verify: Function computes directional divergence correctly
```

#### Test 4.3: KL Non-Negativity
```
Property: All KL divergences ≥ 0
Test: Verify across all probability pairs in [ε, 1-ε]
```

#### Test 4.4: Numerical Stability in KL
```
Setup: Probabilities near 0, 1, and equal values
Expected:
- log(0) avoided through epsilon clamping
- log(p/q) computed stably when p ≈ q
- No Infinity or NaN results
```

## Leave-One-Out Integration Tests

### **LOO Aggregation Correctness**

#### Test 5.1: LOO Calculation Verification
```
Setup: Known belief/weight configuration
Manual: Calculate leave-one-out aggregates by hand
Expected: Function calls to LOO aggregation match manual results
```

#### Test 5.2: LOO Weight Renormalization
```
Setup: Original weights don't sum to 1.0 after exclusion
Expected: Weights properly renormalized in LOO calculation
```

#### Test 5.3: Single Remaining Agent
```
Setup: Exclude all but one agent
Expected: LOO aggregates equal remaining agent's values
```

#### Test 5.4: No Remaining Agents
```
Setup: Attempt to exclude only agent
Expected: Default LOO values (0.5, 0.5) as specified
```

## Invalid Input Cases

### **Missing Required Data**

#### Test 6.1: Missing Belief ID
```
Input: belief_id = null
Expected: ERROR_MISSING_REQUIRED_FIELDS
```

#### Test 6.2: Invalid Weight Normalization
```
Input: weights don't sum to 1.0
Expected: ERROR_INVALID_INPUT
```

#### Test 6.3: Missing Agent Weights
```
Setup: Active agent not included in weights map
Expected: ERROR_INVALID_STATE
```

#### Test 6.4: No Submissions
```
Input: belief_id with no submissions
Expected: ERROR_NOT_FOUND
```

### **Insufficient Participants**

#### Test 6.5: Single Agent
```
Setup: Only one agent submission
Expected: ERROR_INSUFFICIENT_PARTICIPANTS (need ≥ MIN_PARTICIPANTS_FOR_SCORING)
```

#### Test 6.6: Below Minimum Threshold
```
Setup: Fewer than MIN_PARTICIPANTS_FOR_SCORING agents
Expected: ERROR_INSUFFICIENT_PARTICIPANTS
```

### **Invalid Probability Values**

#### Test 6.7: Corrupted Belief Values
```
Setup: Submission with belief = NaN or Infinity
Expected: Data validation error or ERROR_INVALID_STATE
```

#### Test 6.8: Out-of-Range Meta-Predictions
```
Setup: Meta-prediction < 0 or > 1
Expected: ERROR_INVALID_INPUT
```

## Property-Based Tests

### **BTS Score Properties**
```
Generator: Random beliefs, meta-predictions, and weights
Property: BTS scores finite for all valid probability inputs
Property: Information scores proportional to weights
Iterations: 5000+ random configurations
```

### **Winner/Loser Partitioning**
```
Property: Every agent with non-zero information score appears in exactly one set
Property: sum(positive_info_scores) + sum(negative_info_scores) = sum(info_scores)
Test: Verify partition completeness and exclusivity
```

### **Scoring Symmetry**
```
Test: If two agents swap all values (belief, meta, weight), their scores swap
Property: BTS scoring treats agents symmetrically
```

## Performance Tests

### **Scalability Requirements**
```
Test 7.1: 2 agents (minimum): < 20ms
Test 7.2: 10 agents: < 100ms  
Test 7.3: 100 agents: < 2000ms (O(n²) acceptable)
Test 7.4: MAX_AGENTS_PER_BELIEF agents: < 10000ms
```

### **Memory Usage**
```
Test 7.5: Memory scales as O(n) where n = number of agents
Test 7.6: No memory leaks in repeated scoring calculations
Test 7.7: Efficient storage of intermediate LOO calculations
```

## Integration Tests

### **Cross-Function Coordination**

#### Test 8.1: Aggregation → BTS Scoring Chain
```
Flow: Run aggregation → use meta-predictions in BTS scoring
Verify: Data format compatibility, no precision loss
```

#### Test 8.2: BTS Scoring → Stake Redistribution
```
Flow: BTS scoring → stake redistribution uses winner/loser sets
Verify: Information scores passed correctly downstream
```

#### Test 8.3: Complete Epoch Processing
```
Flow: Full epoch including BTS scoring step
Verify: BTS scoring integrates correctly in epoch chain
```

### **Database Consistency**

#### Test 8.4: Read-Only Operation
```
Verify: BTS scoring makes no database modifications
Verify: Multiple scoring runs produce identical results
```

#### Test 8.5: Concurrent Scoring
```
Setup: Multiple BTS scoring operations on same belief
Expected: Consistent results, no race conditions
```

## Error Recovery Tests

### **Database Issues**

#### Test 9.1: Database Connection Failure
```
Setup: Database unavailable during scoring
Expected: ERROR_DATABASE_TRANSACTION, clean failure
```

#### Test 9.2: Data Corruption
```
Setup: Corrupted submission data (invalid UUIDs, etc.)
Expected: Data validation catches corruption
```

#### Test 9.3: Missing Foreign Keys
```
Setup: Submission references nonexistent agents
Expected: Proper error handling
```

### **Computational Issues**

#### Test 9.4: Floating Point Overflow
```
Setup: Extreme probability values causing overflow
Expected: Graceful handling, no system crash
```

#### Test 9.5: Memory Exhaustion
```
Setup: Very large agent count with limited memory
Expected: Clean failure or successful completion
```

## Validation Rules

### **Mathematical Correctness**
- All KL divergence calculations verified against manual computation
- BTS formula implemented exactly as specified in literature
- Leave-one-out aggregations computed correctly
- Information score calculations proportional to weights

### **Numerical Stability**
- All probability values clamped to [ε, 1-ε] before KL calculation
- No division by zero in any calculation path  
- Floating point comparisons use appropriate epsilon values
- All intermediate results remain finite

### **Data Integrity**
- All test data must have valid UUID references
- All probability values in [0,1] range before clamping
- Weight normalization verified before use
- No NaN or Infinity values in any test inputs

### **Coverage Requirements**
- 100% branch coverage including all error conditions
- All mathematical edge cases tested exhaustively
- Every configuration parameter exercised
- All database access patterns tested
- Concurrent execution scenarios verified
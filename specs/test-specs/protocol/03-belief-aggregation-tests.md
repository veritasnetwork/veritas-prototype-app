# Belief Aggregation Test Specification

Test specification for `/protocol/beliefs/aggregate` and `/protocol/beliefs/leave-one-out-aggregate` functions.

## Core Requirements

### **Main Aggregation** 
- `aggregate = Σ(weight_i × belief_i)` where weights sum to 1.0
- `min(beliefs) ≤ aggregate ≤ max(beliefs)`
- Jensen-Shannon disagreement entropy ≥ 0
- Certainty = 1 - normalized_disagreement_entropy

### **Leave-One-Out Aggregation**
- Calculate aggregate excluding specified agent
- Renormalize remaining weights to sum to 1.0
- Return default (0.5, 0.5) if no remaining agents

## Essential Tests - Main Aggregation

### **Basic Cases**
```
Test 1: Single agent
- Input: 1 agent, weight=1.0, belief=0.7
- Expected: aggregate=0.7, disagreement_entropy=0.0, certainty=1.0

Test 2: Two equal agents
- Input: 2 agents, weights=0.5 each, beliefs=0.3,0.7  
- Expected: aggregate=0.5, disagreement_entropy>0, certainty<1.0

Test 3: Unequal weights
- Input: weights=0.25,0.75, beliefs=0.2,0.8
- Expected: aggregate=0.65 (weighted average)
```

### **Error Cases**
```
Test 4: Weights don't sum to 1.0
- Input: weights that sum to 0.9
- Expected: ERROR_INVALID_INPUT

Test 5: Missing agent weight
- Input: submission from agent not in weights map
- Expected: ERROR_INVALID_STATE

Test 6: No submissions found
- Input: belief_id with no submissions
- Expected: ERROR_NOT_FOUND
```

### **Boundary Cases**
```
Test 7: Extreme beliefs
- Input: beliefs at 0.0 and 1.0
- Expected: Proper epsilon clamping, no infinite entropy

Test 8: Identical beliefs
- Input: All agents have same belief
- Expected: disagreement_entropy=0.0, certainty=1.0
```

## Essential Tests - Leave-One-Out

### **Basic Cases**
```
Test 9: Exclude from two agents
- Input: 2 agents, exclude agent_1
- Expected: Aggregates equal agent_2's values

Test 10: Exclude from many agents
- Input: 5 agents, exclude agent_3
- Expected: Aggregate of remaining 4 with renormalized weights

Test 11: Exclude only agent
- Input: 1 agent total, exclude that agent
- Expected: Default values (0.5, 0.5)
```

### **Error Cases**
```
Test 12: Excluded agent in weights
- Input: exclude_agent_id appears in weights map  
- Expected: ERROR_INVALID_INPUT

Test 13: Weights don't renormalize properly
- Input: Remaining weights sum incorrectly
- Expected: ERROR_INVALID_INPUT
```

## Integration Tests
```
Test 14: Aggregation → Mirror Descent
- Flow: Run aggregation → use results in mirror descent
- Expected: Data format compatibility

Test 15: Weight calculation → Aggregation
- Flow: Calculate weights → use in aggregation
- Expected: Weights properly normalized and applied
```

## Validation Rules
- All aggregates must be within [min(beliefs), max(beliefs)]
- Entropy calculations must be non-negative and finite
- Weight sums must equal 1.0 within EPSILON_PROBABILITY
- Database cleanup after each test
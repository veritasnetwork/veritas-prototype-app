# Epistemic Weights Test Specification

Test specification for `/protocol/weights/calculate` and related functions.

## Core Requirements

### **Weight Normalization**
- `sum(weights) = 1.0` within EPSILON_PROBABILITY tolerance
- Weights are non-negative
- Function handles division by zero (active_belief_count = 0)

## Essential Tests

### **Basic Cases**
```
Test 1: Single agent
- Input: 1 agent with known stake/belief count
- Expected: weight = 1.0

Test 2: Two equal agents  
- Input: Same effective stakes
- Expected: weights = 0.5 each, sum = 1.0

Test 3: Two unequal agents
- Input: Different effective stakes
- Expected: weights proportional to stakes, sum = 1.0
```

### **Error Cases**
```
Test 4: Division by zero
- Input: agent with active_belief_count = 0
- Expected: ERROR_DIVISION_BY_ZERO

Test 5: Missing agent
- Input: nonexistent agent_id
- Expected: ERROR_NOT_FOUND

Test 6: Missing required fields
- Input: belief_id = null or participant_agents = []
- Expected: ERROR_MISSING_REQUIRED_FIELDS
```

### **Edge Cases**
```
Test 7: All zero stakes
- Input: All agents have total_stake = 0
- Expected: Equal weights (1/n each)

Test 8: Very small stakes
- Input: Stakes near EPSILON_STAKES
- Expected: No underflow, valid weights
```

## Validation Rules
- Weights must sum to 1.0 within EPSILON_PROBABILITY
- All weights must be non-negative
- Database cleanup after each test
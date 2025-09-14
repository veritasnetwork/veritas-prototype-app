# Belief Creation Test Specification

Test specification for `/protocol/beliefs/create` and `/protocol/beliefs/submit` functions.

## Core Requirements

### **Belief Creation**
- Generate unique UUID for belief_id
- Calculate expiration_epoch = current_epoch + duration_epochs
- Validate creator has sufficient stake
- Update creator's active_belief_count

### **Belief Submission**
- Handle first submission vs. updates to existing
- Validate probability ranges [0,1]
- Check belief hasn't expired

## Essential Tests - Belief Creation

### **Basic Cases**
```
Test 1: Valid creation
- Input: Valid agent, initial_belief=0.5, duration=10
- Expected: belief_id generated, expiration calculated, agent count incremented

Test 2: Boundary belief values  
- Input: initial_belief = 0.0, 0.5, 1.0
- Expected: All succeed, values preserved exactly

Test 3: Duration bounds
- Input: duration = 1 (min) and 100 (max)
- Expected: Both succeed with correct expiration
```

### **Stake Validation** 
```
Test 4: Sufficient stake
- Input: Agent with effective stake > MIN_STAKE_PER_BELIEF
- Expected: Creation succeeds

Test 5: Insufficient stake
- Input: Agent with effective stake < MIN_STAKE_PER_BELIEF  
- Expected: ERROR_INVALID_INPUT
```

### **Error Cases**
```
Test 6: Missing agent
- Input: nonexistent agent_id
- Expected: ERROR_NOT_FOUND

Test 7: Invalid belief values
- Input: initial_belief = -0.1 or 1.1 or NaN
- Expected: ERROR_INVALID_INPUT

Test 8: Invalid duration
- Input: duration_epochs = 0 or negative or > MAX_DURATION
- Expected: ERROR_INVALID_INPUT
```

## Essential Tests - Belief Submission

### **Basic Cases**
```
Test 9: First submission
- Input: Valid agent, belief, belief_value=0.7, meta=0.6
- Expected: submission created, agent belief count incremented

Test 10: Update submission
- Input: Agent updates existing submission
- Expected: Same submission_id, values updated, count unchanged

Test 11: Boundary values
- Input: belief_value and meta_prediction = 0.0, 0.5, 1.0
- Expected: All accepted and stored exactly
```

### **Error Cases**
```
Test 12: Expired belief
- Input: Submission to belief past expiration_epoch
- Expected: ERROR_INVALID_STATE

Test 13: Invalid probabilities
- Input: belief_value or meta_prediction outside [0,1]
- Expected: ERROR_INVALID_INPUT

Test 14: Missing fields
- Input: Missing agent_id or belief_id
- Expected: ERROR_MISSING_REQUIRED_FIELDS
```

## Database Transaction Tests
```
Test 15: Creation rollback
- Setup: Force database failure after belief creation
- Expected: Complete rollback, no partial state

Test 16: Submission atomicity
- Setup: Database failure during submission update
- Expected: Complete success or complete failure
```

## Integration Tests  
```
Test 17: Creation → Aggregation
- Flow: Create belief → Run aggregation
- Expected: Initial aggregate = creator's belief

Test 18: Submission → Weights
- Flow: Submit belief → Calculate weights
- Expected: Updated belief count affects effective stakes
```

## Validation Rules
- All belief_ids must be unique UUIDs
- Expiration arithmetic must be exact
- Database cleanup after each test
- Agent statistics must be consistent
# Stake Redistribution Test Specification

Test specification for `/protocol/beliefs/stake-redistribution` function.

## Core Requirements

### **Conservation Law**
- `sum(rewards) = sum(slashes)` exactly
- Zero-sum redistribution preserves total system stakes

### **Learning Dependency**
- If learning_occurred = false, no changes
- If learning_occurred = true, redistribute based on economic_learning_rate

### **Submission Cleanup**
- Delete all submissions for belief after redistribution
- Decrement all participants' active_belief_count

## Essential Tests

### **Basic Cases**
```
Test 1: Single winner, single loser
- Setup: 1 winner (+score), 1 loser (-score), learning_occurred=true, rate=0.5
- Expected: Loser loses stake proportionally, winner gains exact same amount

Test 2: No learning event
- Input: learning_occurred = false
- Expected: All stakes unchanged, no submission cleanup

Test 3: Multiple winners and losers
- Setup: 3 winners, 2 losers with various info scores
- Expected: Rewards proportional to positive scores, slashes proportional to negative scores
```

### **Edge Cases**
```
Test 4: Zero learning rate
- Input: learning_occurred=true, economic_learning_rate=0.0
- Expected: No stake changes, but submissions still cleaned up

Test 5: Maximum learning rate  
- Input: economic_learning_rate=1.0
- Expected: Maximum possible redistribution, conservation maintained

Test 6: No winners (only losers)
- Setup: All info scores negative
- Expected: Slashes calculated, but no rewards distributed

Test 7: No losers (only winners)
- Setup: All info scores positive  
- Expected: No slash pool created, no redistributions
```

### **Conservation Tests**
```
Test 8: Exact conservation
- Setup: Any valid redistribution scenario
- Expected: |sum(rewards) - sum(slashes)| ≤ CONSERVATION_TOLERANCE

Test 9: Conservation violation detection
- Setup: Artificially corrupt calculation to violate conservation
- Expected: ERROR_CONSERVATION_VIOLATION, complete rollback
```

### **Error Cases**
```
Test 10: Missing required fields
- Input: belief_id=null or learning_occurred=null
- Expected: ERROR_MISSING_REQUIRED_FIELDS

Test 11: Invalid learning rate
- Input: economic_learning_rate < 0 or > 1
- Expected: ERROR_INVALID_INPUT

Test 12: Missing agent data
- Input: winner_set contains nonexistent agent
- Expected: ERROR_NOT_FOUND
```

### **Submission Cleanup Tests**
```
Test 13: Successful cleanup
- Setup: learning_occurred=true with multiple submissions
- Expected: All submissions deleted, all agent counts decremented

Test 14: Cleanup failure rollback
- Setup: Database failure during submission deletion
- Expected: Complete rollback of stakes and submissions
```

### **Database Transaction Tests**
```
Test 15: Complete transaction success
- Flow: Update stakes → cleanup submissions → commit
- Expected: All changes persisted atomically

Test 16: Mid-transaction failure
- Setup: Failure after stake updates but before cleanup
- Expected: Complete rollback to original state
```

### **Integration Tests**
```
Test 17: BTS scoring → Redistribution
- Flow: BTS scoring produces scores → redistribution uses them
- Expected: Information scores and winner/loser sets used correctly

Test 18: Post-redistribution stakes
- Flow: Redistribution → other functions see updated stakes
- Expected: Stake changes immediately visible to subsequent operations
```

## Validation Rules
- Conservation must hold within CONSERVATION_TOLERANCE
- All stake changes must be atomic
- Submission cleanup must be complete or completely reverted
- Database cleanup after each test
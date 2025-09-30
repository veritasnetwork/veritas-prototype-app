# Epoch Processing Test Specification

Test specification for `/protocol/epochs/process` function implementing the core protocol chain through belief aggregation.

## Core Requirements

### **Protocol Chain Execution**
- Execute: Epistemic Weights → Belief Aggregation for qualifying beliefs
- Skip beliefs with <2 participants (insufficient for aggregation)
- Skip beliefs with no submissions in current epoch
- Process beliefs with ≥2 participants through full mathematical pipeline

### **State Management**
- Increment global epoch: current_epoch → current_epoch + 1
- Delete expired beliefs: `expiration_epoch ≤ current_epoch` → DELETE belief and submissions
- Preserve non-expired active beliefs with all submissions for future epochs
- Maintain data consistency throughout processing

### **Timing Requirements**
- Belief durations must be multiples of 60 seconds (minute-aligned)
- Minimum belief duration: 60 seconds for test scenarios
- Epoch processing triggered at exact minute boundaries
- No sub-minute timing precision required

### **Mathematical Properties**
- Aggregated beliefs ∈ [min(participant_beliefs), max(participant_beliefs)]
- Certainty values ∈ [0, 1] with higher certainty for consensus
- Weight sums = 1.0 within EPSILON_PROBABILITY tolerance
- Jensen-Shannon disagreement entropy ≥ 0

## Essential Tests - Core Functionality

### **Basic Processing**
```
Test 1: Process qualifying belief
- Setup: Create belief with 3 participants, different belief values
- Expected: belief_id in processed_beliefs, aggregate within bounds, weights sum to 1.0

Test 2: Skip insufficient participants
- Setup: Create belief with 1 participant
- Expected: belief_id NOT in processed_beliefs, no errors

Test 3: Skip beliefs with no submissions
- Setup: Create belief but submit no current-epoch submissions
- Expected: belief_id NOT in processed_beliefs, skipped gracefully
```

### **Epoch Management**
```
Test 4: Epoch increment
- Setup: Record initial epoch N
- Expected: response.next_epoch = N+1, global epoch updated to N+1

Test 5: Delete expired beliefs
- Setup: Create belief with expiration_epoch ≤ current_epoch
- Expected: belief_id in expired_beliefs, belief completely deleted from database

Test 6: Preserve active beliefs
- Setup: Create belief with expiration_epoch > current_epoch
- Expected: belief_id NOT in expired_beliefs, belief remains in database
```

### **Mathematical Validation**
```
Test 7: Weight normalization
- Setup: Belief with unequal agent stakes (100, 200, 50)
- Expected: weights reflect stake proportions, sum exactly 1.0

Test 8: Aggregate bounds validation
- Setup: Participants with beliefs [0.2, 0.8, 0.5]
- Expected: 0.2 ≤ aggregate ≤ 0.8

Test 9: Certainty computation
- Setup: Participants with identical beliefs (consensus)
- Expected: certainty close to 1.0
- Setup: Participants with diverse beliefs (disagreement)
- Expected: certainty significantly < 1.0
```

## Essential Tests - Error Handling

### **Function Call Failures**
```
Test 10: Weights calculation failure
- Setup: Mock weights function to return error
- Expected: belief processing fails, error recorded, other beliefs continue

Test 11: Aggregation calculation failure
- Setup: Mock aggregation function to return error
- Expected: belief processing fails, error recorded, other beliefs continue

Test 12: Database transaction failure
- Setup: Force database constraint violation
- Expected: Graceful error handling, partial rollback
```

### **Input Validation**
```
Test 13: Invalid current_epoch input
- Setup: Pass non-integer epoch value
- Expected: Default to system epoch, process normally

Test 14: Empty database state
- Setup: No active beliefs in database
- Expected: processed_beliefs=[], expired_beliefs=[], epoch incremented
```

## Essential Tests - Integration Scenarios

### **Mixed Belief States**
```
Test 15: Complex scenario
- Setup: 5 beliefs with different states:
  - 2 processable (≥2 participants, active)
  - 1 insufficient participants (<2)
  - 1 expired (expiration_epoch ≤ current)
  - 1 no submissions (no current epoch data)
- Expected:
  - 2 in processed_beliefs with valid aggregates
  - 1 in expired_beliefs
  - Appropriate skip behaviors for others

Test 16: Large participant count
- Setup: Belief with 50+ participants
- Expected: Processes successfully, reasonable performance (<5s)
```

### **State Consistency**
```
Test 17: Concurrent processing protection
- Setup: Simulate overlapping epoch processing calls
- Expected: Proper serialization, consistent final state

Test 18: Partial failure recovery
- Setup: Process multiple beliefs, fail on middle belief
- Expected: Successfully processed beliefs remain processed, failed belief logged
```

## Essential Tests - Performance & Scale

### **Resource Management**
```
Test 19: Memory efficiency
- Setup: Process 100+ beliefs with varying participant counts
- Expected: Completes without memory issues, reasonable response time

Test 20: Database load optimization
- Setup: Monitor query count during processing
- Expected: Efficient queries, no N+1 problems
```

## Validation Rules

### **Mathematical Invariants**
- All processed beliefs must have valid aggregates: 0 ≤ aggregate ≤ 1
- All certainty values must satisfy: 0 ≤ certainty ≤ 1
- Weight distributions must sum to 1.0 ± EPSILON_PROBABILITY
- Jensen-Shannon entropy must be non-negative and finite

### **State Consistency**
- Global epoch must increment by exactly 1
- Expired beliefs must transition to status='expired'
- Active belief count must remain accurate
- No data corruption or orphaned records

### **Error Boundaries**
- Individual belief processing failures must not halt entire epoch
- Database constraint violations must trigger appropriate rollbacks
- Function call timeouts must be handled gracefully
- Memory limits must not be exceeded for reasonable workloads

### **Test Environment**
- Each test must create isolated test data
- Tests must not interfere with existing database state
- Cleanup must restore initial state after test completion
- Tests must be repeatable regardless of existing data
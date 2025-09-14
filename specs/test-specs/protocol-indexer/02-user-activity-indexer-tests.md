# User Activity Indexer Tests

Tests for `/protocol-indexer/users/get-activity` endpoint to ensure proper retrieval and enrichment of comprehensive agent activity data.

## Test Categories

### 1. Input Validation Tests
- Parameter validation (agent_ids, limit, offset)
- Array format validation
- Pagination boundary testing

### 2. Data Retrieval Tests
- Single agent activity retrieval
- Multiple agents batch processing
- Empty result handling
- Large dataset pagination

### 3. Stake Calculation Integration
- Real-time stake calculation accuracy
- Batch stake calculation optimization
- Stake calculation failure handling
- Multiple beliefs per agent stake distribution

### 4. Belief Information Enrichment
- Belief metadata accuracy
- Status and expiration validation
- Creator information inclusion
- Aggregate value consistency

### 5. Performance and Optimization Tests
- Response time benchmarks
- Memory usage during large queries
- Concurrent request handling
- Caching effectiveness

## Detailed Test Cases

### Test 1: Single agent comprehensive data
- **Input**: agent_id for active agent with multiple beliefs
- **Expected**: Complete activity profile with all submissions
- **Verify**: All belief participations included with correct stakes

### Test 2: Multiple agents batch query
- **Input**: Array of 5 agent_ids
- **Expected**: All agents returned with individual activity data
- **Verify**: Correct agent count and individual data accuracy

### Test 3: Pagination functionality
- **Input**: limit=3, offset=2 with 10 total agents
- **Expected**: Agents 3-5 returned with total_count=10
- **Verify**: Correct pagination slice and metadata

### Test 4: Agent with no submissions
- **Input**: agent_id for agent with zero belief participations
- **Expected**: Agent profile with empty submissions array
- **Verify**: Agent metadata present, submissions array empty

### Test 5: Stake calculation accuracy
- **Input**: agent with known stake distribution across beliefs
- **Expected**: Correct effective stake per belief calculation
- **Verify**: stake_allocated = total_stake / active_belief_count

### Test 6: Belief information completeness
- **Input**: agent participating in beliefs with various statuses
- **Expected**: Complete belief_info for each participation
- **Verify**: All belief metadata fields present and accurate

### Test 7: Large dataset handling
- **Input**: Query for all agents (no filtering) with high limit
- **Expected**: Efficient processing without timeout
- **Verify**: Response time under acceptable threshold

### Test 8: Invalid agent_ids handling
- **Input**: Mix of valid and invalid agent_ids
- **Expected**: Valid agents returned, invalid ones skipped
- **Verify**: No errors, only valid data included

### Test 9: Concurrent request stress test
- **Input**: Multiple simultaneous requests for different agents
- **Expected**: All requests complete successfully
- **Verify**: No data corruption or race conditions

### Test 10: Empty database scenario
- **Input**: Query when no agents exist
- **Expected**: Empty array with total_count=0
- **Verify**: Graceful handling of empty state

## Test Data Requirements

### Agent Profiles
- **active_alice**: 3 belief participations, high activity
- **passive_bob**: 1 belief participation, low activity
- **inactive_charlie**: Agent with no submissions
- **high_stake_dave**: Agent with maximum stake allocation

### Belief Scenarios
- **active_beliefs**: Various status and expiration combinations
- **mixed_participants**: Beliefs with multiple agent submissions
- **solo_beliefs**: Beliefs with single participant

### System States
- **normal_load**: Standard operation conditions
- **high_load**: Maximum concurrent usage simulation
- **edge_cases**: Boundary conditions and error states

## Performance Benchmarks
- Single agent query: < 100ms
- 10 agent batch query: < 500ms
- Full system query (50 agents): < 1000ms
- Concurrent requests (10x): < 2000ms total

## Success Criteria
- All input validation tests pass
- Data accuracy verified across all scenarios
- Performance benchmarks met consistently
- Error handling graceful and informative
- Pagination and filtering work correctly
- Stake calculations match protocol expectations
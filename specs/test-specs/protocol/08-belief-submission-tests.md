# Belief Submission Tests

Test specification for `/protocol/beliefs/submit` endpoint to ensure proper belief submission handling, validation, and state management.

## Test Categories

### Input Validation
- Required field validation
- Data type validation
- Value range validation
- UUID format validation

### Entity Verification
- Agent existence validation
- Belief existence validation
- Belief status validation
- Belief expiration validation

### Submission Logic
- New submission creation
- Existing submission updates
- Stake allocation validation
- Agent belief count management

### Error Handling
- Missing/invalid inputs → 422/400
- Non-existent entities → 404
- Expired/inactive beliefs → 504
- Insufficient stake → 400
- Database failures → 503

## Detailed Test Cases

### Test 1: Valid new submission
- **Input**: Valid agent_id, belief_id, belief_value=0.7, meta_prediction=0.6
- **Setup**: Agent exists, belief is active and not expired
- **Expected**: 200, submission_id returned, is_first_submission=true
- **Verify**: New record in belief_submissions, agent active_belief_count incremented

### Test 2: Valid submission update
- **Input**: Same parameters as Test 1 (existing submission)
- **Expected**: 200, same submission_id, is_first_submission=false
- **Verify**: Updated belief/meta values, same created_at, new updated_at

### Test 3: Missing required fields
- **Input**: Missing agent_id
- **Expected**: 422, error: "Missing required fields: agent_id, belief_id"

### Test 4: Missing belief_id
- **Input**: Missing belief_id
- **Expected**: 422, error: "Missing required fields: agent_id, belief_id"

### Test 5: Invalid belief_value - below range
- **Input**: belief_value = -0.1
- **Expected**: 400, error: "belief_value must be a number between 0 and 1"

### Test 6: Invalid belief_value - above range
- **Input**: belief_value = 1.1
- **Expected**: 400, error: "belief_value must be a number between 0 and 1"

### Test 7: Invalid meta_prediction - below range
- **Input**: meta_prediction = -0.1
- **Expected**: 400, error: "meta_prediction must be a number between 0 and 1"

### Test 8: Invalid meta_prediction - above range
- **Input**: meta_prediction = 1.1
- **Expected**: 400, error: "meta_prediction must be a number between 0 and 1"

### Test 9: Non-existent agent
- **Input**: agent_id = "00000000-0000-0000-0000-000000000000"
- **Expected**: 404, error: "Agent not found"

### Test 10: Non-existent belief
- **Input**: belief_id = "00000000-0000-0000-0000-000000000000"
- **Expected**: 404, error: "Belief not found"

### Test 11: Inactive belief
- **Input**: Valid inputs, belief.status = "completed"
- **Expected**: 504, error: "Belief is not active"

### Test 12: Expired belief
- **Input**: Valid inputs, current_epoch >= belief.expiration_epoch
- **Expected**: 504, error: "Belief has expired"

### Test 13: Insufficient stake for new submission
- **Input**: Agent with very low total_stake, many active_beliefs
- **Expected**: 400, error includes "Insufficient stake" and projected amounts
- **Verify**: No submission created, agent belief count unchanged

### Test 14: Boundary values
- **Input**: belief_value=0, meta_prediction=1 (valid boundaries)
- **Expected**: 200, successful submission

### Test 15: Boundary values
- **Input**: belief_value=1, meta_prediction=0 (valid boundaries)
- **Expected**: 200, successful submission

### Test 16: Edge case - same values update
- **Input**: Update existing submission with identical values
- **Expected**: 200, successful update, new updated_at timestamp

### Test 17: Multiple agents same belief
- **Input**: Different agent_id, same belief_id
- **Expected**: 200, both submissions exist independently
- **Verify**: Each agent has separate submission record

### Test 18: Agent belief count management
- **Input**: Agent's first submission to any belief
- **Setup**: Agent has active_belief_count = 0
- **Expected**: 200, active_belief_count incremented to 1
- **Verify**: Agent record updated correctly

### Test 19: Agent belief count - existing participation
- **Input**: Agent submits to new belief, already participates in others
- **Setup**: Agent has active_belief_count = 3
- **Expected**: 200, active_belief_count incremented to 4

### Test 20: Stake validation integration
- **Input**: New submission from agent near stake minimum
- **Expected**: Proper validation via protocol-weights-validate-stake-allocation
- **Verify**: Stake validation called with correct parameters

## Test Data Setup

### Agents
- **alice**: total_stake=100, active_belief_count=0
- **bob**: total_stake=50, active_belief_count=2
- **charlie**: total_stake=10, active_belief_count=5 (low effective stake)

### Beliefs
- **active_belief**: status="active", expiration_epoch=10
- **expired_belief**: status="active", expiration_epoch=0 (expired)
- **completed_belief**: status="completed", expiration_epoch=5

### System Config
- **current_epoch**: 5
- **min_stake_per_belief**: 0.5

## Test Environment
- Use test database with clean state for each test
- Mock current_epoch via system_config
- Verify all database state changes
- Test both successful and error scenarios

## Success Criteria
- All input validation tests pass
- Entity verification works correctly
- New submissions create proper records
- Updates modify existing records correctly
- Agent belief counts managed properly
- Stake validation integrated correctly
- Appropriate error codes and messages returned
- Database state remains consistent
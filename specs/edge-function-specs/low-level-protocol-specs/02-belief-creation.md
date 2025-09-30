# Belief Creation & Submission Implementation

## Belief Creation

**Endpoint:** `/protocol/beliefs/create`
**Complexity:** O(1)

### Interface

#### Input
- `agent_id`: string (required)
- `initial_belief`: number ∈ [0,1]
- `duration_epochs`: integer ∈ [MIN_BELIEF_DURATION, MAX_BELIEF_DURATION]

#### Output
- `belief_id`: string
- `initial_aggregate`: number
- `expiration_epoch`: integer

### Algorithm

1. **Validate inputs:**
   - Verify `agent_id` is non-empty
   - Verify initial_belief ∈ [0,1]
   - Verify duration_epochs within configured bounds
   - Return error 422/400 if invalid

2. **Validate stake allocation:**
   - Call `/protocol/weights/validate-stake-allocation` with:
     - `agent_id` = provided
     - `additional_beliefs` = 1
   - Propagate any errors
   - Return error 400 if insufficient stake

3. **BEGIN TRANSACTION**

4. **Get current epoch:**
   - Query `system_config` for "current_epoch" key
   - Default to 0 if not set
   - Verify no overflow: current_epoch + duration < 2^31
   - Return error 502 if overflow risk

5. **Create belief record:**
   - Generate `belief_id` (UUID v4)
   - Calculate expiration_epoch = current_epoch + duration_epochs
   - Insert record:
     - `creator_agent_id` = agent_id
     - `created_epoch` = current_epoch
     - `expiration_epoch` = calculated
     - `previous_aggregate` = initial_belief
     - `previous_disagreement_entropy` = 0.0
     - `status` = "active"
     - `created_at` = current timestamp

6. **Update agent statistics:**
   - Increment agent's `active_belief_count`
   - No maximum limit - only requirement is minimum effective stake

7. **Create initial submission:**
   - Insert creator's submission with:
     - `agent_id` = creator
     - `belief_id` = new belief
     - `belief` = initial_belief
     - `meta_prediction` = initial_belief
     - `epoch` = current_epoch
     - `is_active` = true

8. **COMMIT TRANSACTION**

9. **Return:** Belief identifier and metadata

## Belief Submission

**Endpoint:** `/protocol/beliefs/submit`
**Complexity:** O(1)

### Interface

#### Input
- `agent_id`: string (required)
- `belief_id`: string (required)
- `belief_value`: number ∈ [0,1]
- `meta_prediction`: number ∈ [0,1]

#### Output
- `submission_id`: string
- `current_epoch`: integer
- `is_first_submission`: boolean

### Algorithm

1. **Validate inputs:**
   - Verify `agent_id` and `belief_id` non-empty
   - Verify belief_value ∈ [0,1]
   - Verify meta_prediction ∈ [0,1]
   - Return error 422/400 if invalid

2. **Verify entities exist:**
   - Query `agents` table by agent_id
   - Query `beliefs` table by belief_id
   - Return error 404 if not found

3. **Check belief status:**
   - Verify belief.status = "active"
   - Get current_epoch from system_config
   - Verify current_epoch < expiration_epoch
   - Return error 504 if expired

4. **BEGIN TRANSACTION**

5. **Check existing submission:**
   - Query `belief_submissions` by:
     - `belief_id` = provided
     - `agent_id` = provided
   - Note if first submission

6A. **If existing submission:**
   - Update fields:
     - `belief` = belief_value
     - `meta_prediction` = meta_prediction
     - `epoch` = current_epoch
     - `is_active` = true
     - `updated_at` = current timestamp
   - Preserve original `created_at`
   - Skip to step 7

6B. **If new submission:**
   - Validate stake allocation (call validate-stake-allocation)
   - Generate `submission_id` (UUID v4)
   - Insert record with all fields
   - Increment agent's `active_belief_count`
   - No maximum limit - only requirement is minimum effective stake

7. **COMMIT TRANSACTION**

8. **Return:** Submission details

## Error Handling

### Input Validation
- Missing required fields → 422
- Values out of range → 400
- Entity not found → 404

### State Validation
- Expired belief → 504
- Insufficient stake → 400

### Transaction Management
- Atomic operations
- Rollback on any failure
- Return error 503 on database failure

## Database Operations
- **beliefs**: INSERT new belief
- **belief_submissions**: INSERT/UPDATE submissions
- **agents**: UPDATE active_belief_count
- **system_config**: READ current_epoch
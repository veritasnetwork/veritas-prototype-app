# Epoch Management Implementation

**Endpoint:** `/protocol/epochs/process-all`
**Trigger:** Based on EPOCH_PROCESSING_TRIGGER configuration (cron, manual, etc.)
**Frequency:** Every EPOCH_DURATION_SECONDS (see configuration spec)

## Interface
**Input:**
- `current_epoch`: integer

**Output:**
- `processed_beliefs`: array[string] (belief IDs processed)
- `expired_beliefs`: array[string] (belief IDs that expired and were deleted)
- `next_epoch`: integer

## Algorithm
1. **Increment epoch:**
   - `next_epoch = current_epoch + 1`
   - Update global epoch counter

2. **Get all active beliefs:**
   - `active_beliefs = db.beliefs.where(status='active')`

3. **Check expiration (before processing):**
   - `expired = beliefs.where(expiration_epoch <= current_epoch)`
   - `remaining_beliefs = active_beliefs - expired`

4. **Process remaining beliefs:**
   - For each belief in remaining_beliefs:
     - **BEGIN TRANSACTION** (atomic processing boundary)
     - **Validate belief metadata:**
       - Check required fields: `previous_disagreement_entropy`, `expiration_epoch`, `creator_agent_id`
       - Verify all agent_ids exist in agents table
       - Validate belief values ∈ [0,1] range
     - **Validate minimum participation** (≥2 agents) - skip if insufficient  
     - **Calculate epistemic weights:** `/protocol/weights/calculate`
     - **Execute protocol chain:** weights → `/protocol/beliefs/aggregate` → `/protocol/beliefs/mirror-descent` → `/protocol/beliefs/learning-assessment` → `/protocol/beliefs/bts-scoring` → `/protocol/beliefs/stake-redistribution`
     - **Verify stake conservation:** `abs(total_before - total_after) < 0.001`
     - **COMMIT TRANSACTION** if all steps succeed
     - **ROLLBACK TRANSACTION** if any step fails
     - Track if learning occurred

5. **Handle expired beliefs:**
   - For each belief in expired:
     - **Delete submissions:** `db.belief_submissions.delete(belief_id=belief_id)`
     - **Delete belief:** `db.beliefs.delete(id=belief_id)`
     - **Update counts:** `agent.active_belief_count -= 1` for each participant (via database trigger)
     - No stake redistribution for expired beliefs

6. **Submission status updates (after processing):**
   - ALL submissions for processed beliefs are set to passive: `is_active = false`
   - This happens automatically in learning assessment step
   - Submissions remain in database for historical record
   - Beliefs remain active until expiration_epoch
   - Agents must resubmit in next epoch to participate in scoring

7. **Update global state:**
   - Set global current_epoch = next_epoch
   - Archive processed epoch metrics

8. **Return:** Summary of processed beliefs and expired beliefs

## Error Handling & Validation

### Input Validation
- **Agent existence:** All agent_ids must exist in agents table
- **Valid beliefs:** All belief values must be in [0,1] range
- **Duration limits:** duration_epochs must be within configured bounds
- **Required metadata:** `previous_disagreement_entropy`, `expiration_epoch`, `creator_agent_id` must be present

### Transaction Management
- **Atomic processing:** Each belief processed in separate transaction with full rollback
- **Conservation verification:** `abs(total_before - total_after) < 0.001` after redistribution
- **Partial failure:** If any belief fails processing, log error but continue with others  
- **Global atomicity:** Epoch increment only after all beliefs processed successfully

### Error Codes
- **400:** Invalid input parameters (belief values, agent_ids)
- **404:** Belief/agent not found
- **409:** Insufficient participants for scoring
- **422:** Missing required metadata fields
- **500:** Conservation property violation  
- **503:** Database transaction failure

## Database Updates
- **epochs table:** INSERT epoch summary record (if implemented)
- **beliefs table:** UPDATE processed beliefs with new entropy/aggregate, DELETE expired beliefs
- **belief_submissions table:** UPDATE is_active=false for all processed beliefs, DELETE submissions for expired beliefs
- **agents table:** UPDATE total_stake after redistribution, UPDATE active_belief_count via trigger
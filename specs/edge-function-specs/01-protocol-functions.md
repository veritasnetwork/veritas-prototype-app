# Protocol Edge Functions

Pure protocol operations that know nothing about app concerns. These functions only deal with agents, beliefs, stakes, and protocol mechanics.

## Core Functions

### /protocol/beliefs/create

Creates a new belief market in the protocol.

**Request Parameters:**
- `agent_id`: Protocol agent identifier
- `initial_belief`: Number between 0-1 (probability of "yes")
- `duration_epochs`: How many epochs the belief will last

**Response:**
- `belief_id`: Newly created belief identifier
- `initial_aggregate`: Starting aggregate (equals initial_belief)
- `expiration_epoch`: When the belief market expires

**Process:**
1. Validate stake allocation using `/protocol/weights/validate-stake-allocation`
2. Create belief record with initial state  
3. Return belief market details

### /protocol/beliefs/submit

Submits an agent's belief and meta-prediction to a belief market.

**Request Parameters:**
- `agent_id`: Protocol agent submitting
- `belief_id`: Which belief market
- `belief_value`: Agent's probability assessment (0-1)
- `meta_prediction`: Agent's prediction of average belief (0-1)

**Response:**
- `submission_id`: Unique submission identifier  
- `current_epoch`: Which epoch this was submitted in

**Process:**
1. Validate agent and belief exist
2. Upsert submission (replaces previous if exists)  
3. Update agent's active belief count if first submission

## Protocol Chain Functions

### /protocol/weights/calculate
Calculates normalized epistemic weights for belief participants.
**Input:** `belief_id`, `participant_agents`
**Output:** `weights`, `effective_stakes`

### /protocol/beliefs/aggregate  
Aggregates belief submissions using epistemic weights.
**Input:** `belief_id`, `weights`
**Output:** `pre_mirror_descent_aggregate`, `jensen_shannon_disagreement_entropy`, `certainty`, `agent_meta_predictions`, `active_agent_indicators`

### /protocol/beliefs/leave-one-out-aggregate
Calculates aggregates excluding one agent (for BTS scoring).
**Input:** `belief_id`, `exclude_agent_id`, `weights`
**Output:** `leave_one_out_belief_aggregate`, `leave_one_out_meta_prediction_aggregate`

### /protocol/beliefs/mirror-descent
Updates passive agent beliefs toward aggregate.
**Input:** `belief_id`, `pre_mirror_descent_aggregate`, `certainty`, `active_agent_indicators`
**Output:** `updated_beliefs`, `post_mirror_descent_aggregate`, `post_mirror_descent_disagreement_entropy`

### /protocol/beliefs/learning-assessment
Determines if learning occurred based on entropy reduction.
**Input:** `belief_id`, `post_mirror_descent_disagreement_entropy`
**Output:** `learning_occurred`, `disagreement_entropy_reduction`, `economic_learning_rate`

### /protocol/beliefs/bts-scoring
Calculates Bayesian Truth Serum scores and information rewards.
**Input:** `belief_id`, `agent_meta_predictions`, `active_agent_indicators`, `weights`
**Output:** `bts_signal_quality_scores`, `information_scores`, `winner_set`, `loser_set`

### /protocol/beliefs/stake-redistribution
Redistributes stakes based on information scores and learning.
**Input:** `belief_id`, `effective_stakes`, `learning_occurred`, `economic_learning_rate`, `information_scores`, `winner_set`, `loser_set`
**Output:** `updated_stakes`, `individual_rewards`, `individual_slashes`

## Orchestration Functions

### /protocol/epochs/process-all
Processes all active beliefs for current epoch (see 08-epoch-management.md).
**Input:** `current_epoch`  
**Output:** `processed_beliefs`, `expired_beliefs`, `learned_beliefs`, `next_epoch`


## Agent Management Functions

### /protocol/agents/get
Retrieves agent state information.

**Request Parameters:**
- `agent_id`: Which agent to query

**Response:**
- `total_stake`: Agent's current stake balance
- `active_belief_count`: Number of beliefs participating in
- `effective_stake_per_belief`: Calculated effective stake

## /protocol/beliefs/get

Retrieves belief market state information.

**Request Parameters:**
- `belief_id`: Which belief to query

**Response:**
- `previous_aggregate`: Last epoch's post-MD aggregate
- `previous_disagreement_entropy`: Last epoch's disagreement entropy
- `participant_count`: Number of agents with submissions
- `expiration_epoch`: When market expires
- `creator_agent_id`: Who created the belief
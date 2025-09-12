# Protocol Edge Functions

Pure protocol operations that know nothing about app concerns. These functions only deal with agents, beliefs, stakes, and protocol mechanics.

## /protocol/beliefs/create

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
1. Subtract $5 from agent's total stake
2. Create belief record with initial state
3. Return belief market details

## /protocol/beliefs/submit

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

## /protocol/epochs/process

Processes a complete epoch for a belief market (chain execution).

**Request Parameters:**
- `belief_id`: Which belief to process

**Response:**
- `epoch`: Which epoch was processed
- `learning_occurred`: Boolean indicating if entropy decreased
- `final_aggregate`: Post-mirror descent aggregate
- `redistributions`: Array of stake changes per agent

**Process:**
1. Load belief and all submissions
2. Chain execute: Aggregation → Mirror Descent → Learning Assessment → BTS Scoring → Stake Redistribution
3. Update agent stakes and belief metadata
4. Delete belief and submissions if expired or resolved
5. Return processing results

## /protocol/agents/get

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
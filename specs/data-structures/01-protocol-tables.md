# Protocol Data Structures

Core protocol tables that handle belief market mechanics only.

## beliefs
Tracks active belief markets.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique belief market ID |
| creator_agent_id | agent reference | Agent who created this belief |
| created_at | timestamp | When belief was created |
| created_epoch | integer | Epoch number at creation |
| expiration_epoch | integer | When belief market expires |
| previous_aggregate | decimal (0-1) | Post-mirror descent aggregate from last epoch (initial belief at creation) |
| previous_disagreement_entropy | decimal | Post-mirror descent disagreement entropy from last epoch |
| status | string | Market state: "active", "expired" |

## agents
Generic agents in the protocol (not users).

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique agent ID |
| total_stake | decimal | Total stake across all markets (default $100) |
| active_belief_count | integer | Number of beliefs currently participating in |
| created_at | timestamp | When agent was created |

## belief_submissions
Active submissions awaiting scoring.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique submission ID |
| belief_id | belief reference | Which belief market this is for |
| agent_id | agent reference | Agent making the submission |
| epoch | integer | Epoch when this belief was submitted |
| belief | decimal (0-1) | Agent's probability assessment (p) |
| meta_prediction | decimal (0-1) | Agent's prediction of average belief (m) |
| is_active | boolean | Whether agent was active (true) or passive (false) this epoch |
| created_at | timestamp | When submission was first created |
| updated_at | timestamp | When submission was last modified |

**Constraints:**
- One submission per agent per belief
- Effective stake calculated at scoring time using stake scaling rules

## system_config
Global system configuration and state.

| Field | Type | Description |
|-------|------|-------------|
| key | text | Configuration key (primary key) |
| value | text | Configuration value |
| updated_at | timestamp | When this config was last updated |

**Initial Values:**
- `current_epoch`: "0" - Global epoch counter for protocol processing
- `epoch_duration_seconds`: "3600" - Duration of each epoch (1 hour default, 30s for testing)
- `epoch_processing_enabled`: "false" - Whether automatic epoch processing is running
- `epoch_processing_trigger`: "cron" - How epochs are triggered ("cron", "manual", "event-driven")
- `min_participants_for_scoring`: "2" - Minimum participants required for BTS scoring
- `min_stake_per_belief`: "0.5" - Minimum stake allocated per belief (USD)
- `initial_agent_stake`: "100.0" - Default stake amount for new agents

**Usage:**
- Read current epoch: `SELECT value FROM system_config WHERE key = 'current_epoch'`
- Increment epoch: `UPDATE system_config SET value = $1, updated_at = NOW() WHERE key = 'current_epoch'`



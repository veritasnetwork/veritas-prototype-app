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
| delta_relevance | decimal | Change in aggregate belief from previous epoch (used for pool redistribution) |
| certainty | decimal (0-1) | Certainty metric from learning assessment (NOT uncertainty) |

## agents
Generic agents in the protocol (not users).

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique agent ID |
| solana_address | text (unique) | User's Solana wallet address (nullable for migration) |
| total_stake | decimal | Total stake across all markets (default $0, synced from Solana custodian) |
| total_deposited | decimal | Total USDC deposited into custodian (all time) |
| total_withdrawn | decimal | Total USDC withdrawn from custodian (all time) |
| active_belief_count | integer | Number of beliefs currently participating in |
| last_synced_at | timestamp | Last time total_stake was synced from on-chain custodian |
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
| description | text | Human-readable description of config parameter |
| created_at | timestamp | When this config was first created |
| updated_at | timestamp | When this config was last updated |

**Protocol Configuration:**
- `current_epoch`: "0" - Global epoch counter for protocol processing
- `epoch_duration_seconds`: "3600" - Duration of each epoch (1 hour default, 30s for testing)
- `epoch_processing_enabled`: "false" - Whether automatic epoch processing is running
- `epoch_processing_trigger`: "cron" - How epochs are triggered ("cron", "manual", "event-driven")
- `epoch_start_time`: ISO timestamp - When first epoch started
- `epoch_next_target_time`: ISO timestamp - Next scheduled epoch time
- `min_participants_for_scoring`: "2" - Minimum participants required for BTS scoring
- `min_stake_per_belief`: "0.5" - Minimum stake allocated per belief (USD)
- `initial_agent_stake`: "100.0" - Default stake amount for new agents
- `min_belief_duration`: "5" - Minimum belief market duration in epochs
- `max_belief_duration`: "100" - Maximum belief market duration in epochs
- `max_beliefs_per_agent`: "1000" - Maximum beliefs per agent
- `max_agents_per_belief`: "10000" - Maximum agents per belief market

**Solana Pool Configuration:**
- `base_skim_rate`: "0.01" - Base penalty rate for pools with zero delta_relevance (1% = 0.01)
- `epoch_rollover_balance`: "0" - Accumulated penalty pot from epochs with no winning pools

**Usage:**
- Read current epoch: `SELECT value FROM system_config WHERE key = 'current_epoch'`
- Increment epoch: `UPDATE system_config SET value = $1, updated_at = NOW() WHERE key = 'current_epoch'`
- List all configs: `SELECT key, value, description FROM system_config ORDER BY key`

## pool_deployments
Tracks ContentPool deployments on Solana for each belief/post.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique deployment ID |
| post_id | post reference | Associated post (CASCADE delete) |
| belief_id | belief reference | Associated belief market (CASCADE delete, unique) |
| pool_address | text (unique) | Solana address of the ContentPool program account |
| usdc_vault_address | text | SPL token account holding USDC reserves for this pool |
| token_mint_address | text | SPL token mint created for this pool's tokens |
| deployed_at | timestamp | When pool was deployed |
| deployed_by_agent_id | agent reference | Agent who deployed this pool |
| deployment_tx_signature | text (unique) | Solana transaction signature of deployment |
| k_quadratic | decimal | Bonding curve quadratic coefficient |
| token_supply | decimal | Current token supply (synced from chain) |
| reserve | decimal | Current USDC reserve balance in micro-USDC (6 decimals, synced from chain) |
| last_synced_at | timestamp | Last time pool state was synced from chain |

**Notes:**
- Each belief has exactly one pool deployment (unique constraint on belief_id)
- `reserve` matches the on-chain `ContentPool.reserve` field name
- Token supply and reserve are periodically synced from Solana via edge functions

## custodian_deposits
Event log for USDC deposits into VeritasCustodian contracts (indexed via webhook).

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique deposit event ID |
| depositor_address | text | Solana wallet address that made the deposit |
| amount_usdc | decimal | Amount of USDC deposited |
| tx_signature | text (unique) | Solana transaction signature |
| block_time | timestamp | Blockchain timestamp of transaction |
| slot | bigint | Solana slot number |
| indexed_at | timestamp | When this event was indexed into our database |
| agent_credited | boolean | Whether agent's balance has been credited |
| credited_at | timestamp | When agent was credited |
| agent_id | agent reference | Agent associated with depositor (nullable, SET NULL on delete) |

**Indexes:**
- depositor_address (for lookup by wallet)
- agent_credited (partial index for pending deposits)
- block_time (for chronological queries)

## custodian_withdrawals
Withdrawal requests and execution status.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique withdrawal request ID |
| agent_id | agent reference | Agent requesting withdrawal (CASCADE delete) |
| amount_usdc | decimal | Amount of USDC to withdraw |
| recipient_address | text | Solana wallet address to receive funds |
| requested_at | timestamp | When withdrawal was requested |
| requested_by_user_id | user reference | User who initiated request |
| status | text | Status: "pending", "approved", "rejected", "completed", "failed" |
| tx_signature | text (unique) | Solana transaction signature (when executed) |
| processed_at | timestamp | When withdrawal was processed |
| block_time | timestamp | Blockchain timestamp (when executed) |
| rejection_reason | text | Reason if rejected |
| failure_reason | text | Reason if execution failed |

**Indexes:**
- agent_id (for user's withdrawal history)
- status (for admin queue processing)
- requested_at (chronological ordering)



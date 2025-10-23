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
| previous_aggregate | decimal (0-1) | Absolute BD relevance score from last epoch (initial belief at creation) |
| previous_disagreement_entropy | decimal | Disagreement entropy from last epoch |
| status | string | Market state: "active", "expired" |
| certainty | decimal (0-1) | Certainty metric (NOT uncertainty) |

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
- `base_skim_rate`: "0.01" - Base penalty rate for pools (1% = 0.01)
- `epoch_rollover_balance`: "0" - Accumulated penalty pot from epochs with no winning pools

**Usage:**
- Read current epoch: `SELECT value FROM system_config WHERE key = 'current_epoch'`
- Increment epoch: `UPDATE system_config SET value = $1, updated_at = NOW() WHERE key = 'current_epoch'`
- List all configs: `SELECT key, value, description FROM system_config ORDER BY key`

## pool_deployments
Tracks ContentPool deployments on Solana for each belief/post. Uses ICBS (Interleaved Constant-Balance Shares) two-sided market model.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique deployment ID |
| post_id | post reference | Associated post (CASCADE delete) |
| belief_id | belief reference | Associated belief market (CASCADE delete, unique) |
| pool_address | text (unique) | Solana address of the ContentPool program account |
| usdc_vault_address | text | SPL token account holding USDC reserves for this pool |
| long_mint_address | text | SPL token mint for LONG tokens (belief will be true) |
| short_mint_address | text | SPL token mint for SHORT tokens (belief will be false) |
| deployed_at | timestamp | When pool was created (empty pool) |
| deployed_by_agent_id | agent reference | Agent who deployed this pool |
| deployment_tx_signature | text (unique) | Solana transaction signature of pool creation |
| market_deployed_at | timestamp | When market was deployed (initial liquidity added) |
| market_deployment_tx_signature | text | Transaction signature of market deployment |
| f | integer | ICBS growth exponent (default: 1) |
| beta_num | integer | ICBS β numerator (default: 1) |
| beta_den | integer | ICBS β denominator (default: 2, so β = 0.5) |
| sqrt_lambda_long_x96 | text | ICBS λ parameter for LONG side in X96 fixed-point format |
| sqrt_lambda_short_x96 | text | ICBS λ parameter for SHORT side in X96 fixed-point format |
| initial_usdc | numeric | Initial USDC deposited (micro-USDC) |
| initial_long_allocation | numeric | Initial LONG reserve allocation (micro-USDC) |
| initial_short_allocation | numeric | Initial SHORT reserve allocation (micro-USDC) |
| s_long_supply | numeric | Current LONG token supply (synced from chain, atomic units) |
| s_short_supply | numeric | Current SHORT token supply (synced from chain, atomic units) |
| r_long | numeric | Virtual reserve for LONG side: R_L = s_L × p_L (cached from on-chain) |
| r_short | numeric | Virtual reserve for SHORT side: R_S = s_S × p_S (cached from on-chain) |
| vault_balance | numeric | Total USDC in vault (synced from chain, micro-USDC) |
| sqrt_price_long_x96 | text | Current LONG sqrt price in X96 format |
| sqrt_price_short_x96 | text | Current SHORT sqrt price in X96 format |
| status | text | Status: 'pool_created', 'market_deployed', or 'failed' |
| last_synced_at | timestamp | Last time pool state was synced from chain |
| last_settlement_epoch | integer | Most recent epoch this pool was settled |
| last_settlement_tx | text | Transaction signature of most recent settlement |

**ICBS Model Notes:**
- Two-sided market with separate LONG and SHORT mints
- LONG tokens represent belief that post is relevant/true
- SHORT tokens represent belief that post is irrelevant/false
- Growth exponent `f` controls price sensitivity (default: 1, changed from 3→2→1 to avoid overflow)
- Beta parameter controls liquidity allocation: β = beta_num / beta_den = 1/2 = 0.5
- `s_long_supply` and `s_short_supply` are token supplies, NOT reserves
- `r_long` and `r_short` are virtual reserves calculated from supply × price

**Deployment Flow (Single Transaction):**
1. `create_pool` instruction - Creates empty pool, sets ICBS parameters
2. `deploy_market` instruction - Seeds initial liquidity split between LONG/SHORT
3. **Both instructions combined in ONE atomic transaction** for better UX

**Settlement Flow:**
- When epoch processes, BD score determines pool settlement
- Settlement factors: `f_L = bd_score / q_long`, `f_S = (1 - bd_score) / (1 - q_long)`
- Reserves scale: `s_long_new = s_long * f_L`, `s_short_new = s_short * f_S`
- Conservation: Total USDC remains constant
- `status` tracks deployment/settlement lifecycle

**Notes:**
- Each belief has exactly one pool deployment (unique constraint on belief_id)
- Pool state is periodically synced from Solana via edge functions

## custodian_deposits
Event log for USDC deposits into VeritasCustodian contracts (dual-indexed from both server and blockchain events).

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
| deposit_type | text | Type: "direct" (user deposit) or "trade_skim" (from pool trades) |
| recorded_by | text | Source: "server" (API) or "indexer" (event processor) |
| confirmed | boolean | Whether on-chain event has verified this transaction |

**Indexes:**
- depositor_address (for lookup by wallet)
- agent_credited (partial index for pending deposits)
- block_time (for chronological queries)

**Dual-Source Indexing:**
- Deposits can be recorded by server-side API first (when transaction sent)
- Event indexer later confirms and updates `confirmed = true`
- Enables idempotent processing and reconciliation between systems

## custodian_withdrawals
Withdrawal requests and execution status (dual-indexed from both server and blockchain events).

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
| recorded_by | text | Source: "server" (API) or "indexer" (event processor) |
| confirmed | boolean | Whether on-chain event has verified this transaction |
| created_at | timestamp | When this record was created in database |

**Indexes:**
- agent_id (for user's withdrawal history)
- status (for admin queue processing)
- requested_at (chronological ordering)

**Dual-Source Indexing:**
- Withdrawals recorded by server when transaction sent
- Event indexer confirms and updates `confirmed = true`
- Enables reconciliation between expected and actual on-chain state

## belief_relevance_history
Time-series log of aggregate relevance changes per belief per epoch (for charting).

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique history entry ID |
| belief_id | belief reference | Which belief market this measurement is for (CASCADE delete) |
| epoch | integer | Epoch number when this measurement was taken |
| aggregate | decimal (0-1) | Aggregate belief value (weighted average of submissions) |
| delta_relevance | decimal | Change from previous epoch (aggregate - previous_aggregate) |
| certainty | decimal (0-1) | Certainty metric for this epoch |
| disagreement_entropy | decimal | Jensen-Shannon disagreement entropy |
| participant_count | integer | Number of active participants this epoch |
| total_stake | decimal | Total stake allocated to this belief this epoch |
| recorded_at | timestamp | When this measurement was recorded |

**Indexes:**
- (belief_id, epoch) UNIQUE - One record per belief per epoch
- belief_id - For fetching full history of a belief
- epoch - For cross-belief analysis at specific epochs

**Usage:**
- Written once per belief per epoch during BD processing
- Enables time-series charts: epoch → aggregate, delta_relevance, certainty
- Supports trend analysis and historical comparisons
- Immutable after creation (append-only log)

**Query Examples:**
```sql
-- Get relevance history for a specific belief
SELECT epoch, aggregate, delta_relevance, certainty, recorded_at
FROM belief_relevance_history
WHERE belief_id = $1
ORDER BY epoch ASC;

-- Get recent deltas for trending analysis
SELECT belief_id, epoch, delta_relevance
FROM belief_relevance_history
WHERE epoch >= $1
ORDER BY ABS(delta_relevance) DESC;

-- Chart data for frontend (last 30 epochs)
SELECT epoch, aggregate, certainty
FROM belief_relevance_history
WHERE belief_id = $1 AND epoch >= $2
ORDER BY epoch ASC;
```

## settlements
Historical record of pool settlements from on-chain events. Tracks how BD relevance scores affect pool reserves each epoch.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique settlement record ID |
| pool_address | text | Solana address of the ContentPool that was settled |
| belief_id | belief reference | Associated belief market (CASCADE delete) |
| post_id | post reference | Associated post (CASCADE delete) |
| epoch | integer | Epoch number when settlement occurred |
| bd_relevance_score | decimal (0-1) | BD (Belief Decomposition) relevance score x used for settlement |
| market_prediction_q | decimal (0-1) | Market prediction q = R_long / (R_long + R_short) before settlement |
| f_long | decimal | Settlement factor for LONG side: f_long = x / q |
| f_short | decimal | Settlement factor for SHORT side: f_short = (1-x) / (1-q) |
| reserve_long_before | bigint | LONG reserve in micro-USDC (6 decimals) before settlement |
| reserve_long_after | bigint | LONG reserve in micro-USDC after settlement |
| reserve_short_before | bigint | SHORT reserve in micro-USDC before settlement |
| reserve_short_after | bigint | SHORT reserve in micro-USDC after settlement |
| tx_signature | text (unique) | Solana transaction signature of settlement transaction |
| recorded_by | text | Source: "indexer" (event processor) or "manual" |
| confirmed | boolean | Whether settlement transaction was confirmed on-chain |
| timestamp | timestamp | When this settlement was recorded |

**Constraints:**
- UNIQUE(pool_address, epoch) - One settlement per pool per epoch

**Indexes:**
- pool_address (for pool history)
- belief_id (for belief analytics)
- post_id (for post analytics)
- epoch (for epoch-wide analysis)
- timestamp (chronological queries)
- tx_signature (transaction lookups)

**Settlement Mechanics:**
- BD relevance score `x ∈ [0,1]` represents protocol's assessment of post relevance
- Market prediction `q` represents traders' collective prediction before settlement
- Settlement factors applied to reserves:
  - `R_long_after = R_long_before × f_long`
  - `R_short_after = R_short_before × f_short`
- If `x > q`: LONG side gains, SHORT side loses (market underestimated relevance)
- If `x < q`: SHORT side gains, LONG side loses (market overestimated relevance)
- If `x = q`: No change (market perfectly predicted)

**Usage:**
```sql
-- Get settlement history for a pool
SELECT epoch, bd_relevance_score, market_prediction_q,
       reserve_long_after - reserve_long_before AS long_delta,
       reserve_short_after - reserve_short_before AS short_delta
FROM settlements
WHERE pool_address = $1
ORDER BY epoch ASC;

-- Find biggest settlement impacts this epoch
SELECT pool_address, bd_relevance_score, market_prediction_q,
       ABS(bd_relevance_score - market_prediction_q) AS prediction_error
FROM settlements
WHERE epoch = $1
ORDER BY prediction_error DESC
LIMIT 10;
```



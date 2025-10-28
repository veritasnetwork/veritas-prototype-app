# Protocol Data Structures

Core protocol tables that handle belief market mechanics only.

## agents
Generic agents in the protocol (not users).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique agent ID |
| solana_address | text | UNIQUE | User's Solana wallet address (nullable) |
| total_stake | bigint | NOT NULL, DEFAULT 0, CHECK >= 0 | Total stake across all markets (micro-USDC) |
| total_deposited | numeric | DEFAULT 0 | Total USDC deposited into custodian (all time, display units) |
| total_withdrawn | numeric | DEFAULT 0 | Total USDC withdrawn from custodian (all time, display units) |
| last_synced_at | timestamptz | | Last time total_stake was synced from on-chain custodian |
| created_at | timestamptz | DEFAULT now() | When agent was created |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Indexes:**
- `agents_pkey` (PRIMARY KEY on id)
- `agents_solana_address_key` (UNIQUE on solana_address)
- `idx_agents_solana_address` (on solana_address)
- `idx_agents_last_synced` (on last_synced_at)

**Check Constraints:**
- `agents_total_stake_non_negative` - total_stake >= 0
- `agents_total_stake_positive` - total_stake::numeric >= 0::numeric

**Referenced By:**
- belief_submissions.agent_id
- beliefs.creator_agent_id
- custodian_deposits.agent_id
- custodian_withdrawals.agent_id
- pool_deployments.deployed_by_agent_id
- users.agent_id

## beliefs
Tracks active belief markets.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique belief market ID |
| creator_agent_id | uuid | NOT NULL, FOREIGN KEY → agents(id) CASCADE | Agent who created this belief |
| created_epoch | integer | NOT NULL, DEFAULT 0 | Epoch number at creation |
| previous_aggregate | numeric(10,8) | NOT NULL, DEFAULT 0.5, CHECK 0-1 | Absolute BD relevance score from last epoch (initial belief at creation) |
| previous_disagreement_entropy | numeric(10,8) | NOT NULL, DEFAULT 0.0 | Disagreement entropy from last epoch |
| certainty | numeric | CHECK 0-1 | Certainty metric (NOT uncertainty) |
| created_at | timestamptz | DEFAULT now() | When belief was created |

**Indexes:**
- `beliefs_pkey` (PRIMARY KEY on id)
- `idx_beliefs_creator_agent` (on creator_agent_id)
- `idx_beliefs_certainty` (on certainty WHERE certainty IS NOT NULL)

**Check Constraints:**
- `beliefs_certainty_check` - certainty >= 0 AND certainty <= 1
- `beliefs_previous_aggregate_check` - previous_aggregate >= 0 AND previous_aggregate <= 1

**Referenced By:**
- belief_relevance_history.belief_id
- belief_submissions.belief_id
- pool_deployments.belief_id
- posts.belief_id
- settlements.belief_id

## belief_submissions
Active submissions awaiting scoring.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique submission ID |
| agent_id | uuid | NOT NULL, FOREIGN KEY → agents(id) CASCADE | Agent making the submission |
| belief_id | uuid | NOT NULL, FOREIGN KEY → beliefs(id) CASCADE | Which belief market this is for |
| belief | numeric(10,8) | NOT NULL, CHECK 0-1 | Agent's probability assessment (p) |
| meta_prediction | numeric(10,8) | NOT NULL, CHECK 0-1 | Agent's prediction of average belief (m) |
| epoch | integer | NOT NULL, DEFAULT 0 | Epoch when this belief was submitted |
| is_active | boolean | NOT NULL, DEFAULT true | Whether agent was active (true) or passive (false) this epoch |
| created_at | timestamptz | DEFAULT now() | When submission was first created |
| updated_at | timestamptz | DEFAULT now() | When submission was last modified |

**Indexes:**
- `belief_submissions_pkey` (PRIMARY KEY on id)
- `belief_submissions_agent_id_belief_id_key` (UNIQUE on agent_id, belief_id)
- `idx_belief_submissions_agent` (on agent_id)
- `idx_belief_submissions_belief` (on belief_id)
- `idx_belief_submissions_belief_agent` (on belief_id, agent_id)
- `idx_belief_submissions_epoch` (on epoch)

**Constraints:**
- One submission per agent per belief (UNIQUE constraint)
- Effective stake calculated at scoring time using stake scaling rules

## belief_relevance_history
Time-series log of aggregate relevance changes per belief per epoch (for charting).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique history entry ID |
| belief_id | uuid | NOT NULL, FOREIGN KEY → beliefs(id) CASCADE | Which belief market this measurement is for |
| post_id | uuid | NOT NULL, FOREIGN KEY → posts(id) CASCADE | Associated post |
| epoch | integer | NOT NULL | Epoch number when this measurement was taken |
| aggregate | numeric | NOT NULL, CHECK 0-1 | Aggregate belief value (weighted average of submissions) |
| certainty | numeric | NOT NULL, CHECK 0-1 | Certainty metric for this epoch |
| disagreement_entropy | numeric | | Jensen-Shannon disagreement entropy |
| recorded_at | timestamptz | NOT NULL, DEFAULT now() | When this measurement was recorded |
| created_at | timestamptz | DEFAULT now() | Row creation timestamp |

**Indexes:**
- `belief_relevance_history_pkey` (PRIMARY KEY on id)
- `belief_relevance_history_belief_id_epoch_key` (UNIQUE on belief_id, epoch)
- `idx_belief_history_belief_epoch` (on belief_id, epoch DESC)
- `idx_belief_history_post_epoch` (on post_id, epoch DESC)
- `idx_belief_history_epoch_time` (on epoch, recorded_at)

**Check Constraints:**
- `belief_relevance_history_aggregate_check` - aggregate >= 0 AND aggregate <= 1
- `belief_relevance_history_certainty_check` - certainty >= 0 AND certainty <= 1

**Notes:**
- Written once per belief per epoch during BD processing
- Enables time-series charts: epoch → aggregate, certainty
- Immutable after creation (append-only log)

## system_config
Global system configuration and state.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | text | PRIMARY KEY | Configuration key |
| value | text | NOT NULL | Configuration value |
| description | text | | Human-readable description of config parameter |
| created_at | timestamptz | DEFAULT now() | When this config was first created |
| updated_at | timestamptz | DEFAULT now() | When this config was last updated |

**Indexes:**
- `system_config_pkey` (PRIMARY KEY on key)
- `idx_system_config_key` (on key)

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

## epoch_history
Historical record of epoch processing events.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique epoch history ID |
| epoch_number | integer | NOT NULL, CHECK >= 0 | Epoch number |
| started_at | timestamptz | NOT NULL | When epoch started |
| ended_at | timestamptz | | When epoch ended |
| scheduled_duration_seconds | integer | NOT NULL, CHECK > 0 | Scheduled epoch duration |
| actual_duration_seconds | integer | | Actual duration |
| processing_triggered_at | timestamptz | | When processing started |
| processing_completed_at | timestamptz | | When processing completed |
| processing_duration_ms | integer | | Processing duration in milliseconds |
| beliefs_processed | integer | DEFAULT 0 | Number of beliefs processed |
| beliefs_expired | integer | DEFAULT 0 | Number of beliefs expired |
| manual_triggered | boolean | DEFAULT false | Whether manually triggered |
| status | text | CHECK ('active', 'completed', 'failed', 'timeout') | Epoch status |
| created_at | timestamptz | DEFAULT now() | Record creation time |

**Indexes:**
- `epoch_history_pkey` (PRIMARY KEY on id)
- `idx_epoch_history_epoch_number` (on epoch_number)
- `idx_epoch_history_started_at` (on started_at)
- `idx_epoch_history_status` (on status)

**Check Constraints:**
- `epoch_history_duration_positive` - scheduled_duration_seconds > 0
- `epoch_history_epoch_number_positive` - epoch_number >= 0
- `epoch_history_timing_consistent` - ended_at >= started_at AND processing_completed_at >= processing_triggered_at

## pool_deployments
Tracks ContentPool deployments on Solana for each belief/post. Uses ICBS (Informed Constant β-Sum) two-sided market model.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique deployment ID |
| post_id | uuid | NOT NULL, UNIQUE, FOREIGN KEY → posts(id) CASCADE | Associated post |
| belief_id | uuid | NOT NULL, UNIQUE, FOREIGN KEY → beliefs(id) CASCADE | Associated belief market |
| pool_address | text | NOT NULL, UNIQUE | Solana address of the ContentPool program account |
| deployed_at | timestamptz | DEFAULT now() | When pool was created (empty pool) |
| deployed_by_agent_id | uuid | FOREIGN KEY → agents(id) | Agent who deployed this pool |
| deployment_tx_signature | text | UNIQUE | Solana transaction signature of pool creation |
| token_supply | numeric | DEFAULT 0 | Legacy field (deprecated) |
| reserve | numeric | DEFAULT 0 | Legacy field (deprecated) |
| last_synced_at | timestamptz | | Last time pool state was synced from chain |
| f | integer | DEFAULT 1 | ICBS growth exponent |
| beta_num | integer | DEFAULT 1 | ICBS β numerator |
| beta_den | integer | DEFAULT 2 | ICBS β denominator (β = beta_num/beta_den = 0.5) |
| long_mint_address | text | | SPL token mint for LONG tokens |
| short_mint_address | text | | SPL token mint for SHORT tokens |
| status | text | NOT NULL, DEFAULT 'pending', CHECK | Status: 'pool_created', 'market_deployed', 'failed' |
| sqrt_price_long_x96 | text | | Current LONG sqrt price in Q64.96 format |
| sqrt_price_short_x96 | text | | Current SHORT sqrt price in Q64.96 format |
| s_long_supply | numeric | | LONG token supply (DISPLAY UNITS) |
| s_short_supply | numeric | | SHORT token supply (DISPLAY UNITS) |
| vault_balance | numeric | | Total USDC in vault (micro-USDC) |
| sqrt_lambda_long_x96 | text | | ICBS λ parameter for LONG side in Q64.96 format |
| sqrt_lambda_short_x96 | text | | ICBS λ parameter for SHORT side in Q64.96 format |
| initial_usdc | numeric | | Initial USDC deposited (display units) |
| initial_long_allocation | numeric | | Initial LONG reserve allocation (display units) |
| initial_short_allocation | numeric | | Initial SHORT reserve allocation (display units) |
| r_long | numeric | | Virtual reserve for LONG side: R_L = s_L × p_L |
| r_short | numeric | | Virtual reserve for SHORT side: R_S = s_S × p_S |
| market_deployed_at | timestamptz | | When market was deployed (initial liquidity added) |
| market_deployment_tx_signature | text | | Transaction signature of market deployment |
| last_settlement_epoch | integer | | Most recent epoch this pool was settled |
| last_settlement_tx | text | | Transaction signature of most recent settlement |
| current_epoch | integer | NOT NULL, DEFAULT 0 | Current epoch for this pool |
| cached_price_long | numeric | | Cached LONG token price (USDC per token) |
| cached_price_short | numeric | | Cached SHORT token price (USDC per token) |
| prices_last_updated_at | timestamptz | | When cached prices were last updated |

**Indexes:**
- `pool_deployments_pkey` (PRIMARY KEY on id)
- `idx_pool_deployments_post` (UNIQUE on post_id)
- `idx_pool_deployments_belief` (UNIQUE on belief_id)
- `pool_deployments_pool_address_key` (UNIQUE on pool_address)
- `pool_deployments_deployment_tx_signature_key` (UNIQUE on deployment_tx_signature)
- `idx_pool_deployments_pool_address` (on pool_address)
- `idx_pool_deployments_post_id` (on post_id)
- `idx_pool_deployments_deployed_by` (on deployed_by_agent_id)
- `idx_pool_deployments_status` (on status)
- `idx_pool_deployments_current_epoch` (on current_epoch)
- `idx_pool_deployments_last_synced` (on last_synced_at)
- `idx_pool_deployments_post_sync` (on post_id, last_synced_at)
- `idx_pool_deployments_long_mint` (on long_mint_address WHERE NOT NULL)
- `idx_pool_deployments_short_mint` (on short_mint_address WHERE NOT NULL)
- `idx_pool_deployments_prices` (on sqrt_price_long_x96, sqrt_price_short_x96 WHERE NOT NULL)
- `idx_pool_deployments_prices_updated` (on prices_last_updated_at WHERE NOT NULL)
- `idx_pool_deployments_settlement_epoch` (on last_settlement_epoch WHERE NOT NULL)
- `idx_pool_deployments_market_deployment_tx` (on market_deployment_tx_signature WHERE NOT NULL)

**IMPORTANT UNITS:**
- `s_long_supply`, `s_short_supply`: DISPLAY units (e.g., 116000000.0 tokens)
- `vault_balance`: MICRO-USDC (e.g., 100000000 = $100.00)
- `initial_usdc`, `initial_long_allocation`, `initial_short_allocation`: DISPLAY units (USDC)
- `cached_price_long`, `cached_price_short`: DISPLAY units (USDC per token)
- `r_long`, `r_short`: Virtual reserves (derived from supply × price)

**Referenced By:**
- trades.pool_address
- user_pool_balances.pool_address

## custodian_deposits
Event log for USDC deposits into VeritasCustodian contracts.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique deposit event ID |
| depositor_address | text | NOT NULL | Solana wallet address that made the deposit |
| amount_usdc | numeric | NOT NULL | Amount of USDC deposited (display units) |
| tx_signature | text | NOT NULL, UNIQUE | Solana transaction signature |
| block_time | timestamptz | | Blockchain timestamp of transaction |
| slot | bigint | | Solana slot number |
| indexed_at | timestamptz | DEFAULT now() | When this event was indexed into our database |
| agent_credited | boolean | DEFAULT false | Whether agent's balance has been credited |
| credited_at | timestamptz | | When agent was credited |
| agent_id | uuid | FOREIGN KEY → agents(id) SET NULL | Agent associated with depositor |
| deposit_type | text | DEFAULT 'direct', CHECK | Type: "direct" or "trade_skim" |
| recorded_by | text | DEFAULT 'indexer', CHECK | Source: "server" or "indexer" |
| confirmed | boolean | DEFAULT false | Whether on-chain event has verified this transaction |

**Indexes:**
- `custodian_deposits_pkey` (PRIMARY KEY on id)
- `custodian_deposits_tx_signature_key` (UNIQUE on tx_signature)
- `idx_deposits_depositor` (on depositor_address)
- `idx_deposits_agent` (on agent_id)
- `idx_deposits_block_time` (on block_time)
- `idx_deposits_pending` (on agent_credited WHERE NOT agent_credited)

## custodian_withdrawals
Withdrawal requests and execution status.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique withdrawal request ID |
| agent_id | uuid | NOT NULL, FOREIGN KEY → agents(id) CASCADE | Agent requesting withdrawal |
| amount_usdc | numeric | NOT NULL | Amount of USDC to withdraw (display units) |
| recipient_address | text | NOT NULL | Solana wallet address to receive funds |
| requested_at | timestamptz | DEFAULT now() | When withdrawal was requested |
| requested_by_user_id | uuid | FOREIGN KEY → users(id) | User who initiated request |
| status | text | DEFAULT 'pending', CHECK | Status: "pending", "approved", "rejected", "completed", "failed" |
| tx_signature | text | UNIQUE | Solana transaction signature (when executed) |
| processed_at | timestamptz | | When withdrawal was processed |
| block_time | timestamptz | | Blockchain timestamp (when executed) |
| rejection_reason | text | | Reason if rejected |
| failure_reason | text | | Reason if execution failed |
| recorded_by | text | DEFAULT 'indexer', CHECK | Source: "server" or "indexer" |
| confirmed | boolean | DEFAULT false | Whether on-chain event has verified this transaction |

**Indexes:**
- `custodian_withdrawals_pkey` (PRIMARY KEY on id)
- `custodian_withdrawals_tx_signature_key` (UNIQUE on tx_signature)
- `idx_withdrawals_agent` (on agent_id)
- `idx_withdrawals_status` (on status)
- `idx_withdrawals_requested_at` (on requested_at)

## settlements
Historical record of pool settlements from on-chain events.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique settlement record ID |
| pool_address | text | NOT NULL | Solana address of the ContentPool that was settled |
| belief_id | uuid | NOT NULL, FOREIGN KEY → beliefs(id) CASCADE | Associated belief market |
| post_id | uuid | NOT NULL, FOREIGN KEY → posts(id) CASCADE | Associated post |
| epoch | integer | NOT NULL | Epoch number when settlement occurred |
| bd_relevance_score | numeric | NOT NULL, CHECK 0-1 | BD relevance score x used for settlement |
| market_prediction_q | numeric | NOT NULL, CHECK 0-1 | Market prediction q before settlement |
| f_long | numeric | NOT NULL, CHECK >= 0 | Settlement factor for LONG side |
| f_short | numeric | NOT NULL, CHECK >= 0 | Settlement factor for SHORT side |
| reserve_long_before | bigint | NOT NULL | LONG reserve before settlement (micro-USDC) |
| reserve_long_after | bigint | NOT NULL | LONG reserve after settlement (micro-USDC) |
| reserve_short_before | bigint | NOT NULL | SHORT reserve before settlement (micro-USDC) |
| reserve_short_after | bigint | NOT NULL | SHORT reserve after settlement (micro-USDC) |
| tx_signature | text | UNIQUE | Solana transaction signature |
| recorded_by | text | NOT NULL, DEFAULT 'indexer', CHECK | Source: "indexer" or "manual" |
| confirmed | boolean | NOT NULL, DEFAULT false | Whether settlement transaction was confirmed on-chain |
| timestamp | timestamptz | NOT NULL, DEFAULT now() | When this settlement was recorded |

**Indexes:**
- `settlements_pkey` (PRIMARY KEY on id)
- `settlements_pool_address_epoch_key` (UNIQUE on pool_address, epoch)
- `settlements_tx_signature_key` (UNIQUE on tx_signature)
- `idx_settlements_pool` (on pool_address)
- `idx_settlements_belief` (on belief_id)
- `idx_settlements_post` (on post_id)
- `idx_settlements_epoch` (on epoch)
- `idx_settlements_timestamp` (on timestamp DESC)
- `idx_settlements_tx` (on tx_signature)

## implied_relevance_history
Time-series log of implied relevance from market prices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique history entry ID |
| post_id | uuid | NOT NULL | Associated post |
| belief_id | uuid | NOT NULL | Associated belief market |
| implied_relevance | numeric | NOT NULL, CHECK 0-1 | Implied relevance from market prices |
| reserve_long | numeric | NOT NULL, CHECK >= 0 | LONG reserve at this snapshot |
| reserve_short | numeric | NOT NULL, CHECK >= 0 | SHORT reserve at this snapshot |
| event_type | text | NOT NULL, CHECK | Event: "trade", "deployment", or "rebase" |
| event_reference | text | NOT NULL, UNIQUE | Transaction signature or event ID |
| confirmed | boolean | NOT NULL, DEFAULT false | Whether event confirmed on-chain |
| recorded_by | text | NOT NULL, DEFAULT 'server', CHECK | Source: "server" or "indexer" |
| recorded_at | timestamptz | NOT NULL, DEFAULT now() | When this was recorded |

**Indexes:**
- `implied_relevance_history_pkey` (PRIMARY KEY on id)
- `implied_relevance_history_event_reference_key` (UNIQUE on event_reference)
- `idx_implied_relevance_post_time` (on post_id, recorded_at DESC)
- `idx_implied_relevance_belief_time` (on belief_id, recorded_at DESC)
- `idx_implied_relevance_event_type` (on event_type)

**RLS Policies:**
- Public read access enabled
- Service role write access only

---

**Last Updated:** October 25, 2025
**Status:** Current schema after all migrations applied

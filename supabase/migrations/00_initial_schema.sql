-- ============================================================================
-- Veritas Protocol - Consolidated Initial Schema
-- ============================================================================
-- This schema represents the final state after all migrations applied.
-- Run order: Extensions → Tables (by dependency) → Indexes → Functions → RLS
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- TABLES (in dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- System Configuration Table
-- ----------------------------------------------------------------------------
-- Single source of truth for all system-wide configuration values
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial configuration values with descriptions
INSERT INTO system_config (key, value, description) VALUES
    -- Protocol Core
    ('current_epoch', '0', 'Global epoch counter for protocol processing'),
    ('epoch_duration_seconds', '3600', 'Duration of each epoch in seconds (3600 = 1 hour, 30 for testing)'),
    ('epoch_processing_enabled', 'false', 'Whether automatic epoch processing is enabled'),
    ('epoch_processing_trigger', 'manual', 'How epochs are triggered: manual or event-driven'),

    -- Belief Market Rules
    ('min_participants_for_scoring', '2', 'Minimum participants required for BTS scoring'),
    ('min_stake_per_belief', '0.5', 'Minimum stake allocated per belief (USD)'),
    ('initial_agent_stake', '10000.0', 'Default stake amount for new agents (USD) - $10k for alpha'),
    ('min_belief_duration', '10', 'Minimum belief market duration in epochs (10 epochs = 48h at 4.8h/epoch)'),
    ('max_belief_duration', '100', 'Maximum belief market duration in epochs'),
    ('max_beliefs_per_agent', '1000', 'Maximum number of beliefs per agent'),
    ('max_agents_per_belief', '10000', 'Maximum number of agents per belief market'),

    -- Epoch Timing
    ('current_epoch_start_time', '2025-09-15T10:00:00.000Z', 'Timestamp of first epoch start'),
    ('next_epoch_deadline', '2025-09-15T11:00:00.000Z', 'Next scheduled epoch target time'),

    -- System Environment
    ('deployment_environment', 'supabase', 'Deployment environment: supabase or local'),

    -- Pool Redistribution
    ('base_skim_rate', '0.01', 'Base penalty rate for pools with zero delta_relevance (1% = 0.01)'),
    ('epoch_rollover_balance', '0', 'Accumulated penalty pot from epochs with no winning pools');

-- ----------------------------------------------------------------------------
-- Protocol Agents Table
-- ----------------------------------------------------------------------------
-- Represents protocol-level agents with stake and Solana integration
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Solana Integration
    solana_address TEXT UNIQUE,

    -- Stake Tracking
    total_stake DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_deposited NUMERIC DEFAULT 0,
    total_withdrawn NUMERIC DEFAULT 0,

    -- Activity
    active_belief_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT agents_total_stake_positive CHECK (total_stake >= 0),
    CONSTRAINT agents_belief_count_non_negative CHECK (active_belief_count >= 0)
);

COMMENT ON TABLE agents IS 'Protocol-level agents with Solana wallet integration and stake tracking';
COMMENT ON COLUMN agents.solana_address IS 'User''s Solana wallet address - primary identity for the protocol';
COMMENT ON COLUMN agents.total_deposited IS 'Total USDC deposited into custodian (all time)';
COMMENT ON COLUMN agents.total_withdrawn IS 'Total USDC withdrawn from custodian (all time)';
COMMENT ON COLUMN agents.last_synced_at IS 'Last time total_stake was synced from on-chain custodian';

-- ----------------------------------------------------------------------------
-- Application Users Table
-- ----------------------------------------------------------------------------
-- App-layer user profiles linked to protocol agents
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Protocol Link
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Auth (Privy integration)
    auth_provider TEXT NULL,
    auth_id TEXT NULL,

    -- Profile
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT NULL,
    avatar_url TEXT NULL,

    -- Cached Stats
    total_stake DECIMAL(10,2) NOT NULL DEFAULT 0,
    beliefs_created INTEGER NOT NULL DEFAULT 0,
    beliefs_participated INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT users_username_length CHECK (char_length(username) BETWEEN 2 AND 50),
    CONSTRAINT users_auth_credentials_unique UNIQUE (auth_provider, auth_id)
);

COMMENT ON TABLE users IS 'Application-layer users with social profiles, linked to protocol agents';
COMMENT ON COLUMN users.total_stake IS 'Cached from agents.total_stake for app-layer queries';

-- ----------------------------------------------------------------------------
-- Beliefs Table
-- ----------------------------------------------------------------------------
-- Protocol belief markets for intersubjective consensus
CREATE TABLE beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Creator and Lifecycle
    creator_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_epoch INTEGER NOT NULL DEFAULT 0,
    expiration_epoch INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'processed')),

    -- Learning Assessment (from previous epoch)
    previous_aggregate DECIMAL(10,8) NOT NULL CHECK (previous_aggregate >= 0 AND previous_aggregate <= 1),
    previous_disagreement_entropy DECIMAL(10,8) NOT NULL DEFAULT 0.0,

    -- Pool Redistribution Metrics
    delta_relevance NUMERIC,
    certainty NUMERIC CHECK (certainty >= 0 AND certainty <= 1),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE beliefs IS 'Belief markets for intersubjective consensus using Bayesian Truth Serum';
COMMENT ON COLUMN beliefs.delta_relevance IS 'Change in aggregate belief from previous epoch (used for pool redistribution)';
COMMENT ON COLUMN beliefs.certainty IS 'Certainty metric from learning assessment (NOT uncertainty)';

-- ----------------------------------------------------------------------------
-- Belief Submissions Table
-- ----------------------------------------------------------------------------
-- Individual agent submissions to belief markets
CREATE TABLE belief_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

    -- Submission Data
    belief DECIMAL(10,8) NOT NULL CHECK (belief >= 0 AND belief <= 1),
    meta_prediction DECIMAL(10,8) NOT NULL CHECK (meta_prediction >= 0 AND meta_prediction <= 1),
    epoch INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(agent_id, belief_id)
);

COMMENT ON TABLE belief_submissions IS 'Agent submissions to belief markets with belief and meta-prediction';

-- ----------------------------------------------------------------------------
-- Posts Table
-- ----------------------------------------------------------------------------
-- User-created content posts (all posts require belief)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

    -- Content
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    content TEXT NULL CHECK (char_length(content) <= 2000),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE posts IS 'All posts must have an associated belief. No multimedia support.';
COMMENT ON COLUMN posts.belief_id IS 'Required reference to the belief market for this post';
COMMENT ON COLUMN posts.title IS 'Post title/question (required, max 200 chars)';
COMMENT ON COLUMN posts.content IS 'Post content providing context (optional, max 2000 chars)';

-- ----------------------------------------------------------------------------
-- Pool Deployments Table
-- ----------------------------------------------------------------------------
-- Tracks Solana ContentPool deployments for speculation
CREATE TABLE pool_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

    -- Solana Addresses
    pool_address TEXT NOT NULL UNIQUE,
    usdc_vault_address TEXT NOT NULL,
    token_mint_address TEXT NOT NULL,

    -- Deployment Info
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_by_agent_id UUID REFERENCES agents(id),
    deployment_tx_signature TEXT UNIQUE,

    -- Bonding Curve Parameters (pure quadratic)
    k_quadratic NUMERIC NOT NULL,

    -- Current State (cached from chain)
    token_supply NUMERIC DEFAULT 0,
    reserve NUMERIC DEFAULT 0,
    last_synced_at TIMESTAMPTZ
);

COMMENT ON TABLE pool_deployments IS 'Tracks ContentPool deployments on Solana for each belief/post';
COMMENT ON COLUMN pool_deployments.k_quadratic IS 'Quadratic coefficient for pure quadratic bonding curve: price = k * supply^2';
COMMENT ON COLUMN pool_deployments.token_supply IS 'Cached token supply from Solana (in token units, not atomic units)';
COMMENT ON COLUMN pool_deployments.reserve IS 'Cached USDC reserve balance from Solana ContentPool.reserve (in micro-USDC, 6 decimals)';
COMMENT ON COLUMN pool_deployments.last_synced_at IS 'Last time pool data was synced from Solana';

-- ----------------------------------------------------------------------------
-- Custodian Deposits Table
-- ----------------------------------------------------------------------------
-- Event log for USDC deposits into VeritasCustodian
CREATE TABLE custodian_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event Data
    depositor_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time TIMESTAMPTZ,
    slot BIGINT,

    -- Indexing Metadata
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_credited BOOLEAN DEFAULT FALSE,
    credited_at TIMESTAMPTZ,

    -- Foreign Key (nullable for deposits before agent exists)
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL
);

COMMENT ON TABLE custodian_deposits IS 'Event log for USDC deposits into VeritasCustodian contracts (indexed via webhook)';

-- ----------------------------------------------------------------------------
-- Custodian Withdrawals Table
-- ----------------------------------------------------------------------------
-- Withdrawal requests and execution tracking
CREATE TABLE custodian_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Request Details
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    amount_usdc NUMERIC NOT NULL,
    recipient_address TEXT NOT NULL,

    -- Request Tracking
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by_user_id UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')) DEFAULT 'pending',

    -- Execution Tracking
    tx_signature TEXT UNIQUE,
    processed_at TIMESTAMPTZ,
    block_time TIMESTAMPTZ,

    -- Rejection/Failure Tracking
    rejection_reason TEXT,
    failure_reason TEXT
);

COMMENT ON TABLE custodian_withdrawals IS 'Withdrawal requests and execution status';

-- ----------------------------------------------------------------------------
-- Epoch History Table
-- ----------------------------------------------------------------------------
-- Tracks epoch transitions and timing accuracy
CREATE TABLE epoch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Epoch Info
    epoch_number INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,

    -- Duration Tracking
    scheduled_duration_seconds INTEGER NOT NULL,
    actual_duration_seconds INTEGER,

    -- Processing Tracking
    processing_triggered_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    beliefs_processed INTEGER DEFAULT 0,
    beliefs_expired INTEGER DEFAULT 0,

    -- Trigger Info
    manual_triggered BOOLEAN DEFAULT false,

    -- Status
    status TEXT CHECK (status IN ('active', 'completed', 'failed', 'timeout')),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT epoch_history_epoch_number_positive CHECK (epoch_number >= 0),
    CONSTRAINT epoch_history_duration_positive CHECK (scheduled_duration_seconds > 0),
    CONSTRAINT epoch_history_timing_consistent CHECK (
        (ended_at IS NULL OR ended_at >= started_at) AND
        (processing_completed_at IS NULL OR processing_triggered_at IS NULL OR processing_completed_at >= processing_triggered_at)
    )
);

COMMENT ON TABLE epoch_history IS 'Tracks epoch transitions, processing metrics, and timing accuracy';

-- ----------------------------------------------------------------------------
-- Invite Codes Table
-- ----------------------------------------------------------------------------
-- Alpha access control via invite codes
CREATE TABLE invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Code Info
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'used')),

    -- Tracking
    created_by_user_id UUID REFERENCES users(id),
    used_by_user_id UUID REFERENCES users(id),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT invite_codes_used_fields_consistent
        CHECK ((status = 'used') = (used_by_user_id IS NOT NULL AND used_at IS NOT NULL))
);

COMMENT ON TABLE invite_codes IS 'Alpha access control via invite codes';

-- ----------------------------------------------------------------------------
-- User Access Table
-- ----------------------------------------------------------------------------
-- Tracks user activation status and invite usage
CREATE TABLE user_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User Link
    user_id UUID REFERENCES users(id) UNIQUE NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'activated')),
    invite_code_used TEXT REFERENCES invite_codes(code),
    activated_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT user_access_activated_fields_consistent
        CHECK ((status = 'activated') = (activated_at IS NOT NULL))
);

COMMENT ON TABLE user_access IS 'Tracks user activation status and invite usage';

-- ----------------------------------------------------------------------------
-- Waitlist Table
-- ----------------------------------------------------------------------------
-- Email collection for future alpha invites
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Email
    email TEXT UNIQUE NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited')),
    invited_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT waitlist_invited_fields_consistent
        CHECK ((status = 'invited') = (invited_at IS NOT NULL))
);

COMMENT ON TABLE waitlist IS 'Email collection for future alpha invites';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- System Config
CREATE INDEX idx_system_config_key ON system_config(key);

-- Agents
CREATE INDEX idx_agents_solana_address ON agents(solana_address);
CREATE INDEX idx_agents_last_synced ON agents(last_synced_at);

-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_agent_id ON users(agent_id);
CREATE INDEX idx_users_auth_credentials ON users(auth_provider, auth_id)
    WHERE auth_provider IS NOT NULL AND auth_id IS NOT NULL;

-- Beliefs
CREATE INDEX idx_beliefs_creator_agent ON beliefs(creator_agent_id);
CREATE INDEX idx_beliefs_status ON beliefs(status);
CREATE INDEX idx_beliefs_expires_at_epoch ON beliefs(expiration_epoch);
CREATE INDEX idx_beliefs_delta_relevance ON beliefs(delta_relevance) WHERE delta_relevance IS NOT NULL;
CREATE INDEX idx_beliefs_certainty ON beliefs(certainty) WHERE certainty IS NOT NULL;

-- Belief Submissions
CREATE INDEX idx_belief_submissions_agent ON belief_submissions(agent_id);
CREATE INDEX idx_belief_submissions_belief ON belief_submissions(belief_id);
CREATE INDEX idx_belief_submissions_epoch ON belief_submissions(epoch);

-- Posts
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_belief_id ON posts(belief_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Pool Deployments
CREATE UNIQUE INDEX idx_pool_deployments_belief ON pool_deployments(belief_id);
CREATE UNIQUE INDEX idx_pool_deployments_post ON pool_deployments(post_id);
CREATE INDEX idx_pool_deployments_deployed_by ON pool_deployments(deployed_by_agent_id);
CREATE INDEX idx_pool_deployments_pool_address ON pool_deployments(pool_address);
CREATE INDEX idx_pool_deployments_last_synced ON pool_deployments(last_synced_at);

-- Custodian Deposits
CREATE INDEX idx_deposits_depositor ON custodian_deposits(depositor_address);
CREATE INDEX idx_deposits_pending ON custodian_deposits(agent_credited) WHERE NOT agent_credited;
CREATE INDEX idx_deposits_block_time ON custodian_deposits(block_time);
CREATE INDEX idx_deposits_agent ON custodian_deposits(agent_id);

-- Custodian Withdrawals
CREATE INDEX idx_withdrawals_agent ON custodian_withdrawals(agent_id);
CREATE INDEX idx_withdrawals_status ON custodian_withdrawals(status);
CREATE INDEX idx_withdrawals_requested_at ON custodian_withdrawals(requested_at);

-- Epoch History
CREATE INDEX idx_epoch_history_epoch_number ON epoch_history(epoch_number);
CREATE INDEX idx_epoch_history_status ON epoch_history(status);
CREATE INDEX idx_epoch_history_started_at ON epoch_history(started_at);

-- Invite Codes
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_status ON invite_codes(status);

-- User Access
CREATE INDEX idx_user_access_user_id ON user_access(user_id);
CREATE INDEX idx_user_access_status ON user_access(status);

-- Waitlist
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Stake Management Functions
-- ----------------------------------------------------------------------------

-- Function to add stake to an agent
CREATE OR REPLACE FUNCTION add_agent_stake(
    p_agent_id UUID,
    p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
    -- Update agent's total stake
    UPDATE agents
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE id = p_agent_id;

    -- Also update the user's total_stake field
    UPDATE users
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync agent stake from Solana custodian
CREATE OR REPLACE FUNCTION sync_agent_stake_from_chain(
    p_agent_id UUID,
    p_solana_address TEXT,
    p_onchain_balance NUMERIC
) RETURNS void AS $$
BEGIN
    UPDATE agents
    SET
        solana_address = p_solana_address,
        total_stake = p_onchain_balance,
        last_synced_at = NOW()
    WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Pool Management Functions
-- ----------------------------------------------------------------------------

-- Function to record a pool deployment (pure quadratic curve)
CREATE OR REPLACE FUNCTION record_pool_deployment(
    p_post_id UUID,
    p_belief_id UUID,
    p_pool_address TEXT,
    p_vault_address TEXT,
    p_mint_address TEXT,
    p_deployed_by_agent_id UUID,
    p_tx_signature TEXT,
    p_k_quadratic NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_deployment_id UUID;
BEGIN
    INSERT INTO pool_deployments (
        post_id,
        belief_id,
        pool_address,
        usdc_vault_address,
        token_mint_address,
        deployed_by_agent_id,
        deployment_tx_signature,
        k_quadratic
    ) VALUES (
        p_post_id,
        p_belief_id,
        p_pool_address,
        p_vault_address,
        p_mint_address,
        p_deployed_by_agent_id,
        p_tx_signature,
        p_k_quadratic
    ) RETURNING id INTO v_deployment_id;

    RETURN v_deployment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_pool_deployment IS
'Records a new pool deployment. Updated to pure quadratic curve (removed reserve_cap, linear_slope, virtual_liquidity).';

-- Function to update pool state from chain
CREATE OR REPLACE FUNCTION update_pool_state(
    p_pool_address TEXT,
    p_token_supply NUMERIC,
    p_reserve NUMERIC
) RETURNS void AS $$
BEGIN
    UPDATE pool_deployments
    SET
        token_supply = p_token_supply,
        reserve = p_reserve,
        last_synced_at = NOW()
    WHERE pool_address = p_pool_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Epoch Status Function
-- ----------------------------------------------------------------------------

-- Function to get current epoch status for API endpoints
CREATE OR REPLACE FUNCTION get_epoch_status()
RETURNS TABLE (
    current_epoch INTEGER,
    epoch_start_time TIMESTAMPTZ,
    time_remaining_seconds INTEGER,
    next_deadline TIMESTAMPTZ,
    processing_enabled BOOLEAN
) AS $$
DECLARE
    config_row RECORD;
    start_time TIMESTAMPTZ;
    deadline TIMESTAMPTZ;
    duration_sec INTEGER;
BEGIN
    -- Get all config values in one query
    SELECT
        MAX(CASE WHEN key = 'current_epoch' THEN value::INTEGER END) as curr_epoch,
        MAX(CASE WHEN key = 'current_epoch_start_time' THEN value::TIMESTAMPTZ END) as start_tm,
        MAX(CASE WHEN key = 'next_epoch_deadline' THEN value::TIMESTAMPTZ END) as deadline_tm,
        MAX(CASE WHEN key = 'epoch_duration_seconds' THEN value::INTEGER END) as duration
    INTO config_row
    FROM system_config
    WHERE key IN (
        'current_epoch',
        'current_epoch_start_time',
        'next_epoch_deadline',
        'epoch_duration_seconds'
    );

    -- Calculate time remaining
    start_time := COALESCE(config_row.start_tm, NOW());
    deadline := COALESCE(config_row.deadline_tm, start_time + INTERVAL '1 hour');
    duration_sec := GREATEST(0, EXTRACT(EPOCH FROM (deadline - NOW()))::INTEGER);

    -- Return results
    current_epoch := COALESCE(config_row.curr_epoch, 0);
    epoch_start_time := start_time;
    time_remaining_seconds := duration_sec;
    next_deadline := deadline;
    processing_enabled := true;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Cron Management Functions
-- ----------------------------------------------------------------------------

-- Function to get the proper function URL for the current environment
-- Cron-related functions removed - epoch processing is now manual/event-driven only

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on auth tables
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invite_codes (read-only for users)
CREATE POLICY "Users can view invite codes" ON invite_codes
    FOR SELECT TO authenticated USING (true);

-- RLS Policies for user_access (users can only see own records)
CREATE POLICY "Users can view own access status" ON user_access
    FOR SELECT TO authenticated USING (user_id = (
        SELECT id FROM users WHERE auth_id = auth.jwt() ->> 'sub' AND auth_provider = 'privy'
    ));

-- RLS Policies for waitlist (no user access)
CREATE POLICY "Service role can manage waitlist" ON waitlist
    FOR ALL TO service_role USING (true);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed some initial invite codes for alpha testing
INSERT INTO invite_codes (code, status) VALUES
    ('ALPHA001', 'unused'),
    ('ALPHA002', 'unused'),
    ('ALPHA003', 'unused'),
    ('ALPHA004', 'unused'),
    ('ALPHA005', 'unused');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Veritas Protocol Schema Initialized';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables: 13';
    RAISE NOTICE 'Functions: 14';
    RAISE NOTICE 'RLS Policies: 3';
    RAISE NOTICE 'Seed Data: 5 invite codes';
    RAISE NOTICE '========================================';
END $$;

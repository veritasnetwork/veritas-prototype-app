-- ============================================================================
-- Solana Integration Migration
-- ============================================================================
-- This migration refactors the database to use Solana addresses as primary
-- identity and adds tables for tracking on-chain activity.
--
-- Run this AFTER backing up your database!
-- ============================================================================

-- ============================================================================
-- STEP 1: Add Solana address to agents and prepare for refactor
-- ============================================================================

-- Add solana_address column (nullable initially for migration)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS solana_address TEXT UNIQUE;

-- Add tracking fields
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_deposited NUMERIC DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Remove default stake (no more free money!)
ALTER TABLE agents ALTER COLUMN total_stake SET DEFAULT 0;

-- ============================================================================
-- STEP 2: Create new Solana tracking tables
-- ============================================================================

-- Track ContentPool deployments for beliefs/posts
CREATE TABLE IF NOT EXISTS pool_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

    -- Solana addresses
    pool_address TEXT NOT NULL UNIQUE,
    usdc_vault_address TEXT NOT NULL,
    token_mint_address TEXT NOT NULL,

    -- Deployment info
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_by_agent_id UUID REFERENCES agents(id),
    deployment_tx_signature TEXT UNIQUE,

    -- Curve parameters (cached from chain)
    k_quadratic NUMERIC NOT NULL,
    reserve_cap NUMERIC NOT NULL,
    linear_slope NUMERIC NOT NULL,
    virtual_liquidity NUMERIC NOT NULL,

    -- Current state (synced from chain)
    token_supply NUMERIC DEFAULT 0,
    reserve NUMERIC DEFAULT 0,
    last_synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_deployments_belief ON pool_deployments(belief_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_deployments_post ON pool_deployments(post_id);
CREATE INDEX IF NOT EXISTS idx_pool_deployments_deployed_by ON pool_deployments(deployed_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_pool_deployments_pool_address ON pool_deployments(pool_address);

-- Track deposit events (for future indexer)
CREATE TABLE IF NOT EXISTS custodian_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event data
    depositor_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time TIMESTAMPTZ,
    slot BIGINT,

    -- Indexing metadata
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_credited BOOLEAN DEFAULT FALSE,
    credited_at TIMESTAMPTZ,

    -- Foreign key (nullable for deposits before agent exists)
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deposits_depositor ON custodian_deposits(depositor_address);
CREATE INDEX IF NOT EXISTS idx_deposits_pending ON custodian_deposits(agent_credited) WHERE NOT agent_credited;
CREATE INDEX IF NOT EXISTS idx_deposits_block_time ON custodian_deposits(block_time);
CREATE INDEX IF NOT EXISTS idx_deposits_agent ON custodian_deposits(agent_id);

-- Track withdrawal requests
CREATE TABLE IF NOT EXISTS custodian_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Request details
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    amount_usdc NUMERIC NOT NULL,
    recipient_address TEXT NOT NULL,

    -- Request tracking
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by_user_id UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')) DEFAULT 'pending',

    -- Execution tracking
    tx_signature TEXT UNIQUE,
    processed_at TIMESTAMPTZ,
    block_time TIMESTAMPTZ,

    -- Rejection/failure tracking
    rejection_reason TEXT,
    failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_agent ON custodian_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON custodian_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_at ON custodian_withdrawals(requested_at);

-- ============================================================================
-- STEP 3: Add pool metrics to beliefs table
-- ============================================================================

-- Track relevance changes for pool redistribution
ALTER TABLE beliefs ADD COLUMN IF NOT EXISTS delta_relevance NUMERIC;

-- Certainty from learning assessment (NOT uncertainty!)
ALTER TABLE beliefs ADD COLUMN IF NOT EXISTS certainty NUMERIC CHECK (certainty >= 0 AND certainty <= 1);

-- ============================================================================
-- STEP 4: Create helper functions
-- ============================================================================

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

-- Function to record a pool deployment
CREATE OR REPLACE FUNCTION record_pool_deployment(
    p_post_id UUID,
    p_belief_id UUID,
    p_pool_address TEXT,
    p_vault_address TEXT,
    p_mint_address TEXT,
    p_deployed_by_agent_id UUID,
    p_tx_signature TEXT,
    p_k_quadratic NUMERIC,
    p_reserve_cap NUMERIC,
    p_linear_slope NUMERIC,
    p_virtual_liquidity NUMERIC
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
        k_quadratic,
        reserve_cap,
        linear_slope,
        virtual_liquidity
    ) VALUES (
        p_post_id,
        p_belief_id,
        p_pool_address,
        p_vault_address,
        p_mint_address,
        p_deployed_by_agent_id,
        p_tx_signature,
        p_k_quadratic,
        p_reserve_cap,
        p_linear_slope,
        p_virtual_liquidity
    ) RETURNING id INTO v_deployment_id;

    RETURN v_deployment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ============================================================================
-- STEP 5: Add indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_beliefs_delta_relevance ON beliefs(delta_relevance) WHERE delta_relevance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_beliefs_certainty ON beliefs(certainty) WHERE certainty IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_solana_address ON agents(solana_address);
CREATE INDEX IF NOT EXISTS idx_agents_last_synced ON agents(last_synced_at);

-- ============================================================================
-- STEP 6: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE pool_deployments IS 'Tracks ContentPool deployments on Solana for each belief/post';
COMMENT ON TABLE custodian_deposits IS 'Event log for USDC deposits into VeritasCustodian contracts (indexed via webhook)';
COMMENT ON TABLE custodian_withdrawals IS 'Withdrawal requests and execution status';
COMMENT ON COLUMN agents.solana_address IS 'User''s Solana wallet address - will become primary key in future migration';
COMMENT ON COLUMN agents.total_deposited IS 'Total USDC deposited into custodian (all time)';
COMMENT ON COLUMN agents.total_withdrawn IS 'Total USDC withdrawn from custodian (all time)';
COMMENT ON COLUMN agents.last_synced_at IS 'Last time total_stake was synced from on-chain custodian';
COMMENT ON COLUMN beliefs.delta_relevance IS 'Change in aggregate belief from previous epoch (used for pool redistribution)';
COMMENT ON COLUMN beliefs.certainty IS 'Certainty metric from learning assessment (NOT uncertainty)';

-- ============================================================================
-- Migration complete!
-- ============================================================================

-- Next steps:
-- 1. Deploy Solana smart contracts
-- 2. Create edge function for manual stake sync
-- 3. Create edge function for pool deployment
-- 4. Update epoch processing to calculate certainty and delta_relevance
-- 5. (Later) Set up Helius webhook for automatic deposit indexing

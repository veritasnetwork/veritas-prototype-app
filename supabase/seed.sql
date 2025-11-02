-- Seed data for Veritas Protocol
-- This file runs AFTER all migrations to populate initial configuration data
-- Reference: https://supabase.com/docs/guides/cli/seeding-your-database

-- =============================================================================
-- SYSTEM CONFIGURATION
-- =============================================================================

INSERT INTO system_config (key, value, description)
VALUES
    -- Protocol Core
    ('current_epoch', '0', 'Global epoch counter for protocol processing'),
    ('epoch_duration_seconds', '3600', 'Duration of each epoch in seconds (3600 = 1 hour, 30 for testing)'),
    ('epoch_processing_enabled', 'false', 'Whether automatic epoch processing is enabled'),
    ('epoch_processing_trigger', 'manual', 'How epochs are triggered: manual or event-driven'),

    -- Belief Market Rules
    ('min_participants_for_scoring', '2', 'Minimum participants required for BTS scoring'),
    ('min_stake_per_belief', '0.5', 'Minimum stake allocated per belief (USD)'),
    ('initial_agent_stake', '10000.0', 'Default stake amount for new agents (USD) - $10k for alpha'),
    ('max_beliefs_per_agent', '1000', 'Maximum number of beliefs per agent'),
    ('max_agents_per_belief', '10000', 'Maximum number of agents per belief market'),

    -- Epoch Timing
    ('current_epoch_start_time', '2025-09-15T10:00:00.000Z', 'Timestamp of first epoch start'),
    ('next_epoch_deadline', '2025-09-15T11:00:00.000Z', 'Next scheduled epoch target time'),

    -- System Environment
    ('deployment_environment', 'supabase', 'Deployment environment: supabase or local'),

    -- Pool Redistribution
    ('base_skim_rate', '0.01', 'Base penalty rate for pools with zero delta_relevance (1% = 0.01)'),
    ('epoch_rollover_balance', '0', 'Accumulated penalty pot from epochs with no winning pools'),

    -- Rebase & Settlement
    ('min_new_submissions_for_rebase', '5', 'Minimum number of new unique belief submissions required since last settlement to allow rebase'),
    ('settlement_cooldown_seconds', '14400', 'Minimum time (in seconds) between settlements - 4 hours by default'),

    -- Trading & Slippage
    ('max_slippage_basis_points', '500', 'Maximum allowed slippage in basis points (500 = 5%)'),
    ('default_slippage_bps', '100', 'Default slippage tolerance for trades in basis points (100 = 1%)'),
    ('trading_fee_bps', '50', 'Trading fee in basis points (50 = 0.5%)'),
    ('trading_fee_basis_points', '30', 'Trading fee in basis points (30 = 0.3%)'),
    ('creator_split_bps', '10000', 'Percentage of trading fees allocated to post creators (10000 = 100%)')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

-- Create veritas-media bucket for post images and videos (public for read access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('veritas-media', 'veritas-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create profile-photos bucket for user profile images (public for read access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
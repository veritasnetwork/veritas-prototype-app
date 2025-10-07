-- Initial database schema for Veritas Protocol
-- Run order: system_config -> agents -> users

-- System configuration table
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial configuration values
INSERT INTO system_config (key, value) VALUES
    ('current_epoch', '0'),
    ('epoch_duration_seconds', '3600'),
    ('epoch_processing_enabled', 'false'),
    ('epoch_processing_trigger', 'cron'),
    ('min_participants_for_scoring', '2'),
    ('min_stake_per_belief', '0.5'),
    ('initial_agent_stake', '100.0'),
    ('min_belief_duration', '5'),
    ('max_belief_duration', '100'),
    ('max_beliefs_per_agent', '1000'),
    ('max_agents_per_belief', '10000');

-- Protocol agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_stake DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    active_belief_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application users table  
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    auth_provider TEXT NULL,
    auth_id TEXT NULL,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT NULL,
    avatar_url TEXT NULL,
    total_stake DECIMAL(10,2) NOT NULL DEFAULT 100.00, -- cached from agent
    beliefs_created INTEGER NOT NULL DEFAULT 0,
    beliefs_participated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_agent_id ON users(agent_id);
CREATE INDEX idx_system_config_key ON system_config(key);

-- Add constraints
ALTER TABLE users ADD CONSTRAINT users_username_length CHECK (char_length(username) BETWEEN 2 AND 50);
ALTER TABLE agents ADD CONSTRAINT agents_total_stake_positive CHECK (total_stake >= 0);
ALTER TABLE agents ADD CONSTRAINT agents_belief_count_non_negative CHECK (active_belief_count >= 0);
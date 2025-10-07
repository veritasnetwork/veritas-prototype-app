-- ============================================================================
-- Pool Redistribution Config Values
-- ============================================================================
-- Adds configuration values needed for the pool redistribution service
-- ============================================================================

-- Create configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert pool redistribution config values
INSERT INTO configs (key, value, description)
VALUES
    ('base_skim_rate', '0.01', 'Base penalty rate for pools with zero delta_relevance (1% = 0.01)')
ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = NOW();

INSERT INTO configs (key, value, description)
VALUES
    ('epoch_rollover_balance', '0', 'Accumulated penalty pot from epochs with no winning pools')
ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = NOW();

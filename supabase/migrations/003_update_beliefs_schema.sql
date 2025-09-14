-- Update beliefs table to match low-level specification
-- Drop old structure and create new one based on belief creation spec

DROP TABLE IF EXISTS beliefs CASCADE;

CREATE TABLE beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_epoch INTEGER NOT NULL DEFAULT 0,
    expiration_epoch INTEGER NOT NULL,
    previous_aggregate DECIMAL(10,8) NOT NULL CHECK (previous_aggregate >= 0 AND previous_aggregate <= 1),
    previous_disagreement_entropy DECIMAL(10,8) NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'processed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create belief_submissions table per specification
CREATE TABLE belief_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
    belief DECIMAL(10,8) NOT NULL CHECK (belief >= 0 AND belief <= 1),
    meta_prediction DECIMAL(10,8) NOT NULL CHECK (meta_prediction >= 0 AND meta_prediction <= 1),
    epoch INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, belief_id)
);

-- Update posts table to reference beliefs properly
ALTER TABLE posts DROP COLUMN IF EXISTS opinion_belief_id;
ALTER TABLE posts ADD COLUMN opinion_belief_id UUID REFERENCES beliefs(id) ON DELETE SET NULL;
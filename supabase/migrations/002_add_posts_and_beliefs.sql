-- Add posts and beliefs tables for opinion post creation
-- Run order: beliefs -> posts (posts reference beliefs)

-- Protocol beliefs table
CREATE TABLE beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    belief_value DECIMAL(5,4) NOT NULL CHECK (belief_value >= 0 AND belief_value <= 1),
    meta_prediction DECIMAL(5,4) NOT NULL CHECK (meta_prediction >= 0 AND meta_prediction <= 1),
    stake_allocated DECIMAL(10,2) NOT NULL CHECK (stake_allocated >= 0),
    expires_at_epoch INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'processed')),
    participant_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opinion_belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    media_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_beliefs_creator_agent ON beliefs(creator_agent_id);
CREATE INDEX idx_beliefs_status ON beliefs(status);
CREATE INDEX idx_beliefs_expires_at_epoch ON beliefs(expires_at_epoch);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_belief_id ON posts(opinion_belief_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
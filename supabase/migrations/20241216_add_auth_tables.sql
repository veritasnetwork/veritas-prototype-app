-- Add authentication and access control tables
-- Run: supabase db reset or supabase migration up

-- Create invite codes table for alpha access control
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
  created_by_user_id UUID REFERENCES users(id),
  used_by_user_id UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT invite_codes_used_fields_consistent
    CHECK ((status = 'used') = (used_by_user_id IS NOT NULL AND used_at IS NOT NULL))
);

-- Create user access tracking table
CREATE TABLE user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'activated')),
  invite_code_used TEXT REFERENCES invite_codes(code),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT user_access_activated_fields_consistent
    CHECK ((status = 'activated') = (activated_at IS NOT NULL))
);

-- Create waitlist table for email collection
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited')),
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT waitlist_invited_fields_consistent
    CHECK ((status = 'invited') = (invited_at IS NOT NULL))
);

-- Update system config for $10k starting stake
UPDATE system_config
SET value = '10000.0', updated_at = NOW()
WHERE key = 'initial_agent_stake';

-- Enable Row Level Security
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

-- Create indexes for performance
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_status ON invite_codes(status);
CREATE INDEX idx_user_access_user_id ON user_access(user_id);
CREATE INDEX idx_user_access_status ON user_access(status);
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- Seed some initial invite codes for testing
INSERT INTO invite_codes (code, status) VALUES
  ('ALPHA001', 'unused'),
  ('ALPHA002', 'unused'),
  ('ALPHA003', 'unused'),
  ('ALPHA004', 'unused'),
  ('ALPHA005', 'unused');

-- Add comment for migration tracking
COMMENT ON TABLE invite_codes IS 'Alpha access control via invite codes';
COMMENT ON TABLE user_access IS 'Tracks user activation status and invite usage';
COMMENT ON TABLE waitlist IS 'Email collection for future alpha invites';
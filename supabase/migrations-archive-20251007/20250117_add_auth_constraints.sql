-- Add unique constraint for auth credentials
-- This allows uniqueness check when both auth_provider and auth_id are provided
-- NULL values are allowed but the combination must be unique when present

-- Add unique constraint on (auth_provider, auth_id) combination
-- This constraint allows NULL values but ensures uniqueness when both fields have values
ALTER TABLE users ADD CONSTRAINT users_auth_credentials_unique
  UNIQUE (auth_provider, auth_id);

-- Add index for performance on auth lookups
CREATE INDEX idx_users_auth_credentials ON users(auth_provider, auth_id)
  WHERE auth_provider IS NOT NULL AND auth_id IS NOT NULL;

-- Comment for migration tracking
COMMENT ON CONSTRAINT users_auth_credentials_unique ON users IS
  'Ensures unique auth credentials per provider';
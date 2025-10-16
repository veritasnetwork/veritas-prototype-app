-- ============================================================================
-- Remove Invite/Waitlist System
-- ============================================================================
-- Removes all invite code, user_access, and waitlist tables and related
-- infrastructure. Authentication is now handled purely via Privy.
-- ============================================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can view own access status" ON user_access;
DROP POLICY IF EXISTS "Service role can manage waitlist" ON waitlist;

-- Drop indexes
DROP INDEX IF EXISTS idx_invite_codes_code;
DROP INDEX IF EXISTS idx_invite_codes_status;
DROP INDEX IF EXISTS idx_user_access_user_id;
DROP INDEX IF EXISTS idx_user_access_status;
DROP INDEX IF EXISTS idx_waitlist_email;
DROP INDEX IF EXISTS idx_waitlist_status;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS user_access CASCADE;
DROP TABLE IF EXISTS invite_codes CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;

-- Note: No changes needed to users or agents tables
-- They already support Privy-only authentication

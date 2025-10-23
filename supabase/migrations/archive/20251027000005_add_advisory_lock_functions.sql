-- Advisory lock wrapper functions for Supabase RPC
-- These wrap PostgreSQL's native pg_advisory_lock/unlock functions

CREATE OR REPLACE FUNCTION pg_advisory_lock(lock_id BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM pg_advisory_lock(lock_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_advisory_unlock(lock_id BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM pg_advisory_unlock(lock_id);
END;
$$ LANGUAGE plpgsql;

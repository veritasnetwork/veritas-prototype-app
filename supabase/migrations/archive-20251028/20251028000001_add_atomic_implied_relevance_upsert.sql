-- Add atomic function for upserting implied relevance with proper recorded_by handling
-- This ensures the recorded_by field is set correctly when both server and indexer record

CREATE OR REPLACE FUNCTION upsert_implied_relevance_indexer(
  p_post_id uuid,
  p_belief_id uuid,
  p_implied_relevance numeric,
  p_reserve_long numeric,
  p_reserve_short numeric,
  p_event_type text,
  p_event_reference text,
  p_recorded_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update with atomic logic for recorded_by field
  INSERT INTO implied_relevance_history (
    post_id,
    belief_id,
    implied_relevance,
    reserve_long,
    reserve_short,
    event_type,
    event_reference,
    confirmed,
    recorded_by,
    recorded_at
  ) VALUES (
    p_post_id,
    p_belief_id,
    p_implied_relevance,
    p_reserve_long,
    p_reserve_short,
    p_event_type,
    p_event_reference,
    true,  -- Indexer always confirms
    'indexer',  -- Initial value
    p_recorded_at
  )
  ON CONFLICT (event_reference) DO UPDATE SET
    -- Update to confirmed values from blockchain
    implied_relevance = EXCLUDED.implied_relevance,
    reserve_long = EXCLUDED.reserve_long,
    reserve_short = EXCLUDED.reserve_short,
    confirmed = true,
    -- Set recorded_by to 'both' if server already recorded, otherwise 'indexer'
    recorded_by = CASE
      WHEN implied_relevance_history.recorded_by = 'server' THEN 'both'
      ELSE 'indexer'
    END,
    recorded_at = EXCLUDED.recorded_at;
END;
$$;

COMMENT ON FUNCTION upsert_implied_relevance_indexer IS
'Atomically upserts implied relevance from event indexer with proper conflict handling for recorded_by field';

-- Server-side upsert function (does NOT overwrite if indexer already confirmed)
CREATE OR REPLACE FUNCTION upsert_implied_relevance_server(
  p_post_id uuid,
  p_belief_id uuid,
  p_implied_relevance numeric,
  p_reserve_long numeric,
  p_reserve_short numeric,
  p_event_type text,
  p_event_reference text,
  p_recorded_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update, but don't overwrite confirmed indexer data
  INSERT INTO implied_relevance_history (
    post_id,
    belief_id,
    implied_relevance,
    reserve_long,
    reserve_short,
    event_type,
    event_reference,
    confirmed,
    recorded_by,
    recorded_at
  ) VALUES (
    p_post_id,
    p_belief_id,
    p_implied_relevance,
    p_reserve_long,
    p_reserve_short,
    p_event_type,
    p_event_reference,
    false,  -- Server records optimistically
    'server',
    p_recorded_at
  )
  ON CONFLICT (event_reference) DO UPDATE SET
    -- Only update if indexer hasn't confirmed yet
    -- If indexer already confirmed, just update recorded_by to 'both'
    recorded_by = CASE
      WHEN implied_relevance_history.confirmed = true THEN 'both'
      ELSE 'server'
    END;
    -- Don't update other fields if indexer already confirmed
END;
$$;

COMMENT ON FUNCTION upsert_implied_relevance_server IS
'Atomically upserts implied relevance from server without overwriting confirmed indexer data';

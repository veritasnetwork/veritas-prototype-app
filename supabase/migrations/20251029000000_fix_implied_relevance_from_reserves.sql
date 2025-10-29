-- Fix implied relevance records that were incorrectly calculated from market cap instead of reserves
-- The correct formula is: implied_relevance = r_long / (r_long + r_short)

-- First, update all trade events where reserves are available
UPDATE implied_relevance_history
SET implied_relevance = CASE
    WHEN (reserve_long + reserve_short) > 0 THEN reserve_long / (reserve_long + reserve_short)
    ELSE 0.5
END
WHERE event_type = 'trade'
  AND reserve_long IS NOT NULL
  AND reserve_short IS NOT NULL;

-- Update rebase events as well
UPDATE implied_relevance_history
SET implied_relevance = CASE
    WHEN (reserve_long + reserve_short) > 0 THEN reserve_long / (reserve_long + reserve_short)
    ELSE 0.5
END
WHERE event_type = 'rebase'
  AND reserve_long IS NOT NULL
  AND reserve_short IS NOT NULL;

-- For deployment events, recalculate from pool_deployments if available
WITH pool_reserves AS (
    SELECT
        pd.post_id,
        pd.r_long,
        pd.r_short,
        CASE
            WHEN (pd.r_long + pd.r_short) > 0 THEN pd.r_long / (pd.r_long + pd.r_short)
            ELSE 0.5
        END as correct_implied_relevance
    FROM pool_deployments pd
    WHERE pd.r_long IS NOT NULL
      AND pd.r_short IS NOT NULL
)
UPDATE implied_relevance_history ih
SET
    reserve_long = pr.r_long,
    reserve_short = pr.r_short,
    implied_relevance = pr.correct_implied_relevance
FROM pool_reserves pr
WHERE ih.post_id = pr.post_id
  AND ih.event_type = 'deployment';
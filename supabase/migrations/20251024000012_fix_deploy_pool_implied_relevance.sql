-- Fix deploy_pool_with_lock to correctly calculate implied relevance from actual pool state
-- The previous version hardcoded 0.5 (50%) relevance, but imbalanced pools have different initial relevance

-- Drop and recreate the function with proper reserve calculation
DROP FUNCTION IF EXISTS deploy_pool_with_lock CASCADE;

CREATE OR REPLACE FUNCTION deploy_pool_with_lock(
  p_post_id uuid,
  p_belief_id uuid,
  p_pool_address text,
  p_token_supply numeric,
  p_reserve numeric,
  p_f integer,
  p_beta_num integer,
  p_beta_den integer,
  p_long_mint_address text,
  p_short_mint_address text,
  p_s_long_supply numeric,
  p_s_short_supply numeric,
  p_sqrt_price_long_x96 text,
  p_sqrt_price_short_x96 text,
  p_vault_balance numeric,
  p_deployment_tx_signature text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_result boolean;
  v_reserve_long numeric;
  v_reserve_short numeric;
  v_implied_relevance numeric;
  v_price_long numeric;
  v_price_short numeric;
  Q96 numeric := POWER(2, 96);
BEGIN
  -- 1. Acquire advisory lock on the post_id to prevent concurrent deployments
  v_lock_result := pg_try_advisory_xact_lock(('x' || translate(p_post_id::text, '-', ''))::bit(64)::bigint);

  IF NOT v_lock_result THEN
    RAISE EXCEPTION 'Another deployment is in progress for this post';
  END IF;

  -- 2. Check if already deployed
  IF EXISTS (
    SELECT 1 FROM pool_deployments WHERE post_id = p_post_id
  ) THEN
    RAISE EXCEPTION 'Pool already deployed for this post';
  END IF;

  -- 3. Insert the pool deployment record
  INSERT INTO pool_deployments (
    post_id,
    belief_id,
    pool_address,
    token_supply,
    reserve,
    f,
    beta_num,
    beta_den,
    long_mint_address,
    short_mint_address,
    s_long_supply,
    s_short_supply,
    sqrt_price_long_x96,
    sqrt_price_short_x96,
    vault_balance,
    deployment_tx_signature,
    deployed_at
  ) VALUES (
    p_post_id,
    p_belief_id,
    p_pool_address,
    p_token_supply,
    p_reserve,
    p_f,
    p_beta_num,
    p_beta_den,
    p_long_mint_address,
    p_short_mint_address,
    p_s_long_supply,
    p_s_short_supply,
    p_sqrt_price_long_x96,
    p_sqrt_price_short_x96,
    p_vault_balance,
    p_deployment_tx_signature,
    NOW()
  );

  -- 4. Update belief status
  UPDATE beliefs
  SET
    status = 'market_deployed',
    deployed_at = COALESCE(pool_deployments.deployed_at, NOW())
  FROM pool_deployments
  WHERE beliefs.id = p_belief_id
    AND pool_deployments.post_id = p_post_id;

  -- 5. Calculate actual reserves from supply and price for ICBS pools
  -- For ICBS: Reserve = Supply * Price
  -- Price is derived from sqrt_price_x96: price = (sqrt_price_x96 / 2^96)^2

  -- Calculate prices from sqrt prices
  v_price_long := POWER((p_sqrt_price_long_x96::numeric / Q96), 2);
  v_price_short := POWER((p_sqrt_price_short_x96::numeric / Q96), 2);

  -- Calculate reserves (R = S * P)
  v_reserve_long := p_s_long_supply * v_price_long;
  v_reserve_short := p_s_short_supply * v_price_short;

  -- Calculate implied relevance from actual reserves
  v_implied_relevance := calculate_implied_relevance(v_reserve_long, v_reserve_short);

  -- 6. Record initial implied relevance with actual values
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
    v_implied_relevance,
    v_reserve_long,
    v_reserve_short,
    'deployment',
    p_pool_address,  -- Use pool address as event reference for deployments
    false,
    'server',
    NOW()
  )
  ON CONFLICT (event_reference) DO NOTHING;  -- Idempotent

  -- 7. Update post status (if needed)
  UPDATE posts
  SET
    status = 'market_deployed',
    updated_at = NOW()
  WHERE id = p_post_id;

END;
$$;

COMMENT ON FUNCTION deploy_pool_with_lock IS 'Records pool deployment with advisory locking and calculates correct initial implied relevance from actual pool state';

-- Fix existing incorrect implied relevance entries for deployments
-- This updates any deployment entries that have 0.5 relevance to use the correct calculated value
UPDATE implied_relevance_history irh
SET
  implied_relevance = calculate_implied_relevance(
    (pd.s_long_supply::numeric * POWER((pd.sqrt_price_long_x96::numeric / POWER(2::numeric, 96::numeric)), 2::numeric))::numeric,
    (pd.s_short_supply::numeric * POWER((pd.sqrt_price_short_x96::numeric / POWER(2::numeric, 96::numeric)), 2::numeric))::numeric
  ),
  reserve_long = (pd.s_long_supply::numeric * POWER((pd.sqrt_price_long_x96::numeric / POWER(2::numeric, 96::numeric)), 2::numeric))::numeric,
  reserve_short = (pd.s_short_supply::numeric * POWER((pd.sqrt_price_short_x96::numeric / POWER(2::numeric, 96::numeric)), 2::numeric))::numeric
FROM pool_deployments pd
WHERE irh.post_id = pd.post_id
  AND irh.event_type = 'deployment'
  AND irh.implied_relevance = 0.5  -- Only fix the hardcoded 0.5 values
  AND pd.sqrt_price_long_x96 IS NOT NULL
  AND pd.sqrt_price_short_x96 IS NOT NULL;
-- Fix deploy_pool_with_lock to set status='market_deployed' instead of default 'pool_created'
-- This prevents a race condition where trades are blocked if they happen before the MarketDeployedEvent is indexed

CREATE OR REPLACE FUNCTION "public"."deploy_pool_with_lock"(
  "p_post_id" "uuid",
  "p_belief_id" "uuid",
  "p_pool_address" "text",
  "p_token_supply" numeric,
  "p_reserve" numeric,
  "p_f" integer,
  "p_beta_num" integer,
  "p_beta_den" integer,
  "p_long_mint_address" "text",
  "p_short_mint_address" "text",
  "p_s_long_supply" numeric,
  "p_s_short_supply" numeric,
  "p_sqrt_price_long_x96" "text",
  "p_sqrt_price_short_x96" "text",
  "p_vault_balance" numeric,
  "p_deployment_tx_signature" "text" DEFAULT NULL::"text",
  "p_deployer_user_id" "uuid" DEFAULT NULL::"uuid",
  "p_s_scale_long_q64" numeric DEFAULT NULL::numeric,
  "p_s_scale_short_q64" numeric DEFAULT NULL::numeric
) RETURNS "void"
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_reserve_long numeric;
  v_reserve_short numeric;
  v_implied_relevance numeric;
  v_price_long numeric;
  v_price_short numeric;
  v_long_supply_display numeric;
  v_short_supply_display numeric;
  v_pool_exists boolean;
  Q64 numeric := POWER(2, 64);
  Q96 numeric := POWER(2, 96);
BEGIN
  -- Validation: Check required parameters
  IF p_post_id IS NULL OR p_belief_id IS NULL OR p_pool_address IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters: post_id, belief_id, or pool_address';
  END IF;

  IF p_long_mint_address IS NULL OR p_short_mint_address IS NULL THEN
    RAISE EXCEPTION 'Missing required mint addresses';
  END IF;

  -- Convert atomic to display for holdings (divide by 1e6)
  v_long_supply_display := p_s_long_supply / 1000000;
  v_short_supply_display := p_s_short_supply / 1000000;

  -- Check if pool already exists
  SELECT EXISTS(SELECT 1 FROM pool_deployments WHERE post_id = p_post_id) INTO v_pool_exists;

  IF v_pool_exists THEN
    -- Pool already exists - update with latest chain data if provided
    -- This makes the function idempotent: can be called by both API route and event indexer
    UPDATE pool_deployments
    SET
      sqrt_price_long_x96 = COALESCE(p_sqrt_price_long_x96, sqrt_price_long_x96),
      sqrt_price_short_x96 = COALESCE(p_sqrt_price_short_x96, sqrt_price_short_x96),
      s_long_supply = COALESCE(p_s_long_supply, s_long_supply),
      s_short_supply = COALESCE(p_s_short_supply, s_short_supply),
      vault_balance = COALESCE(p_vault_balance, vault_balance),
      s_scale_long_q64 = COALESCE(p_s_scale_long_q64, s_scale_long_q64),
      s_scale_short_q64 = COALESCE(p_s_scale_short_q64, s_scale_short_q64),
      -- FIX: Also update status to market_deployed if it's still pool_created
      status = CASE WHEN status = 'pool_created' THEN 'market_deployed' ELSE status END,
      market_deployed_at = CASE WHEN status = 'pool_created' AND market_deployed_at IS NULL THEN NOW() ELSE market_deployed_at END,
      last_synced_at = NOW()
    WHERE post_id = p_post_id;

    -- Silently return - pool already exists and has been updated
    RETURN;
  END IF;

  -- Pool doesn't exist - insert new record
  -- FIX: Set status='market_deployed' since this function is only called AFTER deployment
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
    s_scale_long_q64,
    s_scale_short_q64,
    vault_balance,
    deployment_tx_signature,
    deployed_at,
    status,
    market_deployed_at
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
    COALESCE(p_s_scale_long_q64, Q64),
    COALESCE(p_s_scale_short_q64, Q64),
    p_vault_balance,
    p_deployment_tx_signature,
    NOW(),
    'market_deployed',  -- FIX: Set to market_deployed immediately
    NOW()               -- FIX: Set market_deployed_at timestamp
  );

  -- Note: beliefs table doesn't have status or deployed_at columns
  -- These were removed in schema cleanup

  -- Calculate actual reserves from supply and price for ICBS pools
  IF p_sqrt_price_long_x96 IS NOT NULL
     AND p_sqrt_price_short_x96 IS NOT NULL
     AND p_sqrt_price_long_x96 != '0'
     AND p_sqrt_price_short_x96 != '0' THEN

    BEGIN
      v_price_long := POWER((p_sqrt_price_long_x96::numeric / Q96), 2);
      v_price_short := POWER((p_sqrt_price_short_x96::numeric / Q96), 2);

      -- Use display supply for price calculations
      v_reserve_long := v_long_supply_display * v_price_long;
      v_reserve_short := v_short_supply_display * v_price_short;

      v_implied_relevance := calculate_implied_relevance(v_reserve_long, v_reserve_short);

      -- Record initial implied relevance (idempotent via ON CONFLICT)
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
        p_pool_address,
        false,
        'server',
        NOW()
      )
      ON CONFLICT (event_reference) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to calculate implied relevance: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'Missing or invalid sqrt prices, skipping implied relevance calculation';
  END IF;

  -- Note: posts table doesn't have status column
  -- These were removed in schema cleanup

  -- Create initial holdings for deployer (idempotent via ON CONFLICT)
  -- user_pool_balances has separate rows for LONG and SHORT tokens
  IF p_deployer_user_id IS NOT NULL THEN
    -- Create LONG token balance (idempotent)
    INSERT INTO user_pool_balances (
      user_id,
      pool_address,
      post_id,
      token_balance,
      token_type,
      belief_lock
    ) VALUES (
      p_deployer_user_id,
      p_pool_address,
      p_post_id,
      v_long_supply_display,
      'LONG',
      0
    )
    ON CONFLICT (user_id, pool_address, token_type) DO UPDATE
    SET
      token_balance = user_pool_balances.token_balance + v_long_supply_display,
      updated_at = NOW();

    -- Create SHORT token balance (idempotent)
    INSERT INTO user_pool_balances (
      user_id,
      pool_address,
      post_id,
      token_balance,
      token_type,
      belief_lock
    ) VALUES (
      p_deployer_user_id,
      p_pool_address,
      p_post_id,
      v_short_supply_display,
      'SHORT',
      0
    )
    ON CONFLICT (user_id, pool_address, token_type) DO UPDATE
    SET
      token_balance = user_pool_balances.token_balance + v_short_supply_display,
      updated_at = NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION "public"."deploy_pool_with_lock" IS
'Records pool deployment with full idempotency. Can be called multiple times safely by both API route (immediate) and event indexer (async). Updates existing pool data if already exists. Sets status to market_deployed immediately to prevent race conditions.';

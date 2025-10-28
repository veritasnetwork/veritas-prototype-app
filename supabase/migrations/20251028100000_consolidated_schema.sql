
\restrict VDnfSQzrrRfaxtTvLJcjr0mzsDbiUCaTfECsNcavUz4maVGvYx5OFgJxpfPAEOy


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update agent's total stake (in micro-USDC)
    UPDATE agents
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE id = p_agent_id;
END;
$$;


ALTER FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint) IS 'Add stake to agent total_stake. Amount is in micro-USDC (bigint).';



CREATE OR REPLACE FUNCTION "public"."calculate_entry_price"("p_user_id" "uuid", "p_pool_address" "text", "p_token_type" "text") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_total_cost numeric := 0;
  v_total_tokens numeric := 0;
  v_current_avg_price numeric := 0;
  v_current_position numeric := 0;
  trade_record RECORD;
BEGIN
  -- Process all trades in chronological order
  FOR trade_record IN
    SELECT
      trade_type,
      side,
      token_amount,
      usdc_amount / 1000000.0 as usdc_amount_display, -- Convert from lamports to display units
      CASE
        WHEN side = 'LONG' THEN price_long
        WHEN side = 'SHORT' THEN price_short
        ELSE 0
      END as price_at_trade,
      recorded_at
    FROM trades
    WHERE
      user_id = p_user_id
      AND pool_address = p_pool_address
      AND side = p_token_type
      AND confirmed = true
    ORDER BY recorded_at ASC, created_at ASC
  LOOP
    IF trade_record.trade_type = 'buy' THEN
      -- Add to position with weighted average
      v_total_cost := v_total_cost + trade_record.usdc_amount_display;
      v_total_tokens := v_total_tokens + trade_record.token_amount;

      -- Update average price
      IF v_total_tokens > 0 THEN
        v_current_avg_price := v_total_cost / v_total_tokens;
      END IF;

    ELSIF trade_record.trade_type = 'sell' THEN
      -- Reduce position but keep average price the same
      v_total_tokens := v_total_tokens - trade_record.token_amount;

      -- Reduce cost proportionally
      IF v_total_tokens > 0 THEN
        v_total_cost := v_total_tokens * v_current_avg_price;
      ELSE
        -- Position closed completely
        v_total_cost := 0;
        v_current_avg_price := 0;
      END IF;
    END IF;
  END LOOP;

  -- Return the average entry price
  -- If position is closed or no trades, return 0
  IF v_total_tokens > 0 AND v_total_cost > 0 THEN
    RETURN v_total_cost / v_total_tokens;
  ELSE
    RETURN 0;
  END IF;
END;
$$;


ALTER FUNCTION "public"."calculate_entry_price"("p_user_id" "uuid", "p_pool_address" "text", "p_token_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_entry_price"("p_user_id" "uuid", "p_pool_address" "text", "p_token_type" "text") IS 'Calculates weighted average entry price for a user position using average cost basis method. Processes trades chronologically, adding cost on buys and reducing proportionally on sells.';



CREATE OR REPLACE FUNCTION "public"."calculate_implied_relevance"("p_reserve_long" numeric, "p_reserve_short" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Implied relevance = reserve_long / (reserve_long + reserve_short)
  -- This represents what the market thinks the relevance is (0-1 scale)
  IF (p_reserve_long + p_reserve_short) = 0 THEN
    RETURN 0.5; -- Neutral if no reserves
  END IF;

  RETURN p_reserve_long / (p_reserve_long + p_reserve_short);
END;
$$;


ALTER FUNCTION "public"."calculate_implied_relevance"("p_reserve_long" numeric, "p_reserve_short" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_implied_relevance"("p_reserve_long" numeric, "p_reserve_short" numeric) IS 'Calculates market-implied relevance from reserve ratio: reserve_long / (reserve_long + reserve_short)';



CREATE OR REPLACE FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) RETURNS TABLE("skim_amount" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_stake BIGINT;
  v_total_locks BIGINT;
  v_old_lock_this_side BIGINT;
  v_new_lock BIGINT;
  v_required_locks BIGINT;
BEGIN
  -- Get current stake
  SELECT COALESCE(total_stake, 0) INTO v_current_stake
  FROM agents WHERE solana_address = p_wallet_address FOR UPDATE;

  -- Get sum of all belief locks for open positions
  SELECT COALESCE(SUM(belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances
  WHERE user_id = p_user_id AND token_balance > 0;

  -- Get current lock for this specific pool/side (to be replaced)
  SELECT belief_lock INTO v_old_lock_this_side
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_side;

  -- If no row found, v_old_lock_this_side will be NULL, so set to 0
  v_old_lock_this_side := COALESCE(v_old_lock_this_side, 0);

  -- Calculate new lock for this trade (2% of trade amount = divide by 50)
  v_new_lock := (p_trade_amount_micro / 50)::BIGINT;

  -- Calculate required locks after this trade
  -- (all existing locks - old lock for this side + new lock for this side)
  v_required_locks := v_total_locks - v_old_lock_this_side + v_new_lock;

  -- Return skim = max(0, required - current)
  RETURN QUERY SELECT GREATEST(0::BIGINT, v_required_locks - v_current_stake);
END;
$$;


ALTER FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_skim_with_lock_readonly"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) RETURNS TABLE("skim_amount" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_stake BIGINT;
  v_total_locks BIGINT;
  v_old_lock_this_side BIGINT;
  v_new_lock BIGINT;
  v_required_locks BIGINT;
BEGIN
  -- Get current stake (NO LOCK - this is just for estimation)
  SELECT COALESCE(total_stake, 0) INTO v_current_stake
  FROM agents WHERE solana_address = p_wallet_address;

  -- Get sum of all belief locks for open positions
  SELECT COALESCE(SUM(belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances
  WHERE user_id = p_user_id AND token_balance > 0;

  -- Get current lock for this specific pool/side (to be replaced)
  SELECT belief_lock INTO v_old_lock_this_side
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_side;

  -- If no row found, v_old_lock_this_side will be NULL, so set to 0
  v_old_lock_this_side := COALESCE(v_old_lock_this_side, 0);

  -- Calculate new lock for this trade (2% of trade amount = divide by 50)
  v_new_lock := (p_trade_amount_micro / 50)::BIGINT;

  -- Calculate required locks after this trade
  -- (all existing locks - old lock for this side + new lock for this side)
  v_required_locks := v_total_locks - v_old_lock_this_side + v_new_lock;

  -- Return skim = max(0, required - current)
  RETURN QUERY SELECT GREATEST(0::BIGINT, v_required_locks - v_current_stake);
END;
$$;


ALTER FUNCTION "public"."calculate_skim_with_lock_readonly"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_skim_with_lock_readonly"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) IS 'Optimized read-only version of calculate_skim_with_lock for trade preparation. Does not acquire FOR UPDATE lock, allowing parallel reads. Use this during /api/trades/prepare. The original calculate_skim_with_lock (with FOR UPDATE) should only be used during actual trade execution in record_trade_atomic.';



CREATE OR REPLACE FUNCTION "public"."check_all_agents_solvency"() RETURNS TABLE("agent_id" "uuid", "stake_usdc" numeric, "locks_usdc" numeric, "withdrawable_usdc" numeric, "status" "text", "deficit_usdc" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as agent_id,
    a.total_stake / 1000000.0 as stake_usdc,
    COALESCE(SUM(upb.belief_lock), 0) / 1000000.0 as locks_usdc,
    (a.total_stake - COALESCE(SUM(upb.belief_lock), 0)) / 1000000.0 as withdrawable_usdc,
    CASE
      WHEN a.total_stake >= COALESCE(SUM(upb.belief_lock), 0) THEN '✅ SOLVENT'
      ELSE '❌ UNDERWATER'
    END as status,
    CASE
      WHEN a.total_stake < COALESCE(SUM(upb.belief_lock), 0)
      THEN (COALESCE(SUM(upb.belief_lock), 0) - a.total_stake) / 1000000.0
      ELSE 0
    END as deficit_usdc
  FROM agents a
  LEFT JOIN users u ON u.agent_id = a.id
  LEFT JOIN user_pool_balances upb ON upb.user_id = u.id AND upb.token_balance > 0
  GROUP BY a.id, a.total_stake
  ORDER BY deficit_usdc DESC;
END;
$$;


ALTER FUNCTION "public"."check_all_agents_solvency"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_all_agents_solvency"() IS 'Returns solvency status for all agents.
Use this to detect underwater positions across the system.
Returns agents ordered by deficit (worst first).';



CREATE OR REPLACE FUNCTION "public"."check_belief_lock_units"() RETURNS TABLE("pool_address" "text", "token_type" "text", "belief_lock" bigint, "lock_usdc" numeric, "status" "text", "issue" "text")
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    upb.pool_address,
    upb.token_type,
    upb.belief_lock,
    upb.belief_lock / 1000000.0 as lock_usdc,
    CASE
      WHEN upb.belief_lock < 1000 THEN '❌ FAIL'
      WHEN upb.belief_lock > 1000000000 THEN '❌ FAIL'
      ELSE '✅ OK'
    END as status,
    CASE
      WHEN upb.belief_lock < 1000 THEN 'Too small - likely stored as display USDC instead of micro-USDC'
      WHEN upb.belief_lock > 1000000000 THEN 'Too large - exceeds reasonable trade size ($1000)'
      ELSE NULL
    END as issue
  FROM user_pool_balances upb
  WHERE upb.token_balance > 0
  ORDER BY
    CASE
      WHEN upb.belief_lock < 1000 THEN 1
      WHEN upb.belief_lock > 1000000000 THEN 2
      ELSE 3
    END,
    upb.belief_lock;
END;
$_$;


ALTER FUNCTION "public"."check_belief_lock_units"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_belief_lock_units"() IS 'Validates that all belief_lock values are in the correct unit range.
Detects units mismatch bugs (display USDC vs micro-USDC).
Returns problematic locks first.';



CREATE OR REPLACE FUNCTION "public"."check_redistribution_zero_sum"("p_belief_id" "uuid", "p_epoch" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_total_delta bigint;
  v_participant_count integer;
  v_total_rewards bigint;
  v_total_slashes bigint;
BEGIN
  SELECT
    SUM(stake_delta),
    COUNT(DISTINCT agent_id),
    SUM(CASE WHEN stake_delta > 0 THEN stake_delta ELSE 0 END),
    SUM(CASE WHEN stake_delta < 0 THEN ABS(stake_delta) ELSE 0 END)
  INTO v_total_delta, v_participant_count, v_total_rewards, v_total_slashes
  FROM stake_redistribution_events
  WHERE belief_id = p_belief_id
    AND epoch = p_epoch;

  RETURN jsonb_build_object(
    'belief_id', p_belief_id,
    'epoch', p_epoch,
    'participant_count', COALESCE(v_participant_count, 0),
    'total_delta_micro', COALESCE(v_total_delta, 0),
    'total_rewards_micro', COALESCE(v_total_rewards, 0),
    'total_slashes_micro', COALESCE(v_total_slashes, 0),
    'is_zero_sum', ABS(COALESCE(v_total_delta, 0)) <= 1,
    'delta_usdc', COALESCE(v_total_delta, 0) / 1000000.0
  );
END;
$$;


ALTER FUNCTION "public"."check_redistribution_zero_sum"("p_belief_id" "uuid", "p_epoch" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_redistribution_zero_sum"("p_belief_id" "uuid", "p_epoch" integer) IS 'Verify that a specific redistribution event maintains the zero-sum property. Returns detailed breakdown of rewards, slashes, and net delta.';



CREATE OR REPLACE FUNCTION "public"."deploy_pool_with_lock"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric, "p_f" integer, "p_beta_num" integer, "p_beta_den" integer, "p_long_mint_address" "text", "p_short_mint_address" "text", "p_s_long_supply" numeric, "p_s_short_supply" numeric, "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_vault_balance" numeric, "p_deployment_tx_signature" "text" DEFAULT NULL::"text", "p_deployer_user_id" "uuid" DEFAULT NULL::"uuid", "p_s_scale_long_q64" numeric DEFAULT NULL::numeric, "p_s_scale_short_q64" numeric DEFAULT NULL::numeric) RETURNS "void"
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
      last_synced_at = NOW()
    WHERE post_id = p_post_id;

    -- Silently return - pool already exists and has been updated
    RETURN;
  END IF;

  -- Pool doesn't exist - insert new record
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
    COALESCE(p_s_scale_long_q64, Q64),
    COALESCE(p_s_scale_short_q64, Q64),
    p_vault_balance,
    p_deployment_tx_signature,
    NOW()
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
    -- Insert LONG balance
    INSERT INTO user_pool_balances (
      user_id,
      pool_address,
      post_id,
      token_balance,
      token_type
    ) VALUES (
      p_deployer_user_id,
      p_pool_address,
      p_post_id,
      v_long_supply_display,
      'LONG'
    )
    ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
      token_balance = EXCLUDED.token_balance,
      updated_at = NOW();

    -- Insert SHORT balance
    INSERT INTO user_pool_balances (
      user_id,
      pool_address,
      post_id,
      token_balance,
      token_type
    ) VALUES (
      p_deployer_user_id,
      p_pool_address,
      p_post_id,
      v_short_supply_display,
      'SHORT'
    )
    ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
      token_balance = EXCLUDED.token_balance,
      updated_at = NOW();
  END IF;

END;
$$;


ALTER FUNCTION "public"."deploy_pool_with_lock"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric, "p_f" integer, "p_beta_num" integer, "p_beta_den" integer, "p_long_mint_address" "text", "p_short_mint_address" "text", "p_s_long_supply" numeric, "p_s_short_supply" numeric, "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_vault_balance" numeric, "p_deployment_tx_signature" "text", "p_deployer_user_id" "uuid", "p_s_scale_long_q64" numeric, "p_s_scale_short_q64" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deploy_pool_with_lock"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric, "p_f" integer, "p_beta_num" integer, "p_beta_den" integer, "p_long_mint_address" "text", "p_short_mint_address" "text", "p_s_long_supply" numeric, "p_s_short_supply" numeric, "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_vault_balance" numeric, "p_deployment_tx_signature" "text", "p_deployer_user_id" "uuid", "p_s_scale_long_q64" numeric, "p_s_scale_short_q64" numeric) IS 'Records pool deployment with full idempotency. Can be called multiple times safely by both API route (immediate) and event indexer (async). Updates existing pool data if already exists.';



CREATE OR REPLACE FUNCTION "public"."get_agent_redistribution_history"("p_agent_id" "uuid") RETURNS TABLE("belief_id" "uuid", "epoch" integer, "information_score" numeric, "stake_delta" bigint, "stake_delta_usdc" numeric, "processed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    belief_id,
    epoch,
    information_score,
    stake_delta,
    stake_delta / 1000000.0 as stake_delta_usdc,
    processed_at
  FROM stake_redistribution_events
  WHERE agent_id = p_agent_id
  ORDER BY processed_at DESC;
$$;


ALTER FUNCTION "public"."get_agent_redistribution_history"("p_agent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agent_redistribution_history"("p_agent_id" "uuid") IS 'Get complete redistribution history for an agent, showing all rewards and penalties in chronological order';



CREATE OR REPLACE FUNCTION "public"."get_epoch_status"() RETURNS TABLE("current_epoch" integer, "epoch_start_time" timestamp with time zone, "time_remaining_seconds" integer, "next_deadline" timestamp with time zone, "processing_enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    config_row RECORD;
    start_time TIMESTAMPTZ;
    deadline TIMESTAMPTZ;
    duration_sec INTEGER;
BEGIN
    -- Get all config values in one query
    SELECT
        MAX(CASE WHEN key = 'current_epoch' THEN value::INTEGER END) as curr_epoch,
        MAX(CASE WHEN key = 'current_epoch_start_time' THEN value::TIMESTAMPTZ END) as start_tm,
        MAX(CASE WHEN key = 'next_epoch_deadline' THEN value::TIMESTAMPTZ END) as deadline_tm,
        MAX(CASE WHEN key = 'epoch_duration_seconds' THEN value::INTEGER END) as duration
    INTO config_row
    FROM system_config
    WHERE key IN (
        'current_epoch',
        'current_epoch_start_time',
        'next_epoch_deadline',
        'epoch_duration_seconds'
    );

    -- Calculate time remaining
    start_time := COALESCE(config_row.start_tm, NOW());
    deadline := COALESCE(config_row.deadline_tm, start_time + INTERVAL '1 hour');
    duration_sec := GREATEST(0, EXTRACT(EPOCH FROM (deadline - NOW()))::INTEGER);

    -- Return results
    current_epoch := COALESCE(config_row.curr_epoch, 0);
    epoch_start_time := start_time;
    time_remaining_seconds := duration_sec;
    next_deadline := deadline;
    processing_enabled := true;

    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_epoch_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") RETURNS TABLE("pool_address" "text", "long_mint_address" "text", "short_mint_address" "text", "market_address" "text", "status" "text", "deployed_at" timestamp with time zone, "pool_created_at" timestamp with time zone, "market_deployed_at" timestamp with time zone, "fee_rate_bps" integer, "strike_ratio_num" bigint, "strike_ratio_den" bigint, "total_long_supply" numeric, "total_short_supply" numeric, "total_usdc_reserve" numeric, "sqrt_price_long" numeric, "sqrt_price_short" numeric, "last_synced_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.pool_address,
    pd.long_mint_address,
    pd.short_mint_address,
    pd.market_address,
    pd.status,
    pd.deployed_at,
    pd.pool_created_at,
    pd.market_deployed_at,
    pd.fee_rate_bps,
    pd.strike_ratio_num,
    pd.strike_ratio_den,
    pd.total_long_supply,
    pd.total_short_supply,
    pd.total_usdc_reserve,
    pd.sqrt_price_long,
    pd.sqrt_price_short,
    pd.last_synced_at
  FROM pool_deployments pd
  WHERE pd.post_id = p_post_id;
END;
$$;


ALTER FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") IS 'Get pool deployment info and stats for a post (ICBS version)';



CREATE OR REPLACE FUNCTION "public"."get_user_holdings_with_entry_price"("p_user_id" "uuid") RETURNS TABLE("token_balance" numeric, "total_usdc_spent" numeric, "total_bought" numeric, "total_sold" numeric, "total_usdc_received" numeric, "pool_address" "text", "post_id" "uuid", "token_type" "text", "belief_lock" numeric, "last_trade_at" timestamp with time zone, "entry_price" numeric, "posts" json, "pool_deployments" json)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    upb.token_balance,
    upb.total_usdc_spent,
    upb.total_bought,
    upb.total_sold,
    upb.total_usdc_received,
    upb.pool_address,
    upb.post_id,
    upb.token_type,
    upb.belief_lock::numeric,  -- Cast bigint to numeric
    upb.last_trade_at,
    calculate_entry_price(p_user_id, upb.pool_address, upb.token_type) as entry_price,
    (
      SELECT json_build_object(
        'id', p.id,
        'post_type', p.post_type,
        'content_text', p.content_text,
        'caption', p.caption,
        'media_urls', p.media_urls,
        'cover_image_url', p.cover_image_url,
        'article_title', p.article_title,
        'user_id', p.user_id,
        'created_at', p.created_at,
        'users', (
          SELECT json_build_object(
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url
          )
          FROM users u
          WHERE u.id = p.user_id
        )
      )
      FROM posts p
      WHERE p.id = upb.post_id
    ) as posts,
    (
      SELECT json_build_object(
        'pool_address', pd.pool_address,
        'cached_price_long', pd.cached_price_long,
        'cached_price_short', pd.cached_price_short,
        'prices_last_updated_at', pd.prices_last_updated_at,
        's_long_supply', pd.s_long_supply,
        's_short_supply', pd.s_short_supply
      )
      FROM pool_deployments pd
      WHERE pd.pool_address = upb.pool_address
    ) as pool_deployments
  FROM user_pool_balances upb
  WHERE upb.user_id = p_user_id
    AND upb.token_balance > 0;
END;
$$;


ALTER FUNCTION "public"."get_user_holdings_with_entry_price"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_holdings_with_entry_price"("p_user_id" "uuid") IS 'Returns user holdings with calculated entry prices and full post/pool data. Uses calculate_entry_price function to determine weighted average cost basis. Fixed type casting for belief_lock column.';



CREATE OR REPLACE FUNCTION "public"."log_stake_state_after_trade"("p_agent_id" "uuid", "p_tx_signature" "text", "p_skim_credited" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_stake bigint;
  v_total_locks bigint;
  v_deficit bigint;
BEGIN
  -- Get current stake
  SELECT total_stake INTO v_total_stake
  FROM agents
  WHERE id = p_agent_id;

  -- Get sum of all locks
  SELECT COALESCE(SUM(upb.belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances upb
  INNER JOIN users u ON u.id = upb.user_id
  WHERE u.agent_id = p_agent_id
    AND upb.token_balance > 0;

  -- Log the state
  RAISE NOTICE '🔍 STAKE STATE AFTER TRADE %: stake=% locks=% deficit=% skim_credited=%',
    p_tx_signature, v_total_stake, v_total_locks, (v_total_locks - v_total_stake), p_skim_credited;

  -- Check invariant and warn if violated
  IF v_total_stake < v_total_locks THEN
    v_deficit := v_total_locks - v_total_stake;
    RAISE WARNING '⚠️  STAKE INVARIANT VIOLATION: total_stake (%) < total_locks (%). Deficit: % micro-USDC. TX: %',
      v_total_stake, v_total_locks, v_deficit, p_tx_signature;
  END IF;
END;
$$;


ALTER FUNCTION "public"."log_stake_state_after_trade"("p_agent_id" "uuid", "p_tx_signature" "text", "p_skim_credited" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_stake_state_after_trade"("p_agent_id" "uuid", "p_tx_signature" "text", "p_skim_credited" boolean) IS 'Logs stake state after a trade and warns if invariant is violated.
Used for debugging skim calculation issues.
Does not block trades - only logs warnings for monitoring.';



CREATE OR REPLACE FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM pg_advisory_lock(lock_id);
END;
$$;


ALTER FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM pg_advisory_unlock(lock_id);
END;
$$;


ALTER FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_agent_stake"("p_agent_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_recorded_stake bigint;
  v_calculated_stake bigint;
  v_deposits bigint;
  v_withdrawals bigint;
  v_rewards bigint;
  v_penalties bigint;
  v_discrepancy bigint;
BEGIN
  -- Get current recorded stake
  SELECT COALESCE(total_stake, 0)
  INTO v_recorded_stake
  FROM agents
  WHERE id = p_agent_id;

  -- Calculate stake from custodian deposits (trade skims)
  -- stored in display USDC, convert to micro-USDC
  SELECT COALESCE(SUM((amount_usdc * 1000000)::bigint), 0)
  INTO v_deposits
  FROM custodian_deposits
  WHERE agent_id = p_agent_id
    AND agent_credited = true
    AND deposit_type = 'trade_skim';

  -- Calculate stake from withdrawals
  -- stored in display USDC, convert to micro-USDC
  SELECT COALESCE(SUM((amount_usdc * 1000000)::bigint), 0)
  INTO v_withdrawals
  FROM custodian_withdrawals
  WHERE agent_id = p_agent_id
    AND status = 'completed';

  -- Calculate rewards from stake redistribution
  SELECT COALESCE(SUM(stake_delta), 0)
  INTO v_rewards
  FROM stake_redistribution_events
  WHERE agent_id = p_agent_id
    AND stake_delta > 0;

  -- Calculate penalties from stake redistribution
  SELECT COALESCE(SUM(ABS(stake_delta)), 0)
  INTO v_penalties
  FROM stake_redistribution_events
  WHERE agent_id = p_agent_id
    AND stake_delta < 0;

  -- Calculate what stake SHOULD be
  v_calculated_stake := v_deposits - v_withdrawals + v_rewards - v_penalties;

  -- Calculate discrepancy
  v_discrepancy := v_recorded_stake - v_calculated_stake;

  RETURN jsonb_build_object(
    'agent_id', p_agent_id,
    'recorded_stake', v_recorded_stake,
    'calculated_stake', v_calculated_stake,
    'discrepancy', v_discrepancy,
    'is_correct', (v_discrepancy = 0),
    'breakdown', jsonb_build_object(
      'deposits', v_deposits,
      'withdrawals', v_withdrawals,
      'rewards', v_rewards,
      'penalties', v_penalties
    )
  );
END;
$$;


ALTER FUNCTION "public"."reconcile_agent_stake"("p_agent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reconcile_agent_stake"("p_agent_id" "uuid") IS 'Verifies total_stake by comparing recorded value against sum of all events (deposits, withdrawals, rewards, penalties). Returns breakdown and discrepancy.';



CREATE OR REPLACE FUNCTION "public"."reconcile_all_agents"() RETURNS TABLE("agent_id" "uuid", "recorded_stake" bigint, "calculated_stake" bigint, "discrepancy" bigint, "is_correct" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    COALESCE(a.total_stake, 0),
    (
      -- Deposits
      COALESCE((
        SELECT SUM((cd.amount_usdc * 1000000)::bigint)
        FROM custodian_deposits cd
        WHERE cd.agent_id = a.id
          AND cd.agent_credited = true
          AND cd.deposit_type = 'trade_skim'
      ), 0)
      -- Withdrawals (subtract)
      - COALESCE((
        SELECT SUM((cw.amount_usdc * 1000000)::bigint)
        FROM custodian_withdrawals cw
        WHERE cw.agent_id = a.id
          AND cw.status = 'completed'
      ), 0)
      -- Rewards (add)
      + COALESCE((
        SELECT SUM(sre.stake_delta)
        FROM stake_redistribution_events sre
        WHERE sre.agent_id = a.id
          AND sre.stake_delta > 0
      ), 0)
      -- Penalties (subtract)
      - COALESCE((
        SELECT SUM(ABS(sre.stake_delta))
        FROM stake_redistribution_events sre
        WHERE sre.agent_id = a.id
          AND sre.stake_delta < 0
      ), 0)
    ) as calculated,
    (
      COALESCE(a.total_stake, 0) -
      (
        COALESCE((SELECT SUM((cd.amount_usdc * 1000000)::bigint) FROM custodian_deposits cd WHERE cd.agent_id = a.id AND cd.agent_credited = true AND cd.deposit_type = 'trade_skim'), 0) -
        COALESCE((SELECT SUM((cw.amount_usdc * 1000000)::bigint) FROM custodian_withdrawals cw WHERE cw.agent_id = a.id AND cw.status = 'completed'), 0) +
        COALESCE((SELECT SUM(sre.stake_delta) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta > 0), 0) -
        COALESCE((SELECT SUM(ABS(sre.stake_delta)) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta < 0), 0)
      )
    ) as diff,
    (
      COALESCE(a.total_stake, 0) =
      (
        COALESCE((SELECT SUM((cd.amount_usdc * 1000000)::bigint) FROM custodian_deposits cd WHERE cd.agent_id = a.id AND cd.agent_credited = true AND cd.deposit_type = 'trade_skim'), 0) -
        COALESCE((SELECT SUM((cw.amount_usdc * 1000000)::bigint) FROM custodian_withdrawals cw WHERE cw.agent_id = a.id AND cw.status = 'completed'), 0) +
        COALESCE((SELECT SUM(sre.stake_delta) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta > 0), 0) -
        COALESCE((SELECT SUM(ABS(sre.stake_delta)) FROM stake_redistribution_events sre WHERE sre.agent_id = a.id AND sre.stake_delta < 0), 0)
      )
    ) as correct
  FROM agents a;
END;
$$;


ALTER FUNCTION "public"."reconcile_all_agents"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reconcile_all_agents"() IS 'Checks all agents for stake discrepancies. Returns table showing recorded vs calculated stake for each agent.';



CREATE OR REPLACE FUNCTION "public"."reconcile_balance_sheet"() RETURNS TABLE("metric" "text", "value_usdc" numeric, "status" "text", "note" "text")
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_total_deposits numeric;
  v_total_withdrawals numeric;
  v_net_custodian numeric;
  v_total_agent_stakes numeric;
  v_total_locks numeric;
  v_difference numeric;
BEGIN
  -- Sum all deposits
  SELECT COALESCE(SUM(amount_usdc), 0) INTO v_total_deposits
  FROM custodian_deposits
  WHERE agent_credited = true;

  -- Sum all confirmed withdrawals
  SELECT COALESCE(SUM(amount_usdc), 0) INTO v_total_withdrawals
  FROM custodian_withdrawals
  WHERE confirmed = true OR status = 'completed';

  -- Net custodian balance
  v_net_custodian := v_total_deposits - v_total_withdrawals;

  -- Sum all agent stakes
  SELECT COALESCE(SUM(total_stake), 0) / 1000000.0 INTO v_total_agent_stakes
  FROM agents;

  -- Sum all locks
  SELECT COALESCE(SUM(belief_lock), 0) / 1000000.0 INTO v_total_locks
  FROM user_pool_balances
  WHERE token_balance > 0;

  -- Calculate difference
  v_difference := v_net_custodian - v_total_agent_stakes;

  RETURN QUERY VALUES
    ('Total Deposits', v_total_deposits, '📥', 'All credited skim + manual deposits'),
    ('Total Withdrawals', v_total_withdrawals, '📤', 'All confirmed withdrawals'),
    ('Net Custodian Balance', v_net_custodian, '🏦', 'Deposits - Withdrawals'),
    ('Total Agent Stakes', v_total_agent_stakes, '👥', 'Sum of agents.total_stake'),
    ('Total Locks', v_total_locks, '🔒', 'Sum of belief_locks for open positions'),
    ('Difference (Custodian - Stakes)', v_difference,
      CASE
        WHEN ABS(v_difference) < 0.01 THEN '✅'
        WHEN ABS(v_difference) < 1.00 THEN '⚠️'
        ELSE '❌'
      END,
      CASE
        WHEN ABS(v_difference) < 0.01 THEN 'Balanced (within rounding)'
        WHEN ABS(v_difference) < 1.00 THEN 'Minor discrepancy (< $1)'
        WHEN v_difference > 0 THEN 'Custodian has more than stakes (investigate deposits)'
        ELSE 'Stakes exceed custodian (critical error!)'
      END
    );
END;
$_$;


ALTER FUNCTION "public"."reconcile_balance_sheet"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reconcile_balance_sheet"() IS 'Performs full balance sheet reconciliation.
Ensures: deposits - withdrawals = sum(agent stakes).
Detects accounting errors, missing deposits, or double-credits.';



CREATE OR REPLACE FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deployment_id UUID;
BEGIN
    INSERT INTO pool_deployments (
        post_id,
        belief_id,
        pool_address,
        usdc_vault_address,
        token_mint_address,
        deployed_by_agent_id,
        deployment_tx_signature,
        k_quadratic
    ) VALUES (
        p_post_id,
        p_belief_id,
        p_pool_address,
        p_vault_address,
        p_mint_address,
        p_deployed_by_agent_id,
        p_tx_signature,
        p_k_quadratic
    ) RETURNING id INTO v_deployment_id;

    RETURN v_deployment_id;
END;
$$;


ALTER FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) IS 'Records a new pool deployment. Updated to pure quadratic curve (removed reserve_cap, linear_slope, virtual_liquidity).';



CREATE OR REPLACE FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_trade_id uuid;
  v_skim_amount numeric;
  v_token_balance numeric;
  v_belief_lock bigint;
  v_price_long numeric;
  v_price_short numeric;
  v_usdc_micro bigint;
BEGIN
  -- Convert display USDC to micro-USDC
  v_usdc_micro := (p_usdc_amount * 1000000)::bigint;

  -- Calculate skim
  v_skim_amount := 0;

  -- Calculate new token balance
  SELECT token_balance INTO v_token_balance
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_token_type
  FOR UPDATE;

  IF v_token_balance IS NULL THEN
    v_token_balance := 0;
  END IF;

  IF p_trade_type = 'buy' THEN
    v_token_balance := v_token_balance + p_token_amount;
  ELSE
    v_token_balance := GREATEST(0, v_token_balance - p_token_amount);
  END IF;

  -- Calculate belief lock (in micro-USDC)
  IF p_trade_type = 'buy' THEN
    v_belief_lock := (v_usdc_micro * 0.02)::bigint;
  ELSE
    IF v_token_balance = 0 THEN
      v_belief_lock := 0;
    ELSE
      SELECT belief_lock INTO v_belief_lock
      FROM user_pool_balances
      WHERE user_id = p_user_id
        AND pool_address = p_pool_address
        AND token_type = p_token_type;
      v_belief_lock := COALESCE(v_belief_lock, 0);
    END IF;
  END IF;

  -- Calculate prices from sqrt prices
  BEGIN
    v_price_long := (p_sqrt_price_long_x96::numeric / (2^96))^2;
  EXCEPTION WHEN OTHERS THEN
    v_price_long := NULL;
  END;

  BEGIN
    v_price_short := (p_sqrt_price_short_x96::numeric / (2^96))^2;
  EXCEPTION WHEN OTHERS THEN
    v_price_short := NULL;
  END;

  -- Insert trade record
  INSERT INTO trades (
    pool_address,
    post_id,
    user_id,
    wallet_address,
    trade_type,
    side,
    token_amount,
    usdc_amount,
    tx_signature,
    price_long,
    price_short,
    recorded_by,
    confirmed
  ) VALUES (
    p_pool_address,
    p_post_id,
    p_user_id,
    p_wallet_address,
    p_trade_type,
    p_token_type,
    p_token_amount,
    v_usdc_micro,
    p_tx_signature,
    v_price_long,
    v_price_short,
    'server',
    false
  )
  ON CONFLICT (tx_signature) DO UPDATE SET
    confirmed = false,
    recorded_by = 'server'
  RETURNING id INTO v_trade_id;

  -- Upsert user_pool_balances
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_type,
    token_balance,
    belief_lock,
    total_bought,
    total_sold,
    net_bought,
    total_usdc_spent,
    total_usdc_received,
    realized_pnl,
    last_trade_at,
    entry_price
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    p_token_type,
    v_token_balance,
    v_belief_lock,
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE -p_token_amount END,
    CASE WHEN p_trade_type = 'buy' THEN v_usdc_micro ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN v_usdc_micro ELSE 0 END,
    0,
    NOW(),
    CASE
      WHEN p_trade_type = 'buy' AND p_token_amount > 0
      THEN p_usdc_amount / p_token_amount
      ELSE NULL
    END
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = v_token_balance,
    belief_lock = v_belief_lock,
    total_bought = user_pool_balances.total_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    net_bought = user_pool_balances.net_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE -p_token_amount END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN p_trade_type = 'buy' THEN v_usdc_micro ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN p_trade_type = 'sell' THEN v_usdc_micro ELSE 0 END,
    realized_pnl = user_pool_balances.realized_pnl +
      CASE
        WHEN p_trade_type = 'sell' AND user_pool_balances.entry_price IS NOT NULL
        THEN (p_usdc_amount / p_token_amount - user_pool_balances.entry_price) * p_token_amount
        ELSE 0
      END,
    last_trade_at = NOW(),
    entry_price = CASE
      WHEN p_trade_type = 'buy' AND
           (user_pool_balances.token_balance = 0 OR user_pool_balances.entry_price IS NULL)
      THEN p_usdc_amount / p_token_amount
      ELSE user_pool_balances.entry_price
    END;

  -- Record implied relevance
  BEGIN
    DECLARE
      v_price_ratio numeric;
      v_implied_relevance numeric;
    BEGIN
      IF v_price_long IS NOT NULL AND v_price_short IS NOT NULL AND (v_price_long + v_price_short) > 0 THEN
        v_price_ratio := v_price_long / (v_price_long + v_price_short);
        v_implied_relevance := v_price_ratio;

        INSERT INTO implied_relevance_history (
          post_id,
          implied_relevance,
          event_type,
          event_reference,
          recorded_at
        ) VALUES (
          p_post_id,
          v_implied_relevance,
          'trade',
          p_tx_signature,
          NOW()
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  -- NEW: Update posts.total_volume_usdc with sum of all trade volumes
  UPDATE posts
  SET total_volume_usdc = (
    SELECT COALESCE(SUM(usdc_amount), 0) / 1000000.0
    FROM trades
    WHERE post_id = p_post_id
  )
  WHERE id = p_post_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'token_balance', v_token_balance,
    'belief_lock', v_belief_lock,
    'price_long', v_price_long,
    'price_short', v_price_short
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'record_trade_atomic error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;


ALTER FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric) IS 'Atomically records trade, updates balances with FOR UPDATE locks, applies stake skim, and records implied relevance. Bug #1 and #2 fixes + implied relevance tracking.';



CREATE OR REPLACE FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric DEFAULT NULL::numeric, "p_s_short_after" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_trade_id uuid;
  v_skim_amount numeric;
  v_token_balance numeric;
  v_belief_lock numeric;
  v_price_long numeric;
  v_price_short numeric;
  v_usdc_micro bigint;  -- Store in micro-USDC for database
  v_current_vault bigint;
BEGIN
  -- Convert display USDC to micro-USDC (multiply by 1,000,000)
  v_usdc_micro := (p_usdc_amount * 1000000)::bigint;

  -- 1. Calculate skim (simplified - just returns 0)
  v_skim_amount := 0;

  -- 2. Calculate new token balance
  SELECT token_balance INTO v_token_balance
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_token_type
  FOR UPDATE;  -- Lock the row

  IF v_token_balance IS NULL THEN
    v_token_balance := 0;
  END IF;

  IF p_trade_type = 'buy' THEN
    v_token_balance := v_token_balance + p_token_amount;
  ELSE
    v_token_balance := GREATEST(0, v_token_balance - p_token_amount);
  END IF;

  -- 3. Calculate belief lock (2% of trade amount for buys, stored in display USDC)
  IF p_trade_type = 'buy' THEN
    v_belief_lock := p_usdc_amount * 0.02;  -- 2% of display USDC amount
  ELSE
    -- On sells, check if position is fully closed
    IF v_token_balance = 0 THEN
      v_belief_lock := 0;  -- Release lock on full exit
    ELSE
      -- Keep existing lock
      SELECT belief_lock INTO v_belief_lock
      FROM user_pool_balances
      WHERE user_id = p_user_id
        AND pool_address = p_pool_address
        AND token_type = p_token_type;

      v_belief_lock := COALESCE(v_belief_lock, 0);
    END IF;
  END IF;

  -- 4. Calculate prices from sqrt prices
  -- Convert to USDC (display units) by dividing by 1,000,000
  -- Formula: price = (sqrt_price_x96 / 2^96)^2 / 1,000,000
  -- This gives price in USDC per token (e.g., $1.095780)
  BEGIN
    v_price_long := (p_sqrt_price_long_x96::numeric / (2^96))^2 / 1000000;
  EXCEPTION WHEN OTHERS THEN
    v_price_long := NULL;
  END;

  BEGIN
    v_price_short := (p_sqrt_price_short_x96::numeric / (2^96))^2 / 1000000;
  EXCEPTION WHEN OTHERS THEN
    v_price_short := NULL;
  END;

  -- 5. Insert trade record with micro-USDC
  INSERT INTO trades (
    pool_address,
    post_id,
    user_id,
    wallet_address,
    trade_type,
    side,
    token_amount,
    usdc_amount,  -- Stored in micro-USDC
    tx_signature,
    price_long,   -- NOW in USDC (display units)
    price_short,  -- NOW in USDC (display units)
    recorded_by,
    confirmed
  ) VALUES (
    p_pool_address,
    p_post_id,
    p_user_id,
    p_wallet_address,
    p_trade_type,
    p_token_type,
    p_token_amount,
    v_usdc_micro,  -- Store in micro-USDC (atomic units)
    p_tx_signature,
    v_price_long,   -- Store in USDC (display units)
    v_price_short,  -- Store in USDC (display units)
    'server',
    false
  )
  ON CONFLICT (tx_signature) DO UPDATE SET
    confirmed = EXCLUDED.confirmed,
    recorded_by = 'both'
  RETURNING id INTO v_trade_id;

  -- 6. Upsert belief submission
  INSERT INTO belief_submissions (
    belief_id,
    agent_id,
    belief,
    meta_prediction,
    created_at,
    updated_at
  ) VALUES (
    p_belief_id,
    p_agent_id,
    p_belief,
    p_meta_prediction,
    NOW(),
    NOW()
  )
  ON CONFLICT (belief_id, agent_id) DO UPDATE SET
    belief = EXCLUDED.belief,
    meta_prediction = EXCLUDED.meta_prediction,
    updated_at = NOW();

  -- 7. Upsert user_pool_balances with cumulative tracking (use micro-USDC)
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_type,
    token_balance,
    belief_lock,
    total_bought,
    total_sold,
    net_bought,
    total_usdc_spent,
    total_usdc_received,
    realized_pnl,
    last_trade_at,
    entry_price
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    p_token_type,
    v_token_balance,
    v_belief_lock,  -- Stored in display USDC
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE -p_token_amount END,
    CASE WHEN p_trade_type = 'buy' THEN v_usdc_micro ELSE 0 END,  -- Store in micro-USDC
    CASE WHEN p_trade_type = 'sell' THEN v_usdc_micro ELSE 0 END,  -- Store in micro-USDC
    0,  -- Initial realized_pnl
    NOW(),
    CASE
      WHEN p_trade_type = 'buy' AND p_token_amount > 0
      THEN p_usdc_amount / p_token_amount  -- Entry price in display USDC per token
      ELSE NULL
    END
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = v_token_balance,
    belief_lock = v_belief_lock,
    total_bought = user_pool_balances.total_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    net_bought = user_pool_balances.net_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE -p_token_amount END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN p_trade_type = 'buy' THEN v_usdc_micro ELSE 0 END,  -- Store in micro-USDC
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN p_trade_type = 'sell' THEN v_usdc_micro ELSE 0 END,  -- Store in micro-USDC
    realized_pnl = user_pool_balances.realized_pnl +
      CASE
        WHEN p_trade_type = 'sell'
        THEN v_usdc_micro - (user_pool_balances.entry_price * p_token_amount * 1000000)::bigint
        ELSE 0
      END,
    last_trade_at = NOW(),
    entry_price = CASE
      WHEN p_trade_type = 'buy' AND user_pool_balances.token_balance > 0
      THEN (
        (user_pool_balances.entry_price * user_pool_balances.token_balance + p_usdc_amount * p_token_amount) /
        (user_pool_balances.token_balance + p_token_amount)
      )
      WHEN p_trade_type = 'buy' AND user_pool_balances.token_balance = 0
      THEN p_usdc_amount / p_token_amount
      ELSE user_pool_balances.entry_price
    END;

  -- 8. Update pool_deployments with new on-chain state (supplies & sqrt prices)
  IF p_s_long_after IS NOT NULL AND p_s_short_after IS NOT NULL THEN
    UPDATE pool_deployments
    SET
      s_long_supply = p_s_long_after,
      s_short_supply = p_s_short_after,
      sqrt_price_long_x96 = p_sqrt_price_long_x96,
      sqrt_price_short_x96 = p_sqrt_price_short_x96,
      last_synced_at = NOW()
    WHERE pool_address = p_pool_address;
  END IF;

  -- 9. Update post total_volume_usdc (sum of all trade usdc_amounts in micro-USDC, converted to display USDC)
  UPDATE posts
  SET total_volume_usdc = (
    SELECT COALESCE(SUM(usdc_amount), 0) / 1000000.0
    FROM trades
    WHERE post_id = p_post_id
  )
  WHERE id = p_post_id;

  -- ✅ FIX: Return success=true along with other fields
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'token_balance', v_token_balance,
    'belief_lock', v_belief_lock
  );
END;
$_$;


ALTER FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric DEFAULT NULL::numeric, "p_s_short_after" numeric DEFAULT NULL::numeric, "p_skim_amount" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_trade_id uuid;
  v_skim_amount numeric;
  v_token_balance numeric;
  v_belief_lock bigint;
  v_price_long numeric;
  v_price_short numeric;
  v_usdc_micro bigint;
  v_skim_micro bigint;
  v_current_vault bigint;
  v_deposit_inserted boolean;
  v_pool_current_epoch integer;
BEGIN
  v_usdc_micro := (p_usdc_amount * 1000000)::bigint;
  v_skim_micro := (p_skim_amount * 1000000)::bigint;
  v_deposit_inserted := false;

  v_skim_amount := 0;

  -- Get the pool's current epoch for belief submission tracking
  -- Pool's current_epoch = last settlement epoch, so new submissions use current_epoch + 1
  SELECT current_epoch INTO v_pool_current_epoch
  FROM pool_deployments
  WHERE pool_address = p_pool_address;

  IF v_pool_current_epoch IS NULL THEN
    v_pool_current_epoch := 0;
  END IF;

  -- Submissions in the "next" epoch (current_epoch represents last settlement)
  v_pool_current_epoch := v_pool_current_epoch + 1;

  SELECT token_balance INTO v_token_balance
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_token_type
  FOR UPDATE;

  IF v_token_balance IS NULL THEN
    v_token_balance := 0;
  END IF;

  IF p_trade_type = 'buy' THEN
    v_token_balance := v_token_balance + p_token_amount;
  ELSE
    v_token_balance := GREATEST(0, v_token_balance - p_token_amount);
  END IF;

  IF p_trade_type = 'buy' THEN
    v_belief_lock := (v_usdc_micro * 0.02)::bigint;
  ELSE
    IF v_token_balance = 0 THEN
      v_belief_lock := 0;
    ELSE
      SELECT belief_lock INTO v_belief_lock
      FROM user_pool_balances
      WHERE user_id = p_user_id
        AND pool_address = p_pool_address
        AND token_type = p_token_type;

      v_belief_lock := COALESCE(v_belief_lock, 0);
    END IF;
  END IF;

  BEGIN
    v_price_long := (p_sqrt_price_long_x96::numeric / (2^96))^2 / 1000000;
  EXCEPTION WHEN OTHERS THEN
    v_price_long := NULL;
  END;

  BEGIN
    v_price_short := (p_sqrt_price_short_x96::numeric / (2^96))^2 / 1000000;
  EXCEPTION WHEN OTHERS THEN
    v_price_short := NULL;
  END;

  INSERT INTO trades (
    pool_address,
    post_id,
    user_id,
    wallet_address,
    trade_type,
    side,
    token_amount,
    usdc_amount,
    tx_signature,
    price_long,
    price_short,
    recorded_by,
    confirmed
  ) VALUES (
    p_pool_address,
    p_post_id,
    p_user_id,
    p_wallet_address,
    p_trade_type,
    p_token_type,
    p_token_amount,
    v_usdc_micro,
    p_tx_signature,
    v_price_long,
    v_price_short,
    'server',
    false
  )
  ON CONFLICT (tx_signature) DO UPDATE SET
    confirmed = EXCLUDED.confirmed,
    recorded_by = 'both'
  RETURNING id INTO v_trade_id;

  -- ✅ FIX: Set epoch to pool's current_epoch so submissions count as "new" for rebase
  INSERT INTO belief_submissions (
    belief_id,
    agent_id,
    belief,
    meta_prediction,
    epoch,
    created_at,
    updated_at
  ) VALUES (
    p_belief_id,
    p_agent_id,
    p_belief,
    p_meta_prediction,
    v_pool_current_epoch,  -- Use pool's current epoch
    NOW(),
    NOW()
  )
  ON CONFLICT (belief_id, agent_id) DO UPDATE SET
    belief = EXCLUDED.belief,
    meta_prediction = EXCLUDED.meta_prediction,
    epoch = v_pool_current_epoch,  -- Update epoch on conflict
    updated_at = NOW();

  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_type,
    token_balance,
    belief_lock,
    total_bought,
    total_sold,
    net_bought,
    total_usdc_spent,
    total_usdc_received,
    realized_pnl,
    last_trade_at,
    entry_price
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    p_token_type,
    v_token_balance,
    v_belief_lock,
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE -p_token_amount END,
    CASE WHEN p_trade_type = 'buy' THEN v_usdc_micro ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN v_usdc_micro ELSE 0 END,
    0,
    NOW(),
    CASE
      WHEN p_trade_type = 'buy' AND p_token_amount > 0
      THEN p_usdc_amount / p_token_amount
      ELSE NULL
    END
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = v_token_balance,
    belief_lock = v_belief_lock,
    total_bought = user_pool_balances.total_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    net_bought = user_pool_balances.net_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE -p_token_amount END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN p_trade_type = 'buy' THEN v_usdc_micro ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN p_trade_type = 'sell' THEN v_usdc_micro ELSE 0 END,
    realized_pnl = user_pool_balances.realized_pnl +
      CASE
        WHEN p_trade_type = 'sell'
        THEN v_usdc_micro - (user_pool_balances.entry_price * p_token_amount * 1000000)::bigint
        ELSE 0
      END,
    last_trade_at = NOW(),
    entry_price = CASE
      WHEN p_trade_type = 'buy' AND user_pool_balances.token_balance > 0
      THEN (
        (user_pool_balances.entry_price * user_pool_balances.token_balance + p_usdc_amount * p_token_amount) /
        (user_pool_balances.token_balance + p_token_amount)
      )
      WHEN p_trade_type = 'buy' AND user_pool_balances.token_balance = 0
      THEN p_usdc_amount / p_token_amount
      ELSE user_pool_balances.entry_price
    END;

  IF p_s_long_after IS NOT NULL AND p_s_short_after IS NOT NULL THEN
    UPDATE pool_deployments
    SET
      s_long_supply = p_s_long_after,
      s_short_supply = p_s_short_after,
      sqrt_price_long_x96 = p_sqrt_price_long_x96,
      sqrt_price_short_x96 = p_sqrt_price_short_x96,
      last_synced_at = NOW()
    WHERE pool_address = p_pool_address;
  END IF;

  UPDATE posts
  SET total_volume_usdc = (
    SELECT COALESCE(SUM(usdc_amount), 0) / 1000000.0
    FROM trades
    WHERE post_id = p_post_id
  )
  WHERE id = p_post_id;

  IF p_trade_type = 'buy' AND v_skim_micro > 0 THEN
    INSERT INTO custodian_deposits (
      depositor_address,
      amount_usdc,
      tx_signature,
      agent_id,
      deposit_type,
      recorded_by,
      confirmed,
      agent_credited,
      credited_at
    ) VALUES (
      p_wallet_address,
      p_skim_amount,
      p_tx_signature,
      p_agent_id,
      'trade_skim',
      'server',
      false,
      true,
      NOW()
    )
    ON CONFLICT (tx_signature) DO NOTHING;

    GET DIAGNOSTICS v_deposit_inserted = ROW_COUNT;

    IF v_deposit_inserted THEN
      UPDATE agents
      SET
        total_stake = total_stake + v_skim_micro,
        total_deposited = total_deposited + p_skim_amount,
        updated_at = NOW()
      WHERE id = p_agent_id;
    END IF;
  END IF;

  -- ✅ CRITICAL SAFETY CHECK: Validate stake invariant after trade
  -- This ensures total_stake >= total_locks, catching any skim calculation bugs
  -- Throws exception if violated, preventing underwater positions from being created
  PERFORM validate_stake_invariant(p_agent_id, 'trade ' || p_tx_signature);

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'token_balance', v_token_balance,
    'belief_lock', v_belief_lock,
    'skim_credited', v_deposit_inserted
  );
END;
$$;


ALTER FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric, "p_skim_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_withdrawal_atomic"("p_agent_id" "uuid", "p_amount_usdc" numeric, "p_tx_signature" "text", "p_wallet_address" "text", "p_authority_address" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_withdrawal_id uuid;
  v_amount_micro bigint;
  v_current_stake bigint;
  v_row_inserted boolean;
BEGIN
  -- Convert display USDC to micro-USDC
  v_amount_micro := (p_amount_usdc * 1000000)::bigint;

  -- Validate amount
  IF v_amount_micro <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  -- Get current stake and lock row for update
  SELECT total_stake INTO v_current_stake
  FROM agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF v_current_stake IS NULL THEN
    RAISE EXCEPTION 'Agent not found: %', p_agent_id;
  END IF;

  -- Check sufficient balance (basic check - full withdrawable calculation done in API)
  IF v_current_stake < v_amount_micro THEN
    RAISE EXCEPTION 'Insufficient stake balance. Current: %, Requested: %', v_current_stake, v_amount_micro;
  END IF;

  -- Try to insert withdrawal record (optimistic - unconfirmed until event indexer processes)
  -- Use DO NOTHING to prevent conflicts from duplicates
  INSERT INTO custodian_withdrawals (
    tx_signature,
    recipient_address,
    amount_usdc,
    recorded_by,
    confirmed,
    requested_at,
    agent_id,
    status
  ) VALUES (
    p_tx_signature,
    p_wallet_address,
    p_amount_usdc,  -- Store in display USDC (per table spec)
    'server',
    false,  -- Unconfirmed until indexer processes it
    NOW(),
    p_agent_id,
    'pending'
  )
  ON CONFLICT (tx_signature) DO NOTHING
  RETURNING id INTO v_withdrawal_id;

  -- Check if we actually inserted a new row (prevents double-crediting on duplicates)
  GET DIAGNOSTICS v_row_inserted = ROW_COUNT;

  -- Only update stake if we inserted a new withdrawal record
  IF v_row_inserted THEN
    UPDATE agents
    SET
      total_stake = GREATEST(0, total_stake - v_amount_micro),
      updated_at = NOW()
    WHERE id = p_agent_id;
  ELSE
    -- Get existing withdrawal_id for response
    SELECT id INTO v_withdrawal_id
    FROM custodian_withdrawals
    WHERE tx_signature = p_tx_signature;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'amount_micro', v_amount_micro,
    'new_stake', (SELECT total_stake FROM agents WHERE id = p_agent_id),
    'was_duplicate', NOT v_row_inserted
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on any error
    RAISE NOTICE 'Withdrawal failed: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."record_withdrawal_atomic"("p_agent_id" "uuid", "p_amount_usdc" numeric, "p_tx_signature" "text", "p_wallet_address" "text", "p_authority_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE agents
    SET
        solana_address = p_solana_address,
        total_stake = p_onchain_balance,
        last_synced_at = NOW()
    WHERE id = p_agent_id;
END;
$$;


ALTER FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE pool_deployments
    SET
        token_supply = p_token_supply,
        reserve = p_reserve,
        last_synced_at = NOW()
    WHERE pool_address = p_pool_address;
END;
$$;


ALTER FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE agents SET total_stake = GREATEST(0, total_stake + p_delta_micro) WHERE id = p_agent_id;
END;
$$;


ALTER FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_balance_after_trade"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Upsert user balance
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at
  ) VALUES (
    NEW.user_id,
    NEW.pool_address,
    NEW.post_id,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = user_pool_balances.token_balance +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    total_bought = user_pool_balances.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_balance_after_trade"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_balance_after_trade"() IS 'Auto-updates user_pool_balances when trade is inserted';



CREATE OR REPLACE FUNCTION "public"."update_user_balance_after_trade_safe"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Get current balance if exists
  SELECT token_balance INTO v_current_balance
  FROM user_pool_balances
  WHERE user_id = NEW.user_id
    AND pool_address = NEW.pool_address;

  -- Calculate new balance
  IF v_current_balance IS NULL THEN
    -- First trade - initialize
    IF NEW.trade_type = 'buy' THEN
      v_new_balance := NEW.token_amount;
    ELSE
      -- Selling without buying first? Use 0
      v_new_balance := 0;
    END IF;
  ELSE
    -- Update existing balance
    IF NEW.trade_type = 'buy' THEN
      v_new_balance := v_current_balance + NEW.token_amount;
    ELSE
      v_new_balance := GREATEST(0, v_current_balance - NEW.token_amount);
    END IF;
  END IF;

  -- Upsert the balance (won't fail on constraint violations)
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at
  ) VALUES (
    NEW.user_id,
    NEW.pool_address,
    NEW.post_id,
    v_new_balance,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = GREATEST(0, v_new_balance), -- Never go negative
    total_bought = user_pool_balances.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the trade insertion
    RAISE WARNING 'Failed to update user balance: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_balance_after_trade_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_implied_relevance_indexer"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."upsert_implied_relevance_indexer"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_implied_relevance_indexer"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) IS 'Atomically upserts implied relevance from event indexer with proper conflict handling for recorded_by field';



CREATE OR REPLACE FUNCTION "public"."upsert_implied_relevance_server"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."upsert_implied_relevance_server"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_implied_relevance_server"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) IS 'Atomically upserts implied relevance from server without overwriting confirmed indexer data';



CREATE OR REPLACE FUNCTION "public"."validate_stake_invariant"("p_agent_id" "uuid", "p_trade_context" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_stake bigint;
  v_total_locks bigint;
  v_deficit bigint;
BEGIN
  -- Get current stake
  SELECT total_stake INTO v_total_stake
  FROM agents
  WHERE id = p_agent_id;

  -- Get sum of all locks across ALL pools for this agent's user
  SELECT COALESCE(SUM(upb.belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances upb
  INNER JOIN users u ON u.id = upb.user_id
  WHERE u.agent_id = p_agent_id
    AND upb.token_balance > 0;

  -- Check invariant
  IF v_total_stake < v_total_locks THEN
    v_deficit := v_total_locks - v_total_stake;
    RAISE EXCEPTION 'INVARIANT VIOLATION: total_stake (%) < total_locks (%). Deficit: % micro-USDC. Context: %',
      v_total_stake, v_total_locks, v_deficit, p_trade_context;
  END IF;

  RAISE NOTICE 'Stake invariant OK: stake=% >= locks=% (context: %)', v_total_stake, v_total_locks, p_trade_context;
END;
$$;


ALTER FUNCTION "public"."validate_stake_invariant"("p_agent_id" "uuid", "p_trade_context" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_stake_invariant"("p_agent_id" "uuid", "p_trade_context" "text") IS 'Validates that total_stake >= sum(all belief_locks).
Throws exception if invariant is violated.
This should be called at the END of record_trade_atomic to catch any skim calculation bugs.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "solana_address" "text",
    "total_stake" bigint DEFAULT 0 NOT NULL,
    "total_deposited" numeric DEFAULT 0,
    "total_withdrawn" numeric DEFAULT 0,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agents_total_stake_non_negative" CHECK (("total_stake" >= 0)),
    CONSTRAINT "agents_total_stake_positive" CHECK ((("total_stake")::numeric >= (0)::numeric))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."agents" IS 'Protocol-level agents with Solana wallet integration and stake tracking. Stake locks tracked per-pool in user_pool_balances.';



COMMENT ON COLUMN "public"."agents"."solana_address" IS 'User''s Solana wallet address - primary identity for the protocol';



COMMENT ON COLUMN "public"."agents"."total_deposited" IS 'Total USDC deposited into custodian (all time)';



COMMENT ON COLUMN "public"."agents"."total_withdrawn" IS 'Total USDC withdrawn from custodian (all time)';



COMMENT ON COLUMN "public"."agents"."last_synced_at" IS 'Last time total_stake was synced from on-chain custodian';



CREATE TABLE IF NOT EXISTS "public"."belief_relevance_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "epoch" integer NOT NULL,
    "aggregate" numeric NOT NULL,
    "certainty" numeric NOT NULL,
    "disagreement_entropy" numeric,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "belief_relevance_history_aggregate_check" CHECK ((("aggregate" >= (0)::numeric) AND ("aggregate" <= (1)::numeric))),
    CONSTRAINT "belief_relevance_history_certainty_check" CHECK ((("certainty" >= (0)::numeric) AND ("certainty" <= (1)::numeric)))
);


ALTER TABLE "public"."belief_relevance_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."belief_relevance_history" IS 'Historical belief metrics per epoch for delta relevance charts';



COMMENT ON COLUMN "public"."belief_relevance_history"."aggregate" IS 'Absolute BD relevance score [0,1] for this epoch (used for pool settlement)';



CREATE TABLE IF NOT EXISTS "public"."belief_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "belief" numeric(10,8) NOT NULL,
    "meta_prediction" numeric(10,8) NOT NULL,
    "epoch" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "belief_submissions_belief_check" CHECK ((("belief" >= (0)::numeric) AND ("belief" <= (1)::numeric))),
    CONSTRAINT "belief_submissions_meta_prediction_check" CHECK ((("meta_prediction" >= (0)::numeric) AND ("meta_prediction" <= (1)::numeric)))
);


ALTER TABLE "public"."belief_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."belief_submissions" IS 'Agent submissions to belief markets with belief and meta-prediction';



CREATE TABLE IF NOT EXISTS "public"."beliefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_agent_id" "uuid" NOT NULL,
    "created_epoch" integer DEFAULT 0 NOT NULL,
    "previous_aggregate" numeric(10,8) DEFAULT 0.5 NOT NULL,
    "previous_disagreement_entropy" numeric(10,8) DEFAULT 0.0 NOT NULL,
    "certainty" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_processed_epoch" integer,
    CONSTRAINT "beliefs_certainty_check" CHECK ((("certainty" >= (0)::numeric) AND ("certainty" <= (1)::numeric))),
    CONSTRAINT "beliefs_previous_aggregate_check" CHECK ((("previous_aggregate" >= (0)::numeric) AND ("previous_aggregate" <= (1)::numeric)))
);


ALTER TABLE "public"."beliefs" OWNER TO "postgres";


COMMENT ON TABLE "public"."beliefs" IS 'Belief markets for intersubjective consensus using Bayesian Truth Serum (persist indefinitely)';



COMMENT ON COLUMN "public"."beliefs"."certainty" IS 'Certainty metric from learning assessment (NOT uncertainty)';



COMMENT ON COLUMN "public"."beliefs"."last_processed_epoch" IS 'The last epoch for which this belief was processed (epoch processing run). Prevents reprocessing the same epoch multiple times if settlement transaction fails.';



CREATE TABLE IF NOT EXISTS "public"."custodian_deposits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "depositor_address" "text" NOT NULL,
    "amount_usdc" numeric NOT NULL,
    "tx_signature" "text" NOT NULL,
    "block_time" timestamp with time zone,
    "slot" bigint,
    "indexed_at" timestamp with time zone DEFAULT "now"(),
    "agent_credited" boolean DEFAULT false,
    "credited_at" timestamp with time zone,
    "agent_id" "uuid",
    "deposit_type" "text" DEFAULT 'direct'::"text",
    "recorded_by" "text" DEFAULT 'indexer'::"text",
    "confirmed" boolean DEFAULT false,
    CONSTRAINT "custodian_deposits_deposit_type_check" CHECK (("deposit_type" = ANY (ARRAY['trade_skim'::"text", 'direct'::"text"]))),
    CONSTRAINT "custodian_deposits_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"])))
);


ALTER TABLE "public"."custodian_deposits" OWNER TO "postgres";


COMMENT ON TABLE "public"."custodian_deposits" IS 'Event log for USDC deposits into VeritasCustodian contracts (indexed via webhook)';



COMMENT ON COLUMN "public"."custodian_deposits"."deposit_type" IS 'Whether deposit came from trade skim or direct deposit';



COMMENT ON COLUMN "public"."custodian_deposits"."recorded_by" IS 'Which system created this record first (server or indexer)';



COMMENT ON COLUMN "public"."custodian_deposits"."confirmed" IS 'Has on-chain event verified this transaction?';



CREATE TABLE IF NOT EXISTS "public"."custodian_withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "amount_usdc" numeric NOT NULL,
    "recipient_address" "text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "requested_by_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "tx_signature" "text",
    "processed_at" timestamp with time zone,
    "block_time" timestamp with time zone,
    "rejection_reason" "text",
    "failure_reason" "text",
    "recorded_by" "text" DEFAULT 'indexer'::"text",
    "confirmed" boolean DEFAULT false,
    CONSTRAINT "custodian_withdrawals_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "custodian_withdrawals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."custodian_withdrawals" OWNER TO "postgres";


COMMENT ON TABLE "public"."custodian_withdrawals" IS 'Withdrawal requests and execution status';



COMMENT ON COLUMN "public"."custodian_withdrawals"."recorded_by" IS 'Which system created this record first (server or indexer)';



COMMENT ON COLUMN "public"."custodian_withdrawals"."confirmed" IS 'Has on-chain event verified this transaction?';



CREATE TABLE IF NOT EXISTS "public"."epoch_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "epoch_number" integer NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "scheduled_duration_seconds" integer NOT NULL,
    "actual_duration_seconds" integer,
    "processing_triggered_at" timestamp with time zone,
    "processing_completed_at" timestamp with time zone,
    "processing_duration_ms" integer,
    "beliefs_processed" integer DEFAULT 0,
    "beliefs_expired" integer DEFAULT 0,
    "manual_triggered" boolean DEFAULT false,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "epoch_history_duration_positive" CHECK (("scheduled_duration_seconds" > 0)),
    CONSTRAINT "epoch_history_epoch_number_positive" CHECK (("epoch_number" >= 0)),
    CONSTRAINT "epoch_history_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'failed'::"text", 'timeout'::"text"]))),
    CONSTRAINT "epoch_history_timing_consistent" CHECK (((("ended_at" IS NULL) OR ("ended_at" >= "started_at")) AND (("processing_completed_at" IS NULL) OR ("processing_triggered_at" IS NULL) OR ("processing_completed_at" >= "processing_triggered_at"))))
);


ALTER TABLE "public"."epoch_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."epoch_history" IS 'Tracks epoch transitions, processing metrics, and timing accuracy';



CREATE TABLE IF NOT EXISTS "public"."implied_relevance_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "implied_relevance" numeric NOT NULL,
    "reserve_long" numeric NOT NULL,
    "reserve_short" numeric NOT NULL,
    "event_type" "text" NOT NULL,
    "event_reference" "text" NOT NULL,
    "confirmed" boolean DEFAULT false NOT NULL,
    "recorded_by" "text" DEFAULT 'server'::"text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "implied_relevance_history_event_type_check" CHECK (("event_type" = ANY (ARRAY['trade'::"text", 'deployment'::"text", 'rebase'::"text"]))),
    CONSTRAINT "implied_relevance_history_implied_relevance_check" CHECK ((("implied_relevance" >= (0)::numeric) AND ("implied_relevance" <= (1)::numeric))),
    CONSTRAINT "implied_relevance_history_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "implied_relevance_history_reserve_long_check" CHECK (("reserve_long" >= (0)::numeric)),
    CONSTRAINT "implied_relevance_history_reserve_short_check" CHECK (("reserve_short" >= (0)::numeric))
);


ALTER TABLE "public"."implied_relevance_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."implied_relevance_history" IS 'Tracks market-implied relevance over time based on reserve ratios. Used to compare trader predictions against actual BD relevance scores.';



COMMENT ON COLUMN "public"."implied_relevance_history"."implied_relevance" IS 'Market-implied relevance: reserve_long / (reserve_long + reserve_short). Shows what traders collectively predict the relevance to be.';



COMMENT ON COLUMN "public"."implied_relevance_history"."reserve_long" IS 'Reserve state for LONG side at time of recording (in USDC display units)';



COMMENT ON COLUMN "public"."implied_relevance_history"."reserve_short" IS 'Reserve state for SHORT side at time of recording (in USDC display units)';



COMMENT ON COLUMN "public"."implied_relevance_history"."event_type" IS 'Event that triggered this recording: trade, deployment, or rebase';



COMMENT ON COLUMN "public"."implied_relevance_history"."event_reference" IS 'Transaction signature, pool address, etc. for idempotency';



COMMENT ON COLUMN "public"."implied_relevance_history"."confirmed" IS 'Whether this event was confirmed on-chain';



COMMENT ON COLUMN "public"."implied_relevance_history"."recorded_by" IS 'Source that recorded this: server or indexer';



CREATE TABLE IF NOT EXISTS "public"."pool_deployments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "pool_address" "text" NOT NULL,
    "deployed_at" timestamp with time zone DEFAULT "now"(),
    "deployed_by_agent_id" "uuid",
    "deployment_tx_signature" "text",
    "token_supply" numeric DEFAULT 0,
    "reserve" numeric DEFAULT 0,
    "last_synced_at" timestamp with time zone,
    "f" integer DEFAULT 1,
    "beta_num" integer DEFAULT 1,
    "beta_den" integer DEFAULT 2,
    "long_mint_address" "text",
    "short_mint_address" "text",
    "status" "text" DEFAULT 'pool_created'::"text" NOT NULL,
    "sqrt_price_long_x96" "text",
    "sqrt_price_short_x96" "text",
    "s_long_supply" numeric,
    "s_short_supply" numeric,
    "vault_balance" numeric,
    "sqrt_lambda_long_x96" "text",
    "sqrt_lambda_short_x96" "text",
    "initial_usdc" numeric,
    "initial_long_allocation" numeric,
    "initial_short_allocation" numeric,
    "r_long" numeric,
    "r_short" numeric,
    "market_deployed_at" timestamp with time zone,
    "market_deployment_tx_signature" "text",
    "last_settlement_epoch" integer,
    "last_settlement_tx" "text",
    "current_epoch" integer DEFAULT 0 NOT NULL,
    "cached_price_long" numeric,
    "cached_price_short" numeric,
    "prices_last_updated_at" timestamp with time zone,
    "s_scale_long_q64" numeric NOT NULL,
    "s_scale_short_q64" numeric NOT NULL,
    CONSTRAINT "pool_deployments_status_check" CHECK (("status" = ANY (ARRAY['pool_created'::"text", 'market_deployed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."pool_deployments" OWNER TO "postgres";


COMMENT ON TABLE "public"."pool_deployments" IS 'Tracks ContentPool deployments on Solana. ICBS two-sided market with LONG/SHORT tokens. Schema aligned with ContentPool smart contract v2.';



COMMENT ON COLUMN "public"."pool_deployments"."token_supply" IS 'DEPRECATED: Old single-sided token supply. Use s_long_supply and s_short_supply instead.';



COMMENT ON COLUMN "public"."pool_deployments"."reserve" IS 'DEPRECATED: Old single-sided reserve. Use r_long and r_short instead.';



COMMENT ON COLUMN "public"."pool_deployments"."last_synced_at" IS 'Last time pool data was synced from Solana';



COMMENT ON COLUMN "public"."pool_deployments"."f" IS 'ICBS growth exponent (FIXED at 1 for all pools)';



COMMENT ON COLUMN "public"."pool_deployments"."beta_num" IS 'ICBS β numerator (default: 1)';



COMMENT ON COLUMN "public"."pool_deployments"."beta_den" IS 'ICBS β denominator (default: 2, so β = 0.5)';



COMMENT ON COLUMN "public"."pool_deployments"."long_mint_address" IS 'SPL token mint for LONG tokens (created on pool initialization)';



COMMENT ON COLUMN "public"."pool_deployments"."short_mint_address" IS 'SPL token mint for SHORT tokens (created on pool initialization)';



COMMENT ON COLUMN "public"."pool_deployments"."status" IS 'Deployment status: pool_created (pool exists but no liquidity), market_deployed (fully deployed with liquidity), failed (deployment failed)';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_price_long_x96" IS 'Cached LONG token sqrt price in X96 format from on-chain';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_price_short_x96" IS 'Cached SHORT token sqrt price in X96 format from on-chain';



COMMENT ON COLUMN "public"."pool_deployments"."s_long_supply" IS 'LONG token supply in atomic units (6 decimals). On-chain ContentPool.s_long stores display units; converted to atomic for DB storage (display × 1,000,000).';



COMMENT ON COLUMN "public"."pool_deployments"."s_short_supply" IS 'SHORT token supply in atomic units (6 decimals). On-chain ContentPool.s_short stores display units; converted to atomic for DB storage (display × 1,000,000).';



COMMENT ON COLUMN "public"."pool_deployments"."vault_balance" IS 'Cached USDC vault balance (micro-USDC, 6 decimals)';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_lambda_long_x96" IS 'DEPRECATED: Telemetry only. Lambda is now derived from vault + sigma scales.';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_lambda_short_x96" IS 'DEPRECATED: Telemetry only. Lambda is now derived from vault + sigma scales.';



COMMENT ON COLUMN "public"."pool_deployments"."initial_usdc" IS 'Total USDC deposited at market deployment (micro-USDC, 6 decimals)';



COMMENT ON COLUMN "public"."pool_deployments"."initial_long_allocation" IS 'Initial USDC allocated to LONG side (micro-USDC)';



COMMENT ON COLUMN "public"."pool_deployments"."initial_short_allocation" IS 'Initial USDC allocated to SHORT side (micro-USDC)';



COMMENT ON COLUMN "public"."pool_deployments"."r_long" IS 'Virtual reserve for LONG side: R_L = s_L × p_L (cached from on-chain)';



COMMENT ON COLUMN "public"."pool_deployments"."r_short" IS 'Virtual reserve for SHORT side: R_S = s_S × p_S (cached from on-chain)';



COMMENT ON COLUMN "public"."pool_deployments"."market_deployed_at" IS 'When deploy_market instruction was executed (initial liquidity added)';



COMMENT ON COLUMN "public"."pool_deployments"."market_deployment_tx_signature" IS 'Transaction signature of deploy_market instruction';



COMMENT ON COLUMN "public"."pool_deployments"."last_settlement_epoch" IS 'Most recent epoch this pool was settled';



COMMENT ON COLUMN "public"."pool_deployments"."last_settlement_tx" IS 'Transaction signature of most recent settlement';



COMMENT ON COLUMN "public"."pool_deployments"."current_epoch" IS 'Current epoch for this pool (increments on settlement, independent per-pool counter)';



COMMENT ON COLUMN "public"."pool_deployments"."cached_price_long" IS 'Cached LONG token price in USDC (updated periodically for fast queries)';



COMMENT ON COLUMN "public"."pool_deployments"."cached_price_short" IS 'Cached SHORT token price in USDC (updated periodically for fast queries)';



COMMENT ON COLUMN "public"."pool_deployments"."prices_last_updated_at" IS 'When cached prices were last updated from on-chain data';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "post_type" "text",
    "content_json" "jsonb",
    "media_urls" "text"[],
    "caption" "text",
    "content_text" "text",
    "article_title" "text",
    "cover_image_url" "text",
    "total_volume_usdc" numeric(20,6) DEFAULT 0,
    "image_display_mode" "text" DEFAULT 'contain'::"text",
    CONSTRAINT "posts_article_title_length" CHECK ((("article_title" IS NULL) OR (("char_length"("article_title") >= 1) AND ("char_length"("article_title") <= 200)))),
    CONSTRAINT "posts_caption_length_check" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 280))),
    CONSTRAINT "posts_cover_requires_title" CHECK ((("cover_image_url" IS NULL) OR ("article_title" IS NOT NULL))),
    CONSTRAINT "posts_image_display_mode_check" CHECK (("image_display_mode" = ANY (ARRAY['contain'::"text", 'cover'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."posts" IS 'All posts must have an associated belief. No multimedia support.';



COMMENT ON COLUMN "public"."posts"."belief_id" IS 'Required reference to the belief market for this post';



COMMENT ON COLUMN "public"."posts"."post_type" IS 'Content type: text, image, or video. Added in Phase 1 for rich media support.';



COMMENT ON COLUMN "public"."posts"."content_json" IS 'Tiptap JSON for rich text posts. Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."media_urls" IS 'Array of media URLs for image/video posts. Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."caption" IS 'Optional caption for all post types (max 280 chars). Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."content_text" IS 'Plain text extracted from content_json or caption for search. Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."article_title" IS 'Optional dedicated title for text/article posts. Displayed prominently on post cards.';



COMMENT ON COLUMN "public"."posts"."cover_image_url" IS 'Optional cover/hero image URL for text/article posts. Requires article_title to be set.';



COMMENT ON COLUMN "public"."posts"."total_volume_usdc" IS 'Cached all-time total trading volume in USDC (sum of all buy and sell amounts)';



COMMENT ON COLUMN "public"."posts"."image_display_mode" IS 'How to display image posts: contain (full image with letterbox) or cover (cropped to fill card)';



CREATE TABLE IF NOT EXISTS "public"."stake_redistribution_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "epoch" integer NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "information_score" numeric(10,8) NOT NULL,
    "belief_weight" numeric NOT NULL,
    "normalized_weight" numeric NOT NULL,
    "stake_before" bigint NOT NULL,
    "stake_delta" bigint NOT NULL,
    "stake_after" bigint NOT NULL,
    "recorded_by" "text" DEFAULT 'server'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stake_redistribution_events_belief_weight_check" CHECK (("belief_weight" >= (0)::numeric)),
    CONSTRAINT "stake_redistribution_events_information_score_check" CHECK ((("information_score" >= ('-1'::integer)::numeric) AND ("information_score" <= (1)::numeric))),
    CONSTRAINT "stake_redistribution_events_normalized_weight_check" CHECK ((("normalized_weight" >= (0)::numeric) AND ("normalized_weight" <= (1)::numeric))),
    CONSTRAINT "stake_redistribution_events_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "stake_redistribution_events_stake_after_check" CHECK (("stake_after" >= 0)),
    CONSTRAINT "stake_redistribution_events_stake_before_check" CHECK (("stake_before" >= 0))
);


ALTER TABLE "public"."stake_redistribution_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."stake_redistribution_events" IS 'Audit trail of all stake redistributions from BTS scoring. Each row represents a reward (positive delta) or penalty (negative delta) for one agent in one epoch.';



COMMENT ON COLUMN "public"."stake_redistribution_events"."information_score" IS 'BTS information score for this agent, range [-1, 1]';



COMMENT ON COLUMN "public"."stake_redistribution_events"."belief_weight" IS 'Raw belief weight (2% of last trade amount in micro-USDC)';



COMMENT ON COLUMN "public"."stake_redistribution_events"."normalized_weight" IS 'Normalized weight (sums to 1.0 across all agents)';



COMMENT ON COLUMN "public"."stake_redistribution_events"."stake_delta" IS 'Change in stake: positive = reward, negative = penalty (micro-USDC)';



CREATE OR REPLACE VIEW "public"."redistribution_summary" AS
 SELECT "belief_id",
    "epoch",
    "count"(DISTINCT "agent_id") AS "participant_count",
    "sum"(
        CASE
            WHEN ("stake_delta" > 0) THEN 1
            ELSE 0
        END) AS "winner_count",
    "sum"(
        CASE
            WHEN ("stake_delta" < 0) THEN 1
            ELSE 0
        END) AS "loser_count",
    "sum"(
        CASE
            WHEN ("stake_delta" > 0) THEN "stake_delta"
            ELSE (0)::bigint
        END) AS "total_rewards_micro",
    "sum"(
        CASE
            WHEN ("stake_delta" < 0) THEN "abs"("stake_delta")
            ELSE (0)::bigint
        END) AS "total_slashes_micro",
    "sum"("stake_delta") AS "net_delta_micro",
    ("abs"("sum"("stake_delta")) <= (1)::numeric) AS "is_zero_sum",
    "min"("processed_at") AS "processed_at"
   FROM "public"."stake_redistribution_events" "sre"
  GROUP BY "belief_id", "epoch"
  ORDER BY ("min"("processed_at")) DESC;


ALTER VIEW "public"."redistribution_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."redistribution_summary" IS 'Summary of each redistribution event showing winners/losers and zero-sum validation. Use this to verify that all redistributions maintain the zero-sum property.';



CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pool_address" "text" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "epoch" integer NOT NULL,
    "bd_relevance_score" numeric NOT NULL,
    "market_prediction_q" numeric NOT NULL,
    "f_long" numeric NOT NULL,
    "f_short" numeric NOT NULL,
    "reserve_long_before" bigint NOT NULL,
    "reserve_long_after" bigint NOT NULL,
    "reserve_short_before" bigint NOT NULL,
    "reserve_short_after" bigint NOT NULL,
    "tx_signature" "text",
    "recorded_by" "text" DEFAULT 'indexer'::"text" NOT NULL,
    "confirmed" boolean DEFAULT false NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "s_scale_long_before" numeric,
    "s_scale_long_after" numeric,
    "s_scale_short_before" numeric,
    "s_scale_short_after" numeric,
    CONSTRAINT "settlements_bd_relevance_score_check" CHECK ((("bd_relevance_score" >= (0)::numeric) AND ("bd_relevance_score" <= (1)::numeric))),
    CONSTRAINT "settlements_f_long_check" CHECK (("f_long" >= (0)::numeric)),
    CONSTRAINT "settlements_f_short_check" CHECK (("f_short" >= (0)::numeric)),
    CONSTRAINT "settlements_market_prediction_q_check" CHECK ((("market_prediction_q" >= (0)::numeric) AND ("market_prediction_q" <= (1)::numeric))),
    CONSTRAINT "settlements_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['indexer'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."settlements" IS 'Historical record of pool settlements from on-chain SettlementEvent';



COMMENT ON COLUMN "public"."settlements"."bd_relevance_score" IS 'BD (Belief Decomposition) relevance score x ∈ [0,1] used for settlement';



COMMENT ON COLUMN "public"."settlements"."market_prediction_q" IS 'Market prediction q = R_long / (R_long + R_short) before settlement';



COMMENT ON COLUMN "public"."settlements"."f_long" IS 'Settlement factor for LONG side: f_long = x / q';



COMMENT ON COLUMN "public"."settlements"."f_short" IS 'Settlement factor for SHORT side: f_short = (1-x) / (1-q)';



COMMENT ON COLUMN "public"."settlements"."reserve_long_before" IS 'LONG reserve in micro-USDC before settlement';



COMMENT ON COLUMN "public"."settlements"."reserve_long_after" IS 'LONG reserve in micro-USDC after settlement';



COMMENT ON COLUMN "public"."settlements"."reserve_short_before" IS 'SHORT reserve in micro-USDC before settlement';



COMMENT ON COLUMN "public"."settlements"."reserve_short_after" IS 'SHORT reserve in micro-USDC after settlement';



COMMENT ON COLUMN "public"."settlements"."recorded_by" IS 'Source that recorded this settlement: indexer (event-processor) or manual';



COMMENT ON COLUMN "public"."settlements"."confirmed" IS 'Whether settlement transaction was confirmed on-chain';



CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."system_health_dashboard" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."agents") AS "total_agents",
    ( SELECT "count"(*) AS "count"
           FROM "public"."check_all_agents_solvency"() "check_all_agents_solvency"("agent_id", "stake_usdc", "locks_usdc", "withdrawable_usdc", "status", "deficit_usdc")
          WHERE ("check_all_agents_solvency"."status" = '❌ UNDERWATER'::"text")) AS "agents_underwater",
    ( SELECT "sum"("check_all_agents_solvency"."deficit_usdc") AS "sum"
           FROM "public"."check_all_agents_solvency"() "check_all_agents_solvency"("agent_id", "stake_usdc", "locks_usdc", "withdrawable_usdc", "status", "deficit_usdc")) AS "total_deficit_usdc",
    ( SELECT "count"(*) AS "count"
           FROM "public"."check_belief_lock_units"() "check_belief_lock_units"("pool_address", "token_type", "belief_lock", "lock_usdc", "status", "issue")
          WHERE ("check_belief_lock_units"."status" = '❌ FAIL'::"text")) AS "bad_locks_count",
    ( SELECT "reconcile_balance_sheet"."value_usdc"
           FROM "public"."reconcile_balance_sheet"() "reconcile_balance_sheet"("metric", "value_usdc", "status", "note")
          WHERE ("reconcile_balance_sheet"."metric" = 'Net Custodian Balance'::"text")) AS "custodian_balance_usdc",
    ( SELECT "reconcile_balance_sheet"."value_usdc"
           FROM "public"."reconcile_balance_sheet"() "reconcile_balance_sheet"("metric", "value_usdc", "status", "note")
          WHERE ("reconcile_balance_sheet"."metric" = 'Total Agent Stakes'::"text")) AS "total_stakes_usdc",
    ( SELECT "reconcile_balance_sheet"."value_usdc"
           FROM "public"."reconcile_balance_sheet"() "reconcile_balance_sheet"("metric", "value_usdc", "status", "note")
          WHERE ("reconcile_balance_sheet"."metric" = 'Total Locks'::"text")) AS "total_locks_usdc",
    ( SELECT "reconcile_balance_sheet"."value_usdc"
           FROM "public"."reconcile_balance_sheet"() "reconcile_balance_sheet"("metric", "value_usdc", "status", "note")
          WHERE ("reconcile_balance_sheet"."metric" = 'Difference (Custodian - Stakes)'::"text")) AS "balance_difference_usdc",
    ( SELECT "reconcile_balance_sheet"."status"
           FROM "public"."reconcile_balance_sheet"() "reconcile_balance_sheet"("metric", "value_usdc", "status", "note")
          WHERE ("reconcile_balance_sheet"."metric" = 'Difference (Custodian - Stakes)'::"text")) AS "balance_status";


ALTER VIEW "public"."system_health_dashboard" OWNER TO "postgres";


COMMENT ON VIEW "public"."system_health_dashboard" IS 'Quick overview of system health.
Check this regularly to detect data integrity issues early.
Red flags: agents_underwater > 0, bad_locks_count > 0, balance_status = ❌';



CREATE TABLE IF NOT EXISTS "public"."trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pool_address" "text" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "trade_type" "text" NOT NULL,
    "token_amount" numeric NOT NULL,
    "usdc_amount" numeric NOT NULL,
    "token_supply_after" numeric,
    "reserve_after" numeric,
    "tx_signature" "text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "recorded_by" "text" DEFAULT 'server'::"text",
    "confirmed" boolean DEFAULT false,
    "server_amount" numeric,
    "indexer_corrected" boolean DEFAULT false,
    "confirmed_at" timestamp with time zone,
    "indexed_at" timestamp with time zone,
    "block_time" timestamp with time zone,
    "slot" bigint,
    "side" "text",
    "f" integer,
    "beta_num" integer,
    "beta_den" integer,
    "sqrt_price_long_x96" "text",
    "sqrt_price_short_x96" "text",
    "price_long" numeric,
    "price_short" numeric,
    "s_long_before" numeric,
    "s_long_after" numeric,
    "s_short_before" numeric,
    "s_short_after" numeric,
    "r_long_before" numeric,
    "r_long_after" numeric,
    "r_short_before" numeric,
    "r_short_after" numeric,
    CONSTRAINT "trades_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "trades_reserve_after_check" CHECK (("reserve_after" >= (0)::numeric)),
    CONSTRAINT "trades_side_check" CHECK (("side" = ANY (ARRAY['LONG'::"text", 'SHORT'::"text"]))),
    CONSTRAINT "trades_token_amount_check" CHECK (("token_amount" > (0)::numeric)),
    CONSTRAINT "trades_token_supply_after_check" CHECK (("token_supply_after" >= (0)::numeric)),
    CONSTRAINT "trades_trade_type_check" CHECK (("trade_type" = ANY (ARRAY['buy'::"text", 'sell'::"text", 'liquidity_provision'::"text"]))),
    CONSTRAINT "trades_usdc_amount_check" CHECK (("usdc_amount" > (0)::numeric))
);


ALTER TABLE "public"."trades" OWNER TO "postgres";


COMMENT ON TABLE "public"."trades" IS 'Individual trades for ICBS two-sided markets. Tracks buy/sell of LONG (bullish) or SHORT (bearish) tokens. Supports dual-source indexing (server + on-chain events).';



COMMENT ON COLUMN "public"."trades"."trade_type" IS 'Type of trade: buy (directional long), sell (directional short), or liquidity_provision (bilateral non-predictive liquidity)';



COMMENT ON COLUMN "public"."trades"."token_amount" IS 'Token amount traded in display units (human-readable)';



COMMENT ON COLUMN "public"."trades"."usdc_amount" IS 'USDC amount traded in display units (human-readable)';



COMMENT ON COLUMN "public"."trades"."token_supply_after" IS 'LEGACY: Use s_long_after/s_short_after for ICBS pools';



COMMENT ON COLUMN "public"."trades"."reserve_after" IS 'LEGACY: Use r_long_after/r_short_after for ICBS pools';



COMMENT ON COLUMN "public"."trades"."recorded_by" IS 'Which system created this record first (server or indexer)';



COMMENT ON COLUMN "public"."trades"."confirmed" IS 'Has on-chain event verified this transaction?';



COMMENT ON COLUMN "public"."trades"."server_amount" IS 'Original server amount if indexer corrected it';



COMMENT ON COLUMN "public"."trades"."indexer_corrected" IS 'Did indexer overwrite incorrect server data?';



COMMENT ON COLUMN "public"."trades"."confirmed_at" IS 'When indexer confirmed this trade';



COMMENT ON COLUMN "public"."trades"."indexed_at" IS 'When event was indexed from blockchain';



COMMENT ON COLUMN "public"."trades"."block_time" IS 'Blockchain timestamp of transaction';



COMMENT ON COLUMN "public"."trades"."slot" IS 'Solana slot number';



COMMENT ON COLUMN "public"."trades"."side" IS 'Which token was traded: LONG (bullish) or SHORT (bearish). NULL for legacy trades or liquidity provision.';



COMMENT ON COLUMN "public"."trades"."f" IS 'ICBS growth exponent at time of trade';



COMMENT ON COLUMN "public"."trades"."beta_num" IS 'ICBS β numerator at time of trade';



COMMENT ON COLUMN "public"."trades"."beta_den" IS 'ICBS β denominator at time of trade';



COMMENT ON COLUMN "public"."trades"."sqrt_price_long_x96" IS 'LONG token sqrt price in X96 format at time of trade (from on-chain event)';



COMMENT ON COLUMN "public"."trades"."sqrt_price_short_x96" IS 'SHORT token sqrt price in X96 format at time of trade (from on-chain event)';



COMMENT ON COLUMN "public"."trades"."price_long" IS 'LONG token price in USDC at time of trade (human-readable, computed from sqrt_price_long_x96)';



COMMENT ON COLUMN "public"."trades"."price_short" IS 'SHORT token price in USDC at time of trade (human-readable, computed from sqrt_price_short_x96)';



COMMENT ON COLUMN "public"."trades"."s_long_before" IS 'LONG token supply before this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."s_long_after" IS 'LONG token supply after this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."s_short_before" IS 'SHORT token supply before this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."s_short_after" IS 'SHORT token supply after this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."r_long_before" IS 'LONG virtual reserve before this trade (R_L = s_L × p_L)';



COMMENT ON COLUMN "public"."trades"."r_long_after" IS 'LONG virtual reserve after this trade';



COMMENT ON COLUMN "public"."trades"."r_short_before" IS 'SHORT virtual reserve before this trade (R_S = s_S × p_S)';



COMMENT ON COLUMN "public"."trades"."r_short_after" IS 'SHORT virtual reserve after this trade';



CREATE TABLE IF NOT EXISTS "public"."user_pool_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pool_address" "text" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "token_balance" numeric DEFAULT 0 NOT NULL,
    "total_bought" numeric DEFAULT 0 NOT NULL,
    "total_sold" numeric DEFAULT 0 NOT NULL,
    "total_usdc_spent" numeric DEFAULT 0 NOT NULL,
    "total_usdc_received" numeric DEFAULT 0 NOT NULL,
    "first_trade_at" timestamp with time zone,
    "last_trade_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_buy_amount" bigint DEFAULT 0 NOT NULL,
    "belief_lock" bigint DEFAULT 0 NOT NULL,
    "token_type" "text" DEFAULT 'LONG'::"text" NOT NULL,
    "net_bought" numeric DEFAULT 0 NOT NULL,
    "realized_pnl" numeric DEFAULT 0,
    "entry_price" numeric,
    CONSTRAINT "user_pool_balances_belief_lock_non_negative" CHECK (("belief_lock" >= 0)),
    CONSTRAINT "user_pool_balances_token_balance_check" CHECK (("token_balance" >= (0)::numeric)),
    CONSTRAINT "user_pool_balances_token_type_check" CHECK (("token_type" = ANY (ARRAY['LONG'::"text", 'SHORT'::"text"])))
);


ALTER TABLE "public"."user_pool_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_pool_balances" IS 'ONE row per user-pool pair - current state (NOT history)';



COMMENT ON COLUMN "public"."user_pool_balances"."token_balance" IS 'Current token balance (total_bought - total_sold)';



COMMENT ON COLUMN "public"."user_pool_balances"."total_usdc_spent" IS 'Lifetime USDC spent on buys';



COMMENT ON COLUMN "public"."user_pool_balances"."total_usdc_received" IS 'Lifetime USDC received from sells';



COMMENT ON COLUMN "public"."user_pool_balances"."last_buy_amount" IS 'USDC amount (micro-USDC) of most recent buy in this pool - used to calculate belief_lock';



COMMENT ON COLUMN "public"."user_pool_balances"."belief_lock" IS 'Required stake lock: 2% of last_buy_amount. Only enforced while token_balance > 0. Auto-releases on full exit.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "auth_provider" "text",
    "auth_id" "text",
    "username" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "beliefs_created" integer DEFAULT 0 NOT NULL,
    "beliefs_participated" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_username_length" CHECK ((("char_length"("username") >= 2) AND ("char_length"("username") <= 50)))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'App-layer users. For stake information, join to agents table via agent_id.';



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_solana_address_key" UNIQUE ("solana_address");



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_belief_id_epoch_key" UNIQUE ("belief_id", "epoch");



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_agent_id_belief_id_key" UNIQUE ("agent_id", "belief_id");



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custodian_deposits"
    ADD CONSTRAINT "custodian_deposits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custodian_deposits"
    ADD CONSTRAINT "custodian_deposits_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."epoch_history"
    ADD CONSTRAINT "epoch_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."implied_relevance_history"
    ADD CONSTRAINT "implied_relevance_history_event_reference_key" UNIQUE ("event_reference");



ALTER TABLE ONLY "public"."implied_relevance_history"
    ADD CONSTRAINT "implied_relevance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_deployment_tx_signature_key" UNIQUE ("deployment_tx_signature");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_pool_address_key" UNIQUE ("pool_address");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pool_address_epoch_key" UNIQUE ("pool_address", "epoch");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."stake_redistribution_events"
    ADD CONSTRAINT "stake_redistribution_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."stake_redistribution_events"
    ADD CONSTRAINT "unique_redistribution_per_agent_epoch" UNIQUE ("belief_id", "epoch", "agent_id");



COMMENT ON CONSTRAINT "unique_redistribution_per_agent_epoch" ON "public"."stake_redistribution_events" IS 'Ensures each agent can only have one redistribution event per belief per epoch. Prevents double-counting if redistribution is called twice.';



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_pkey" PRIMARY KEY ("user_id", "pool_address", "token_type");



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_user_pool_side_key" UNIQUE ("user_id", "pool_address", "token_type");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_credentials_unique" UNIQUE ("auth_provider", "auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_agents_last_synced" ON "public"."agents" USING "btree" ("last_synced_at");



CREATE INDEX "idx_agents_solana_address" ON "public"."agents" USING "btree" ("solana_address");



CREATE INDEX "idx_balances_pool_balance" ON "public"."user_pool_balances" USING "btree" ("pool_address", "token_balance" DESC);



CREATE INDEX "idx_balances_user" ON "public"."user_pool_balances" USING "btree" ("user_id");



CREATE INDEX "idx_balances_user_pool" ON "public"."user_pool_balances" USING "btree" ("user_id", "pool_address");



CREATE INDEX "idx_belief_history_belief_epoch" ON "public"."belief_relevance_history" USING "btree" ("belief_id", "epoch" DESC);



CREATE INDEX "idx_belief_history_epoch_time" ON "public"."belief_relevance_history" USING "btree" ("epoch", "recorded_at");



CREATE INDEX "idx_belief_history_post_epoch" ON "public"."belief_relevance_history" USING "btree" ("post_id", "epoch" DESC);



CREATE INDEX "idx_belief_submissions_agent" ON "public"."belief_submissions" USING "btree" ("agent_id");



CREATE INDEX "idx_belief_submissions_belief" ON "public"."belief_submissions" USING "btree" ("belief_id");



CREATE INDEX "idx_belief_submissions_belief_agent" ON "public"."belief_submissions" USING "btree" ("belief_id", "agent_id");



CREATE INDEX "idx_belief_submissions_epoch" ON "public"."belief_submissions" USING "btree" ("epoch");



CREATE INDEX "idx_beliefs_certainty" ON "public"."beliefs" USING "btree" ("certainty") WHERE ("certainty" IS NOT NULL);



CREATE INDEX "idx_beliefs_creator_agent" ON "public"."beliefs" USING "btree" ("creator_agent_id");



CREATE INDEX "idx_beliefs_last_processed_epoch" ON "public"."beliefs" USING "btree" ("last_processed_epoch") WHERE ("last_processed_epoch" IS NOT NULL);



CREATE INDEX "idx_deposits_agent" ON "public"."custodian_deposits" USING "btree" ("agent_id");



CREATE INDEX "idx_deposits_block_time" ON "public"."custodian_deposits" USING "btree" ("block_time");



CREATE INDEX "idx_deposits_depositor" ON "public"."custodian_deposits" USING "btree" ("depositor_address");



CREATE INDEX "idx_deposits_pending" ON "public"."custodian_deposits" USING "btree" ("agent_credited") WHERE (NOT "agent_credited");



CREATE INDEX "idx_epoch_history_epoch_number" ON "public"."epoch_history" USING "btree" ("epoch_number");



CREATE INDEX "idx_epoch_history_started_at" ON "public"."epoch_history" USING "btree" ("started_at");



CREATE INDEX "idx_epoch_history_status" ON "public"."epoch_history" USING "btree" ("status");



CREATE INDEX "idx_implied_relevance_belief_time" ON "public"."implied_relevance_history" USING "btree" ("belief_id", "recorded_at" DESC);



CREATE INDEX "idx_implied_relevance_event_type" ON "public"."implied_relevance_history" USING "btree" ("event_type");



CREATE INDEX "idx_implied_relevance_post_time" ON "public"."implied_relevance_history" USING "btree" ("post_id", "recorded_at" DESC);



CREATE UNIQUE INDEX "idx_pool_deployments_belief" ON "public"."pool_deployments" USING "btree" ("belief_id");



CREATE INDEX "idx_pool_deployments_current_epoch" ON "public"."pool_deployments" USING "btree" ("current_epoch");



CREATE INDEX "idx_pool_deployments_deployed_by" ON "public"."pool_deployments" USING "btree" ("deployed_by_agent_id");



CREATE INDEX "idx_pool_deployments_last_synced" ON "public"."pool_deployments" USING "btree" ("last_synced_at");



CREATE INDEX "idx_pool_deployments_long_mint" ON "public"."pool_deployments" USING "btree" ("long_mint_address") WHERE ("long_mint_address" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_market_deployment_tx" ON "public"."pool_deployments" USING "btree" ("market_deployment_tx_signature") WHERE ("market_deployment_tx_signature" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_pool_address" ON "public"."pool_deployments" USING "btree" ("pool_address");



CREATE UNIQUE INDEX "idx_pool_deployments_post" ON "public"."pool_deployments" USING "btree" ("post_id");



CREATE INDEX "idx_pool_deployments_post_id" ON "public"."pool_deployments" USING "btree" ("post_id");



CREATE INDEX "idx_pool_deployments_post_sync" ON "public"."pool_deployments" USING "btree" ("post_id", "last_synced_at");



CREATE INDEX "idx_pool_deployments_prices" ON "public"."pool_deployments" USING "btree" ("sqrt_price_long_x96", "sqrt_price_short_x96") WHERE ("sqrt_price_long_x96" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_prices_updated" ON "public"."pool_deployments" USING "btree" ("prices_last_updated_at") WHERE ("prices_last_updated_at" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_settlement_epoch" ON "public"."pool_deployments" USING "btree" ("last_settlement_epoch") WHERE ("last_settlement_epoch" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_short_mint" ON "public"."pool_deployments" USING "btree" ("short_mint_address") WHERE ("short_mint_address" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_status" ON "public"."pool_deployments" USING "btree" ("status");



CREATE INDEX "idx_posts_article_title_search" ON "public"."posts" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("article_title", ''::"text")));



CREATE INDEX "idx_posts_belief_created" ON "public"."posts" USING "btree" ("belief_id", "created_at" DESC) WHERE ("belief_id" IS NOT NULL);



CREATE INDEX "idx_posts_belief_id" ON "public"."posts" USING "btree" ("belief_id");



CREATE INDEX "idx_posts_content_text_search" ON "public"."posts" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("content_text", ''::"text")));



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_created_at_desc" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_total_volume" ON "public"."posts" USING "btree" ("total_volume_usdc" DESC);



CREATE INDEX "idx_posts_type" ON "public"."posts" USING "btree" ("post_type");



CREATE INDEX "idx_posts_user_created" ON "public"."posts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_settlements_belief" ON "public"."settlements" USING "btree" ("belief_id");



CREATE INDEX "idx_settlements_epoch" ON "public"."settlements" USING "btree" ("epoch");



CREATE INDEX "idx_settlements_pool" ON "public"."settlements" USING "btree" ("pool_address");



CREATE INDEX "idx_settlements_post" ON "public"."settlements" USING "btree" ("post_id");



CREATE INDEX "idx_settlements_timestamp" ON "public"."settlements" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_settlements_tx" ON "public"."settlements" USING "btree" ("tx_signature");



CREATE INDEX "idx_stake_redistribution_agent" ON "public"."stake_redistribution_events" USING "btree" ("agent_id");



CREATE INDEX "idx_stake_redistribution_agent_time" ON "public"."stake_redistribution_events" USING "btree" ("agent_id", "processed_at");



CREATE INDEX "idx_stake_redistribution_belief" ON "public"."stake_redistribution_events" USING "btree" ("belief_id");



CREATE INDEX "idx_stake_redistribution_belief_epoch" ON "public"."stake_redistribution_events" USING "btree" ("belief_id", "epoch");



COMMENT ON INDEX "public"."idx_stake_redistribution_belief_epoch" IS 'Speeds up idempotency checks when verifying if redistribution already occurred for a belief/epoch pair';



CREATE INDEX "idx_stake_redistribution_epoch" ON "public"."stake_redistribution_events" USING "btree" ("epoch");



CREATE INDEX "idx_stake_redistribution_processed_at" ON "public"."stake_redistribution_events" USING "btree" ("processed_at");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_trades_block_time" ON "public"."trades" USING "btree" ("block_time") WHERE ("block_time" IS NOT NULL);



CREATE INDEX "idx_trades_confirmed" ON "public"."trades" USING "btree" ("confirmed") WHERE (NOT "confirmed");



CREATE INDEX "idx_trades_long" ON "public"."trades" USING "btree" ("pool_address", "recorded_at" DESC) WHERE ("side" = 'LONG'::"text");



CREATE INDEX "idx_trades_pool_time" ON "public"."trades" USING "btree" ("pool_address", "recorded_at" DESC);



CREATE INDEX "idx_trades_post_recorded_at" ON "public"."trades" USING "btree" ("post_id", "recorded_at" DESC);



CREATE INDEX "idx_trades_post_time" ON "public"."trades" USING "btree" ("post_id", "recorded_at" DESC);



CREATE INDEX "idx_trades_short" ON "public"."trades" USING "btree" ("pool_address", "recorded_at" DESC) WHERE ("side" = 'SHORT'::"text");



CREATE INDEX "idx_trades_side" ON "public"."trades" USING "btree" ("side") WHERE ("side" IS NOT NULL);



CREATE INDEX "idx_trades_time" ON "public"."trades" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_trades_tx" ON "public"."trades" USING "btree" ("tx_signature");



CREATE INDEX "idx_trades_user_time" ON "public"."trades" USING "btree" ("user_id", "recorded_at" DESC);



CREATE INDEX "idx_user_pool_balances_user_open" ON "public"."user_pool_balances" USING "btree" ("user_id", "pool_address", "token_type") WHERE ("token_balance" > (0)::numeric);



CREATE INDEX "idx_users_agent_id" ON "public"."users" USING "btree" ("agent_id");



CREATE INDEX "idx_users_auth_credentials" ON "public"."users" USING "btree" ("auth_provider", "auth_id") WHERE (("auth_provider" IS NOT NULL) AND ("auth_id" IS NOT NULL));



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("username");



CREATE INDEX "idx_withdrawals_agent" ON "public"."custodian_withdrawals" USING "btree" ("agent_id");



CREATE INDEX "idx_withdrawals_requested_at" ON "public"."custodian_withdrawals" USING "btree" ("requested_at");



CREATE INDEX "idx_withdrawals_status" ON "public"."custodian_withdrawals" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "trg_update_balance_after_trade_safe" AFTER INSERT ON "public"."trades" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_balance_after_trade_safe"();



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_creator_agent_id_fkey" FOREIGN KEY ("creator_agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custodian_deposits"
    ADD CONSTRAINT "custodian_deposits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_deployed_by_agent_id_fkey" FOREIGN KEY ("deployed_by_agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stake_redistribution_events"
    ADD CONSTRAINT "stake_redistribution_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stake_redistribution_events"
    ADD CONSTRAINT "stake_redistribution_events_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pool_address_fkey" FOREIGN KEY ("pool_address") REFERENCES "public"."pool_deployments"("pool_address") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_pool_address_fkey" FOREIGN KEY ("pool_address") REFERENCES "public"."pool_deployments"("pool_address") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public read access to implied_relevance_history" ON "public"."implied_relevance_history" FOR SELECT USING (true);



CREATE POLICY "Allow service role write access to implied_relevance_history" ON "public"."implied_relevance_history" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."implied_relevance_history" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_entry_price"("p_user_id" "uuid", "p_pool_address" "text", "p_token_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_entry_price"("p_user_id" "uuid", "p_pool_address" "text", "p_token_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_entry_price"("p_user_id" "uuid", "p_pool_address" "text", "p_token_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_implied_relevance"("p_reserve_long" numeric, "p_reserve_short" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_implied_relevance"("p_reserve_long" numeric, "p_reserve_short" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_implied_relevance"("p_reserve_long" numeric, "p_reserve_short" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock_readonly"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock_readonly"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock_readonly"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_all_agents_solvency"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_all_agents_solvency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_all_agents_solvency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_belief_lock_units"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_belief_lock_units"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_belief_lock_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_redistribution_zero_sum"("p_belief_id" "uuid", "p_epoch" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_redistribution_zero_sum"("p_belief_id" "uuid", "p_epoch" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_redistribution_zero_sum"("p_belief_id" "uuid", "p_epoch" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."deploy_pool_with_lock"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric, "p_f" integer, "p_beta_num" integer, "p_beta_den" integer, "p_long_mint_address" "text", "p_short_mint_address" "text", "p_s_long_supply" numeric, "p_s_short_supply" numeric, "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_vault_balance" numeric, "p_deployment_tx_signature" "text", "p_deployer_user_id" "uuid", "p_s_scale_long_q64" numeric, "p_s_scale_short_q64" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."deploy_pool_with_lock"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric, "p_f" integer, "p_beta_num" integer, "p_beta_den" integer, "p_long_mint_address" "text", "p_short_mint_address" "text", "p_s_long_supply" numeric, "p_s_short_supply" numeric, "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_vault_balance" numeric, "p_deployment_tx_signature" "text", "p_deployer_user_id" "uuid", "p_s_scale_long_q64" numeric, "p_s_scale_short_q64" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deploy_pool_with_lock"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric, "p_f" integer, "p_beta_num" integer, "p_beta_den" integer, "p_long_mint_address" "text", "p_short_mint_address" "text", "p_s_long_supply" numeric, "p_s_short_supply" numeric, "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_vault_balance" numeric, "p_deployment_tx_signature" "text", "p_deployer_user_id" "uuid", "p_s_scale_long_q64" numeric, "p_s_scale_short_q64" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_redistribution_history"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_redistribution_history"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_redistribution_history"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_epoch_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_epoch_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_epoch_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_holdings_with_entry_price"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_holdings_with_entry_price"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_holdings_with_entry_price"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_stake_state_after_trade"("p_agent_id" "uuid", "p_tx_signature" "text", "p_skim_credited" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."log_stake_state_after_trade"("p_agent_id" "uuid", "p_tx_signature" "text", "p_skim_credited" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_stake_state_after_trade"("p_agent_id" "uuid", "p_tx_signature" "text", "p_skim_credited" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reconcile_agent_stake"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_agent_stake"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_agent_stake"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reconcile_all_agents"() TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_all_agents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_all_agents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reconcile_balance_sheet"() TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_balance_sheet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_balance_sheet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric, "p_skim_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric, "p_skim_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_trade_atomic"("p_pool_address" "text", "p_post_id" "uuid", "p_user_id" "uuid", "p_wallet_address" "text", "p_trade_type" "text", "p_token_amount" numeric, "p_usdc_amount" numeric, "p_tx_signature" "text", "p_token_type" "text", "p_sqrt_price_long_x96" "text", "p_sqrt_price_short_x96" "text", "p_belief_id" "uuid", "p_agent_id" "uuid", "p_belief" numeric, "p_meta_prediction" numeric, "p_s_long_after" numeric, "p_s_short_after" numeric, "p_skim_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_withdrawal_atomic"("p_agent_id" "uuid", "p_amount_usdc" numeric, "p_tx_signature" "text", "p_wallet_address" "text", "p_authority_address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_withdrawal_atomic"("p_agent_id" "uuid", "p_amount_usdc" numeric, "p_tx_signature" "text", "p_wallet_address" "text", "p_authority_address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_withdrawal_atomic"("p_agent_id" "uuid", "p_amount_usdc" numeric, "p_tx_signature" "text", "p_wallet_address" "text", "p_authority_address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_implied_relevance_indexer"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_implied_relevance_indexer"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_implied_relevance_indexer"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_implied_relevance_server"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_implied_relevance_server"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_implied_relevance_server"("p_post_id" "uuid", "p_belief_id" "uuid", "p_implied_relevance" numeric, "p_reserve_long" numeric, "p_reserve_short" numeric, "p_event_type" "text", "p_event_reference" "text", "p_recorded_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_stake_invariant"("p_agent_id" "uuid", "p_trade_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_stake_invariant"("p_agent_id" "uuid", "p_trade_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_stake_invariant"("p_agent_id" "uuid", "p_trade_context" "text") TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."belief_relevance_history" TO "anon";
GRANT ALL ON TABLE "public"."belief_relevance_history" TO "authenticated";
GRANT ALL ON TABLE "public"."belief_relevance_history" TO "service_role";



GRANT ALL ON TABLE "public"."belief_submissions" TO "anon";
GRANT ALL ON TABLE "public"."belief_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."belief_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."beliefs" TO "anon";
GRANT ALL ON TABLE "public"."beliefs" TO "authenticated";
GRANT ALL ON TABLE "public"."beliefs" TO "service_role";



GRANT ALL ON TABLE "public"."custodian_deposits" TO "anon";
GRANT ALL ON TABLE "public"."custodian_deposits" TO "authenticated";
GRANT ALL ON TABLE "public"."custodian_deposits" TO "service_role";



GRANT ALL ON TABLE "public"."custodian_withdrawals" TO "anon";
GRANT ALL ON TABLE "public"."custodian_withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."custodian_withdrawals" TO "service_role";



GRANT ALL ON TABLE "public"."epoch_history" TO "anon";
GRANT ALL ON TABLE "public"."epoch_history" TO "authenticated";
GRANT ALL ON TABLE "public"."epoch_history" TO "service_role";



GRANT ALL ON TABLE "public"."implied_relevance_history" TO "anon";
GRANT ALL ON TABLE "public"."implied_relevance_history" TO "authenticated";
GRANT ALL ON TABLE "public"."implied_relevance_history" TO "service_role";



GRANT ALL ON TABLE "public"."pool_deployments" TO "anon";
GRANT ALL ON TABLE "public"."pool_deployments" TO "authenticated";
GRANT ALL ON TABLE "public"."pool_deployments" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."stake_redistribution_events" TO "anon";
GRANT ALL ON TABLE "public"."stake_redistribution_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stake_redistribution_events" TO "service_role";



GRANT ALL ON TABLE "public"."redistribution_summary" TO "anon";
GRANT ALL ON TABLE "public"."redistribution_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."redistribution_summary" TO "service_role";



GRANT ALL ON TABLE "public"."settlements" TO "anon";
GRANT ALL ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";



GRANT ALL ON TABLE "public"."system_config" TO "anon";
GRANT ALL ON TABLE "public"."system_config" TO "authenticated";
GRANT ALL ON TABLE "public"."system_config" TO "service_role";



GRANT ALL ON TABLE "public"."system_health_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."system_health_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health_dashboard" TO "service_role";



GRANT ALL ON TABLE "public"."trades" TO "anon";
GRANT ALL ON TABLE "public"."trades" TO "authenticated";
GRANT ALL ON TABLE "public"."trades" TO "service_role";



GRANT ALL ON TABLE "public"."user_pool_balances" TO "anon";
GRANT ALL ON TABLE "public"."user_pool_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pool_balances" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;

-- Migration: Add implied_relevance_history population to trade recording
-- Purpose: Populate implied_relevance_history table on every trade and pool deployment
-- This enables feed ranking based on market-implied relevance

-- Helper function to calculate implied relevance from reserves
CREATE OR REPLACE FUNCTION calculate_implied_relevance(
  p_reserve_long numeric,
  p_reserve_short numeric
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
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

COMMENT ON FUNCTION calculate_implied_relevance IS 'Calculates market-implied relevance from reserve ratio: reserve_long / (reserve_long + reserve_short)';

-- Update record_trade_atomic to also record implied relevance
DROP FUNCTION IF EXISTS "public"."record_trade_atomic" CASCADE;

CREATE OR REPLACE FUNCTION "public"."record_trade_atomic"(
  p_pool_address text,
  p_post_id uuid,
  p_user_id uuid,
  p_wallet_address text,
  p_trade_type text,
  p_token_amount numeric,
  p_usdc_amount numeric,
  p_tx_signature text,
  p_token_type text,
  p_sqrt_price_long_x96 text,
  p_sqrt_price_short_x96 text,
  p_belief_id uuid,
  p_agent_id uuid,
  p_belief numeric,
  p_meta_prediction numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade_id uuid;
  v_can_proceed boolean;
  v_skim_amount numeric;
  v_remaining_stake numeric;
  v_existing_balance numeric;
  v_existing_lock numeric;
  v_new_balance numeric;
  v_new_lock numeric;
  v_reserve_long numeric;
  v_reserve_short numeric;
  v_implied_relevance numeric;
BEGIN
  -- 1. Lock and read existing balance for this user/pool/side
  -- FOR UPDATE prevents race conditions between concurrent trades
  SELECT token_balance, belief_lock
  INTO v_existing_balance, v_existing_lock
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_token_type
  FOR UPDATE;  -- ← Critical: locks this row until transaction commits

  -- If no existing balance, initialize to zero
  v_existing_balance := COALESCE(v_existing_balance, 0);
  v_existing_lock := COALESCE(v_existing_lock, 0);

  -- 2. Calculate new balance based on trade type
  IF p_trade_type = 'buy' THEN
    v_new_balance := v_existing_balance + p_token_amount;
    -- For buys: set lock to 2% of USDC amount (in micro-USDC)
    v_new_lock := FLOOR(p_usdc_amount * 0.02);
  ELSIF p_trade_type = 'sell' THEN
    v_new_balance := v_existing_balance - p_token_amount;

    -- Validate sufficient balance for sell
    IF v_new_balance < 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_BALANCE',
        'message', 'Insufficient token balance for sell',
        'available', v_existing_balance,
        'required', p_token_amount
      );
    END IF;

    -- For sells: reduce lock proportionally based on tokens remaining
    -- Bug #2 Fix: Don't keep old lock, reduce it proportionally
    IF v_existing_balance > 0 THEN
      v_new_lock := FLOOR(v_existing_lock * (v_new_balance / v_existing_balance));
    ELSE
      v_new_lock := 0;
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRADE_TYPE',
      'message', 'Trade type must be buy or sell'
    );
  END IF;

  -- 3. Calculate skim with row-level locks
  SELECT skim_amount
  INTO v_skim_amount
  FROM calculate_skim_with_lock(
    p_user_id,
    p_wallet_address,
    p_pool_address,
    p_token_type,
    (p_usdc_amount * 1000000)::bigint  -- Convert USDC to micro-USDC
  );

  -- Assume we can proceed (skim calculation doesn't block anymore)
  v_can_proceed := true;
  v_remaining_stake := 0;  -- Not used in current implementation

  -- 4. Insert trade record
  -- Use ON CONFLICT because event indexer might have written already
  INSERT INTO trades (
    pool_address,
    post_id,
    user_id,
    wallet_address,
    trade_type,
    token_amount,
    usdc_amount,
    tx_signature,
    side,
    sqrt_price_long_x96,
    sqrt_price_short_x96,
    belief_lock_skim,
    recorded_by,
    confirmed
  ) VALUES (
    p_pool_address,
    p_post_id,
    p_user_id,
    p_wallet_address,
    p_trade_type,
    p_token_amount,
    p_usdc_amount,
    p_tx_signature,
    p_token_type,
    p_sqrt_price_long_x96,
    p_sqrt_price_short_x96,
    v_skim_amount,
    'server',
    false
  )
  ON CONFLICT (tx_signature) DO UPDATE SET
    confirmed = EXCLUDED.confirmed,
    recorded_by = 'both'
  RETURNING id INTO v_trade_id;

  -- 5. Upsert belief submission
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

  -- 6. Upsert user pool balance with the calculated values
  -- This happens AFTER the FOR UPDATE lock, so it's atomic
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    token_type,
    belief_lock,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    v_new_balance,
    p_token_type,
    v_new_lock,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = EXCLUDED.token_balance,
    belief_lock = EXCLUDED.belief_lock,
    updated_at = NOW();

  -- 7. NEW: Record implied relevance history
  -- Get current pool deployment state to calculate reserves
  SELECT
    COALESCE(s_long_supply, 0),
    COALESCE(s_short_supply, 0)
  INTO v_reserve_long, v_reserve_short
  FROM pool_deployments
  WHERE pool_address = p_pool_address;

  -- Calculate implied relevance
  v_implied_relevance := calculate_implied_relevance(v_reserve_long, v_reserve_short);

  -- Insert implied relevance record (idempotent on tx_signature)
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
    'trade',
    p_tx_signature,
    false, -- Not confirmed yet (on-chain confirmation pending)
    'server',
    NOW()
  )
  ON CONFLICT (event_reference) DO NOTHING; -- Idempotent

  -- Return success with trade ID and calculated values
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'skim_amount', v_skim_amount,
    'remaining_stake', v_remaining_stake,
    'new_balance', v_new_balance,
    'new_lock', v_new_lock,
    'implied_relevance', v_implied_relevance
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RAISE WARNING 'record_trade_atomic error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXCEPTION',
      'message', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION record_trade_atomic IS 'Atomically records trade, updates balances with FOR UPDATE locks, applies stake skim, and records implied relevance. Bug #1 and #2 fixes + implied relevance tracking.';

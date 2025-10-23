-- Add atomic trade recording function
-- This function combines trade insert + balance update + belief submission in one transaction

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
  p_meta_prediction numeric,
  p_token_balance numeric,
  p_belief_lock numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade_id uuid;
  v_can_proceed boolean;
  v_skim_amount numeric;
  v_remaining_stake numeric;
BEGIN
  -- 1. Calculate skim with row-level locks
  SELECT can_proceed, skim_amount, remaining_stake
  INTO v_can_proceed, v_skim_amount, v_remaining_stake
  FROM calculate_skim_with_lock(
    p_wallet_address,
    p_user_id,
    p_usdc_amount
  );

  -- If locked by another transaction, return immediately
  IF NOT v_can_proceed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'LOCKED',
      'message', 'Another trade in progress for this user'
    );
  END IF;

  -- 2. Insert trade record
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

  -- 3. Upsert belief submission
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

  -- 4. Upsert user pool balance
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    token_balance,
    token_type,
    belief_lock,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_token_balance,
    p_token_type,
    p_belief_lock,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = EXCLUDED.token_balance,
    belief_lock = EXCLUDED.belief_lock,
    updated_at = NOW();

  -- 5. Apply skim if needed (proportional to locked positions)
  IF v_skim_amount > 0 THEN
    -- Get total locks for this user
    DECLARE
      v_total_locks numeric;
    BEGIN
      SELECT COALESCE(SUM(belief_lock), 0) INTO v_total_locks
      FROM user_pool_balances
      WHERE user_id = p_user_id AND token_balance > 0;

      -- Only skim if there are locks
      IF v_total_locks > 0 THEN
        UPDATE user_pool_balances
        SET belief_lock = belief_lock * (1 - (v_skim_amount / v_total_locks))
        WHERE user_id = p_user_id AND token_balance > 0;
      END IF;
    END;
  END IF;

  -- Return success with trade ID
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'skim_amount', v_skim_amount,
    'remaining_stake', v_remaining_stake
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

COMMENT ON FUNCTION record_trade_atomic IS 'Atomically records trade, updates balances, and applies stake skim';

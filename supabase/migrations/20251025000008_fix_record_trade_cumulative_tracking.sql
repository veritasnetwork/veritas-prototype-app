-- Fix record_trade_atomic to properly maintain cumulative tracking columns
-- The function was only updating token_balance and belief_lock, not the cumulative totals

CREATE OR REPLACE FUNCTION record_trade_atomic(
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
  v_skim_amount numeric;
  v_token_balance numeric;
  v_belief_lock numeric;
  v_price_long numeric;
  v_price_short numeric;
  v_usdc_amount_micro numeric;
BEGIN
  -- Convert USDC to micro-USDC once at the start
  v_usdc_amount_micro := p_usdc_amount * 1000000;

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

  -- 3. Calculate belief lock (2% of trade amount for buys)
  IF p_trade_type = 'buy' THEN
    v_belief_lock := (v_usdc_amount_micro * 0.02)::bigint;  -- 2% of micro-USDC amount
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

  -- 5. Insert trade record
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
    v_usdc_amount_micro,  -- Already in micro-USDC
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

  -- 7. Upsert user pool balance WITH PROPER CUMULATIVE TRACKING
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    token_type,
    belief_lock,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    v_token_balance,
    p_token_type,
    v_belief_lock,
    CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    CASE WHEN p_trade_type = 'buy' THEN v_usdc_amount_micro ELSE 0 END,
    CASE WHEN p_trade_type = 'sell' THEN v_usdc_amount_micro ELSE 0 END,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = EXCLUDED.token_balance,
    belief_lock = EXCLUDED.belief_lock,
    -- FIXED: Properly accumulate the totals instead of replacing them
    total_bought = user_pool_balances.total_bought +
      CASE WHEN p_trade_type = 'buy' THEN p_token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN p_trade_type = 'sell' THEN p_token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN p_trade_type = 'buy' THEN v_usdc_amount_micro ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN p_trade_type = 'sell' THEN v_usdc_amount_micro ELSE 0 END,
    last_trade_at = NOW(),
    updated_at = NOW();

  -- Return success with trade ID
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'skim_amount', v_skim_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXCEPTION',
      'message', SQLERRM
    );
END;
$$
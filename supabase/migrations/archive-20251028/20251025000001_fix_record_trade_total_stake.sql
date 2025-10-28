-- Fix record_trade_atomic to update agents.total_stake instead of beliefs.total_stake
-- Also fix constraint issues

CREATE OR REPLACE FUNCTION record_trade_atomic(
  p_pool_address TEXT,
  p_post_id UUID,
  p_user_id UUID,
  p_wallet_address TEXT,
  p_trade_type TEXT,
  p_token_amount NUMERIC,
  p_usdc_amount NUMERIC,
  p_tx_signature TEXT,
  p_token_type TEXT,
  p_sqrt_price_long_x96 TEXT,
  p_sqrt_price_short_x96 TEXT,
  p_belief_id UUID,
  p_agent_id UUID,
  p_belief NUMERIC,
  p_meta_prediction NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_trade_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_belief_lock NUMERIC;
  v_skim_amount NUMERIC := 0;
  v_price_long NUMERIC;
  v_price_short NUMERIC;
  v_total_stake BIGINT;
BEGIN
  -- Lock the user's balance row for update to prevent race conditions
  SELECT token_balance INTO v_current_balance
  FROM user_pool_balances
  WHERE user_id = p_user_id AND pool_address = p_pool_address AND token_type = p_token_type
  FOR UPDATE;

  -- Calculate new balance
  IF p_trade_type = 'buy' THEN
    v_new_balance := COALESCE(v_current_balance, 0) + p_token_amount;
  ELSIF p_trade_type = 'sell' THEN
    IF COALESCE(v_current_balance, 0) < p_token_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_BALANCE',
        'message', 'Insufficient token balance for sell',
        'available', COALESCE(v_current_balance, 0),
        'required', p_token_amount
      );
    END IF;
    v_new_balance := v_current_balance - p_token_amount;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRADE_TYPE');
  END IF;

  -- Calculate prices from sqrt prices
  IF p_sqrt_price_long_x96 IS NOT NULL AND p_sqrt_price_long_x96 != '0' THEN
    v_price_long := POWER(p_sqrt_price_long_x96::NUMERIC / POWER(2, 96), 2);
  END IF;
  IF p_sqrt_price_short_x96 IS NOT NULL AND p_sqrt_price_short_x96 != '0' THEN
    v_price_short := POWER(p_sqrt_price_short_x96::NUMERIC / POWER(2, 96), 2);
  END IF;

  -- Insert trade record with 'server' as recorded_by
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
    p_token_amount,
    p_usdc_amount,
    p_tx_signature,
    p_token_type,
    p_sqrt_price_long_x96,
    p_sqrt_price_short_x96,
    v_price_long,
    v_price_short,
    'server',
    true
  ) RETURNING id INTO v_trade_id;

  -- Update user balance
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_type,
    token_balance,
    belief_lock
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    p_token_type,
    v_new_balance,
    0
  )
  ON CONFLICT (user_id, pool_address, token_type)
  DO UPDATE SET
    token_balance = v_new_balance,
    updated_at = NOW();

  -- Update agent's total_stake
  -- Calculate total stake from belief_lock across all pools for this user
  SELECT COALESCE(SUM(belief_lock), 0)
  INTO v_total_stake
  FROM user_pool_balances
  WHERE user_id = p_user_id;

  UPDATE agents
  SET total_stake = v_total_stake
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'new_balance', v_new_balance,
    'new_lock', v_belief_lock,
    'skim_amount', v_skim_amount
  );
END;
$$ LANGUAGE plpgsql;

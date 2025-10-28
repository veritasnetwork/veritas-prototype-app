-- Fix belief lock mechanics according to stake-mechanics.md spec
-- 1. On BUY: Replace lock with 2% of USDC amount (in micro-USDC)
-- 2. On SELL: Keep lock unchanged
-- 3. Total stake should NOT be sum of locks (it's skim-based)

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
  v_new_lock BIGINT;
  v_skim_amount BIGINT;
  v_price_long NUMERIC;
  v_price_short NUMERIC;
  v_usdc_amount_micro BIGINT;
BEGIN
  -- Convert USDC to micro-USDC (multiply by 1,000,000)
  v_usdc_amount_micro := (p_usdc_amount * 1000000)::BIGINT;

  -- Lock the user's balance row for update to prevent race conditions
  SELECT token_balance INTO v_current_balance
  FROM user_pool_balances
  WHERE user_id = p_user_id AND pool_address = p_pool_address AND token_type = p_token_type
  FOR UPDATE;

  -- Calculate new balance
  IF p_trade_type = 'buy' THEN
    v_new_balance := COALESCE(v_current_balance, 0) + p_token_amount;

    -- For buys: Calculate new lock = 2% of USDC amount (REPLACED, not accumulated)
    -- belief_lock is stored in micro-USDC
    v_new_lock := FLOOR(v_usdc_amount_micro * 0.02);

    -- Calculate skim using the calculate_skim_with_lock function
    SELECT skim_amount INTO v_skim_amount
    FROM calculate_skim_with_lock(
      p_user_id,
      p_wallet_address,
      p_pool_address,
      p_token_type,
      v_usdc_amount_micro
    );

    -- Apply skim to agent's total_stake
    IF v_skim_amount > 0 THEN
      UPDATE agents
      SET total_stake = total_stake + v_skim_amount
      WHERE id = p_agent_id;
    END IF;

  ELSIF p_trade_type = 'sell' THEN
    -- Validate sufficient balance
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

    -- For sells: Lock stays UNCHANGED (do not modify belief_lock)
    -- We'll use NULL to signal "don't update" in the UPSERT below
    v_new_lock := NULL;
    v_skim_amount := 0;

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

  -- Insert trade record
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
  )
  ON CONFLICT (tx_signature) DO NOTHING
  RETURNING id INTO v_trade_id;

  -- Update or insert user_pool_balances
  IF p_trade_type = 'buy' THEN
    -- BUY: Update both token_balance AND belief_lock
    INSERT INTO user_pool_balances (
      user_id,
      pool_address,
      post_id,
      token_type,
      token_balance,
      belief_lock,
      last_buy_amount,
      last_trade_at
    ) VALUES (
      p_user_id,
      p_pool_address,
      p_post_id,
      p_token_type,
      v_new_balance,
      v_new_lock,
      v_usdc_amount_micro,
      NOW()
    )
    ON CONFLICT (user_id, pool_address, token_type)
    DO UPDATE SET
      token_balance = v_new_balance,
      belief_lock = v_new_lock,  -- REPLACE lock on buy
      last_buy_amount = v_usdc_amount_micro,
      last_trade_at = NOW(),
      updated_at = NOW();
  ELSE
    -- SELL: Update ONLY token_balance, leave belief_lock unchanged
    INSERT INTO user_pool_balances (
      user_id,
      pool_address,
      post_id,
      token_type,
      token_balance,
      belief_lock,
      last_trade_at
    ) VALUES (
      p_user_id,
      p_pool_address,
      p_post_id,
      p_token_type,
      v_new_balance,
      0,  -- Will be overridden by DO UPDATE clause if row exists
      NOW()
    )
    ON CONFLICT (user_id, pool_address, token_type)
    DO UPDATE SET
      token_balance = v_new_balance,
      -- belief_lock NOT updated on sell
      last_trade_at = NOW(),
      updated_at = NOW();

    -- If position fully closed (balance = 0), delete the row to free the lock
    DELETE FROM user_pool_balances
    WHERE user_id = p_user_id
      AND pool_address = p_pool_address
      AND token_type = p_token_type
      AND token_balance = 0;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'new_balance', v_new_balance,
    'new_lock', COALESCE(v_new_lock, 0),
    'skim_amount', v_skim_amount
  );
END;
$$ LANGUAGE plpgsql;

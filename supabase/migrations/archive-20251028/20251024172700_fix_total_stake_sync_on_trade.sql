-- Fix: Update agents.total_stake when belief_lock changes during trades
-- Currently record_trade_atomic updates user_pool_balances.belief_lock but doesn't sync agents.total_stake

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
  v_existing_balance numeric := 0;
  v_existing_lock numeric := 0;
  v_token_balance numeric;
  v_belief_lock numeric;
  v_skim_amount numeric := 0;
  v_price_long numeric;
  v_price_short numeric;
  v_sqrt_price_long_x96_num numeric;
  v_sqrt_price_short_x96_num numeric;
  v_Q96 numeric := POWER(2::numeric, 96);
  v_lock_delta bigint := 0;  -- Track change in belief lock for stake update
BEGIN
  -- 1. Get existing balance and lock
  SELECT token_balance, belief_lock
  INTO v_existing_balance, v_existing_lock
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_token_type;

  -- Handle NULL values
  v_existing_balance := COALESCE(v_existing_balance, 0);
  v_existing_lock := COALESCE(v_existing_lock, 0);

  -- 2. Calculate new balances
  IF p_trade_type = 'buy' THEN
    -- Buy: add tokens, add to lock (2% of USDC spent)
    v_token_balance := v_existing_balance + p_token_amount;
    v_belief_lock := v_existing_lock + FLOOR(p_usdc_amount * 0.02);
    -- Track the delta for stake update
    v_lock_delta := FLOOR(p_usdc_amount * 0.02);
  ELSE
    -- Sell: subtract tokens, keep lock unchanged
    v_token_balance := v_existing_balance - p_token_amount;
    v_belief_lock := v_existing_lock;  -- DO NOT reduce lock on sell
    v_lock_delta := 0;  -- No change to stake on sell
  END IF;

  -- 3. Calculate human-readable prices from sqrt_price
  -- price = (sqrt_price_x96 / 2^96)^2 / 1_000_000 (convert lamports to USDC)
  v_sqrt_price_long_x96_num := p_sqrt_price_long_x96::numeric;
  v_sqrt_price_short_x96_num := p_sqrt_price_short_x96::numeric;
  v_price_long := POWER(v_sqrt_price_long_x96_num / v_Q96, 2) / 1000000;
  v_price_short := POWER(v_sqrt_price_short_x96_num / v_Q96, 2) / 1000000;

  -- 4. Insert trade record with human-readable prices
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
    'api',
    true
  ) RETURNING id INTO v_trade_id;

  -- 5. Update user balance with calculated lock
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    token_type,
    belief_lock
  ) VALUES (
    p_user_id,
    p_pool_address,
    p_post_id,
    v_token_balance,
    p_token_type,
    v_belief_lock
  )
  ON CONFLICT (user_id, pool_address, token_type) DO UPDATE SET
    token_balance = EXCLUDED.token_balance,
    belief_lock = EXCLUDED.belief_lock,
    updated_at = NOW();

  -- 6. Update agent's total_stake if belief lock changed
  IF v_lock_delta != 0 THEN
    PERFORM update_stake_atomic(p_agent_id, v_lock_delta);
  END IF;

  -- 7. Record implied relevance history
  -- Get current pool deployment state to calculate implied relevance
  INSERT INTO belief_relevance_history (
    belief_id,
    relevance_score,
    epoch,
    measured_at
  )
  SELECT
    p_belief_id,
    p_belief,  -- This should be the calculated implied relevance from pool state
    0,  -- epoch 0 = implied relevance (not from protocol settlement)
    NOW()
  WHERE p_belief_id IS NOT NULL;

  -- Return success with trade ID
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'token_balance', v_token_balance,
    'belief_lock', v_belief_lock
  );
END;
$$;

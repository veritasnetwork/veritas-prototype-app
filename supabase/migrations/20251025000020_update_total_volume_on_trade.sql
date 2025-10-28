-- Add automatic update of posts.total_volume_usdc when trades are recorded
-- This ensures the volume metric stays in sync with trades

-- Add volume update to record_trade_atomic function (after step 8, before return)
CREATE OR REPLACE FUNCTION public.record_trade_atomic(
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
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

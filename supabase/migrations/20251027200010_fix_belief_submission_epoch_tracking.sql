-- Fix belief submission epoch tracking
-- Problem: Trades create belief_submissions with epoch=0 (default), so they don't count
-- as "new" submissions when checking for rebase eligibility.
-- Solution: Set epoch to pool's current_epoch when recording trades.

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
  p_meta_prediction numeric,
  p_s_long_after numeric DEFAULT NULL,
  p_s_short_after numeric DEFAULT NULL,
  p_skim_amount numeric DEFAULT 0
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

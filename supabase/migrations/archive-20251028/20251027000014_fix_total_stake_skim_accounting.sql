-- Fix total_stake to use skim-based accounting (custodian deposits)
-- BUY trades: only the skim amount goes to custodian → increase total_stake by skim
-- SELL trades: no custodian interaction → no change to total_stake
-- Settlements: rewards/penalties → update total_stake (to be implemented)
-- Withdrawals: already handled by withdraw/record route

CREATE OR REPLACE FUNCTION record_trade_atomic(
  p_pool_address text,
  p_post_id uuid,
  p_user_id uuid,
  p_wallet_address text,
  p_trade_type text,
  p_token_amount numeric,
  p_usdc_amount numeric,  -- IN DISPLAY UNITS (USDC)
  p_tx_signature text,
  p_token_type text,
  p_sqrt_price_long_x96 text,
  p_sqrt_price_short_x96 text,
  p_belief_id uuid,
  p_agent_id uuid,
  p_belief numeric,
  p_meta_prediction numeric,
  -- Accept supplies from on-chain state after trade
  p_s_long_after numeric DEFAULT NULL,
  p_s_short_after numeric DEFAULT NULL,
  -- Skim amount (display USDC) - only non-zero for buys
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
  v_belief_lock numeric;
  v_price_long numeric;
  v_price_short numeric;
  v_usdc_micro bigint;  -- Store in micro-USDC for database
  v_skim_micro bigint;  -- Skim in micro-USDC
  v_current_vault bigint;
BEGIN
  -- Convert display USDC to micro-USDC (multiply by 1,000,000)
  v_usdc_micro := (p_usdc_amount * 1000000)::bigint;
  v_skim_micro := (p_skim_amount * 1000000)::bigint;

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

  -- 10. ✅ CORRECT: Update agents.total_stake with SKIM amount (custodian accounting)
  -- Only BUY trades deposit to custodian (via skim)
  -- SELL trades go directly to wallet (no custodian interaction)
  IF p_trade_type = 'buy' AND v_skim_micro > 0 THEN
    UPDATE agents
    SET
      total_stake = total_stake + v_skim_micro,
      updated_at = NOW()
    WHERE id = p_agent_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'token_balance', v_token_balance,
    'belief_lock', v_belief_lock
  );
END;
$$;

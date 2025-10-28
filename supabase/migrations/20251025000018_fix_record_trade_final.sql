-- Fix record_trade_atomic function
-- Issues:
-- 1. Missing post_id in user_pool_balances INSERT
-- 2. Missing unique constraint on trades.tx_signature for ON CONFLICT

-- Add unique constraint on tx_signature if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trades_tx_signature_key'
  ) THEN
    ALTER TABLE trades ADD CONSTRAINT trades_tx_signature_key UNIQUE (tx_signature);
  END IF;
END $$;

-- Recreate record_trade_atomic with post_id in user_pool_balances
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
  v_belief_lock numeric;
  v_price_long numeric;
  v_price_short numeric;
  v_usdc_micro bigint;  -- Store in micro-USDC for database
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
    v_usdc_micro,  -- ✅ Store in micro-USDC (atomic units)
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

  -- 7. Upsert user_pool_balances with cumulative tracking (use micro-USDC)
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,  -- ✅ FIXED: Added post_id
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
    p_post_id,  -- ✅ FIXED: Added post_id value
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
        WHEN p_trade_type = 'sell' AND user_pool_balances.entry_price IS NOT NULL
        THEN (p_usdc_amount / p_token_amount - user_pool_balances.entry_price) * p_token_amount
        ELSE 0
      END,
    last_trade_at = NOW(),
    entry_price = CASE
      -- Update entry price on buy if balance was 0 or it's the first buy
      WHEN p_trade_type = 'buy' AND
           (user_pool_balances.token_balance = 0 OR user_pool_balances.entry_price IS NULL)
      THEN p_usdc_amount / p_token_amount  -- New entry price (display USDC per token)
      -- Keep existing entry price for sells or when adding to position
      ELSE user_pool_balances.entry_price
    END;

  -- 8. Record implied relevance in history table
  BEGIN
    -- Calculate implied relevance from sqrt prices
    DECLARE
      v_price_ratio numeric;
      v_implied_relevance numeric;
    BEGIN
      -- Calculate price ratio for implied relevance
      IF v_price_long IS NOT NULL AND v_price_short IS NOT NULL AND (v_price_long + v_price_short) > 0 THEN
        v_price_ratio := v_price_long / (v_price_long + v_price_short);
        v_implied_relevance := v_price_ratio;

        -- Insert into history table
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
      -- Silently ignore errors in implied relevance calculation
      NULL;
    END;
  END;

  -- 9. Return success with trade details
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'token_balance', v_token_balance,
    'belief_lock', v_belief_lock,
    'price_long', v_price_long,
    'price_short', v_price_short
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error and return failure
  RAISE WARNING 'record_trade_atomic error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

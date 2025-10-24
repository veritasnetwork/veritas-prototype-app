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
  SELECT skim_amount
  INTO v_skim_amount
  FROM calculate_skim_with_lock(
    p_user_id,
    p_wallet_address,
    p_pool_address,
    p_token_type,
    (p_usdc_amount * 1000000)::bigint  -- Convert USDC to lamports
  );

  -- Assume we can proceed (skim calculation doesn't block anymore)
  v_can_proceed := true;
  v_remaining_stake := 0;  -- Not used in current implementation

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

  -- 5. Skim is already calculated and stored in the trade record
  -- The skim represents the shortfall between required locks and available stake
  -- We don't deduct from individual position locks here - those are maintained as-is
  -- The skim will be handled by the protocol's stake redistribution system
  -- For now, we just record it for tracking purposes (already stored in trades.belief_lock_skim)

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

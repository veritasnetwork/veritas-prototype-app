CREATE OR REPLACE FUNCTION calculate_skim_with_lock(
  p_user_id UUID,
  p_wallet_address TEXT,
  p_pool_address TEXT,
  p_side TEXT,
  p_trade_amount_micro BIGINT
)
RETURNS TABLE(skim_amount BIGINT) AS $$
DECLARE
  v_current_stake BIGINT;
  v_total_locks BIGINT;
  v_old_lock_this_side BIGINT;
  v_new_lock BIGINT;
  v_required_locks BIGINT;
BEGIN
  -- Get current stake
  SELECT COALESCE(total_stake, 0) INTO v_current_stake
  FROM agents WHERE solana_address = p_wallet_address FOR UPDATE;

  -- Get sum of all belief locks for open positions
  SELECT COALESCE(SUM(belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances
  WHERE user_id = p_user_id AND token_balance > 0;

  -- Get current lock for this specific pool/side (to be replaced)
  SELECT belief_lock INTO v_old_lock_this_side
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_side;

  -- If no row found, v_old_lock_this_side will be NULL, so set to 0
  v_old_lock_this_side := COALESCE(v_old_lock_this_side, 0);

  -- Calculate new lock for this trade (2% of trade amount = divide by 50)
  v_new_lock := (p_trade_amount_micro / 50)::BIGINT;

  -- Calculate required locks after this trade
  -- (all existing locks - old lock for this side + new lock for this side)
  v_required_locks := v_total_locks - v_old_lock_this_side + v_new_lock;

  -- Return skim = max(0, required - current)
  RETURN QUERY SELECT GREATEST(0::BIGINT, v_required_locks - v_current_stake);
END;
$$ LANGUAGE plpgsql;

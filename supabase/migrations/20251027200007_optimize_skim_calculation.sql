-- Optimize calculate_skim_with_lock to avoid FOR UPDATE lock during reads
-- The lock is only needed during actual trades, not during preparation

-- Create optimized read-only version for trade preparation
CREATE OR REPLACE FUNCTION "public"."calculate_skim_with_lock_readonly"(
  "p_user_id" "uuid",
  "p_wallet_address" "text",
  "p_pool_address" "text",
  "p_side" "text",
  "p_trade_amount_micro" bigint
) RETURNS TABLE("skim_amount" bigint)
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_current_stake BIGINT;
  v_total_locks BIGINT;
  v_old_lock_this_side BIGINT;
  v_new_lock BIGINT;
  v_required_locks BIGINT;
BEGIN
  -- Get current stake (NO LOCK - this is just for estimation)
  SELECT COALESCE(total_stake, 0) INTO v_current_stake
  FROM agents WHERE solana_address = p_wallet_address;

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
$$;

ALTER FUNCTION "public"."calculate_skim_with_lock_readonly"(
  "p_user_id" "uuid",
  "p_wallet_address" "text",
  "p_pool_address" "text",
  "p_side" "text",
  "p_trade_amount_micro" bigint
) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."calculate_skim_with_lock_readonly" IS
'Optimized read-only version of calculate_skim_with_lock for trade preparation. Does not acquire FOR UPDATE lock, allowing parallel reads. Use this during /api/trades/prepare. The original calculate_skim_with_lock (with FOR UPDATE) should only be used during actual trade execution in record_trade_atomic.';

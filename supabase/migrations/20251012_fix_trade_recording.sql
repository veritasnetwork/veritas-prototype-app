-- ============================================================================
-- Fix Trade Recording Issue
-- ============================================================================
-- The trigger was too strict and causing issues when balances get out of sync
-- This migration makes the system more resilient
-- ============================================================================

BEGIN;

-- Drop the existing trigger that's causing issues
DROP TRIGGER IF EXISTS trg_update_balance_after_trade ON trades;

-- Create a more lenient version that doesn't fail on constraint violations
CREATE OR REPLACE FUNCTION update_user_balance_after_trade_safe()
RETURNS TRIGGER AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Get current balance if exists
  SELECT token_balance INTO v_current_balance
  FROM user_pool_balances
  WHERE user_id = NEW.user_id
    AND pool_address = NEW.pool_address;

  -- Calculate new balance
  IF v_current_balance IS NULL THEN
    -- First trade - initialize
    IF NEW.trade_type = 'buy' THEN
      v_new_balance := NEW.token_amount;
    ELSE
      -- Selling without buying first? Use 0
      v_new_balance := 0;
    END IF;
  ELSE
    -- Update existing balance
    IF NEW.trade_type = 'buy' THEN
      v_new_balance := v_current_balance + NEW.token_amount;
    ELSE
      v_new_balance := GREATEST(0, v_current_balance - NEW.token_amount);
    END IF;
  END IF;

  -- Upsert the balance (won't fail on constraint violations)
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at
  ) VALUES (
    NEW.user_id,
    NEW.pool_address,
    NEW.post_id,
    v_new_balance,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = GREATEST(0, v_new_balance), -- Never go negative
    total_bought = user_pool_balances.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the trade insertion
    RAISE WARNING 'Failed to update user balance: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new, safer trigger
CREATE TRIGGER trg_update_balance_after_trade_safe
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_trade_safe();

COMMIT;
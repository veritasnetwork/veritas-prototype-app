-- Add 'liquidity_provision' to trade_type enum
-- Liquidity provision creates two position records (Long + Short) without expressing a belief

-- Drop the old constraint
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_trade_type_check;

-- Add new constraint with 'liquidity_provision' included
ALTER TABLE trades ADD CONSTRAINT trades_trade_type_check
  CHECK (trade_type IN ('buy', 'sell', 'liquidity_provision'));

-- Add 'side' column if it doesn't exist (for distinguishing Long vs Short in liquidity provisions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'side'
  ) THEN
    ALTER TABLE trades ADD COLUMN side TEXT CHECK (side IN ('LONG', 'SHORT'));
  END IF;
END $$;

-- Update trigger to handle liquidity_provision type
-- Liquidity provisions should NOT update positions_summary since they're hedged (both Long + Short)
CREATE OR REPLACE FUNCTION update_positions_on_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip position updates for liquidity provisions
  -- (they're neutral positions and shouldn't affect summary)
  IF NEW.trade_type = 'liquidity_provision' THEN
    RETURN NEW;
  END IF;

  -- For regular trades (buy/sell), update positions as before
  INSERT INTO positions_summary (
    post_id,
    user_id,
    wallet_address,
    net_position,
    total_bought,
    total_sold,
    total_invested,
    total_withdrawn
  ) VALUES (
    NEW.post_id,
    NEW.user_id,
    NEW.wallet_address,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NOW(),
    NOW()
  ) ON CONFLICT (post_id, user_id)
  DO UPDATE SET
    net_position = positions_summary.net_position +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_bought = positions_summary.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = positions_summary.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_invested = positions_summary.total_invested +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_withdrawn = positions_summary.total_withdrawn +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the liquidity_provision type
COMMENT ON COLUMN trades.trade_type IS
  'Type of trade: buy (directional long), sell (directional short), or liquidity_provision (bilateral non-predictive liquidity)';

COMMENT ON COLUMN trades.side IS
  'Token side for the trade: LONG or SHORT. Required for liquidity_provision to distinguish which token was minted.';

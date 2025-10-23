-- ============================================================================
-- Trading & History Tables V2
-- ============================================================================
-- Elite data engineering pattern: fact table + time-series + materialized aggregate
-- Tracks trades (source of truth), belief history, and aggregated user balances
-- Pool prices derived via VIEW (not stored separately)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Belief Relevance History (snapshot after every epoch)
-- ============================================================================
CREATE TABLE belief_relevance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  aggregate NUMERIC NOT NULL CHECK (aggregate >= 0 AND aggregate <= 1),
  delta_relevance NUMERIC NOT NULL CHECK (delta_relevance >= -1 AND delta_relevance <= 1),
  certainty NUMERIC NOT NULL CHECK (certainty >= 0 AND certainty <= 1),
  disagreement_entropy NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(belief_id, epoch)
);

CREATE INDEX idx_belief_history_belief_epoch ON belief_relevance_history(belief_id, epoch DESC);
CREATE INDEX idx_belief_history_post_epoch ON belief_relevance_history(post_id, epoch DESC);
CREATE INDEX idx_belief_history_epoch_time ON belief_relevance_history(epoch, recorded_at);

COMMENT ON TABLE belief_relevance_history IS 'Historical belief metrics per epoch for delta relevance charts';
COMMENT ON COLUMN belief_relevance_history.delta_relevance IS 'Change in relevance from previous epoch (-1 to 1)';

-- ============================================================================
-- Trades - Immutable Fact Table (Source of Truth)
-- ============================================================================
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Trade details
  wallet_address TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  token_amount NUMERIC NOT NULL CHECK (token_amount > 0),
  usdc_amount NUMERIC NOT NULL CHECK (usdc_amount > 0),

  -- Pool state AFTER trade (for price calculation)
  token_supply_after NUMERIC NOT NULL CHECK (token_supply_after >= 0),
  reserve_after NUMERIC NOT NULL CHECK (reserve_after >= 0),
  k_quadratic NUMERIC NOT NULL, -- Denormalized for price calc

  -- Blockchain proof
  tx_signature TEXT NOT NULL UNIQUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for access patterns
CREATE INDEX idx_trades_user_time ON trades(user_id, recorded_at DESC);
CREATE INDEX idx_trades_pool_time ON trades(pool_address, recorded_at DESC);
CREATE INDEX idx_trades_post_time ON trades(post_id, recorded_at DESC);
CREATE INDEX idx_trades_time ON trades(recorded_at DESC);
CREATE INDEX idx_trades_tx ON trades(tx_signature);

COMMENT ON TABLE trades IS 'Immutable fact table - source of truth for all trades';
COMMENT ON COLUMN trades.usdc_amount IS 'USDC amount in micro-USDC (6 decimals)';
COMMENT ON COLUMN trades.token_supply_after IS 'Pool token supply AFTER this trade';
COMMENT ON COLUMN trades.reserve_after IS 'Pool USDC reserve AFTER this trade';
COMMENT ON COLUMN trades.k_quadratic IS 'Denormalized k_quadratic for price calculation';

-- ============================================================================
-- User Pool Balances - Aggregated Current State
-- ============================================================================
CREATE TABLE user_pool_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Current holdings
  token_balance NUMERIC NOT NULL DEFAULT 0 CHECK (token_balance >= 0),

  -- Lifetime cumulative stats
  total_bought NUMERIC NOT NULL DEFAULT 0,
  total_sold NUMERIC NOT NULL DEFAULT 0,
  total_usdc_spent NUMERIC NOT NULL DEFAULT 0,
  total_usdc_received NUMERIC NOT NULL DEFAULT 0,

  -- Timestamps
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, pool_address)
);

-- Indexes for fast lookups
CREATE INDEX idx_balances_user ON user_pool_balances(user_id);
CREATE INDEX idx_balances_pool_balance ON user_pool_balances(pool_address, token_balance DESC);
CREATE INDEX idx_balances_user_pool ON user_pool_balances(user_id, pool_address);

COMMENT ON TABLE user_pool_balances IS 'ONE row per user-pool pair - current state (NOT history)';
COMMENT ON COLUMN user_pool_balances.token_balance IS 'Current token balance (total_bought - total_sold)';
COMMENT ON COLUMN user_pool_balances.total_usdc_spent IS 'Lifetime USDC spent on buys';
COMMENT ON COLUMN user_pool_balances.total_usdc_received IS 'Lifetime USDC received from sells';

-- ============================================================================
-- Pool Price Snapshots - Derived VIEW (Not a Table!)
-- ============================================================================
CREATE VIEW pool_price_snapshots AS
SELECT
  pool_address,
  post_id,
  -- Calculate price from bonding curve: P = R / (k * S²)
  reserve_after / NULLIF(k_quadratic * POWER(token_supply_after, 2), 0) as price,
  token_supply_after as token_supply,
  reserve_after as reserve,
  recorded_at,
  trade_type as triggered_by,
  tx_signature
FROM trades
ORDER BY pool_address, recorded_at;

COMMENT ON VIEW pool_price_snapshots IS 'Derived view - calculates prices from trades (source of truth)';

-- ============================================================================
-- Trigger Function: Update Balance After Trade
-- ============================================================================
CREATE OR REPLACE FUNCTION update_user_balance_after_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert user balance
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
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = user_pool_balances.token_balance +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
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
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_balance_after_trade IS 'Auto-updates user_pool_balances when trade is inserted';

-- ============================================================================
-- Trigger: Auto-Update Balance After Trade
-- ============================================================================
CREATE TRIGGER trg_update_balance_after_trade
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_trade();

COMMIT;

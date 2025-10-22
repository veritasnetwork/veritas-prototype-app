ALTER TABLE user_pool_balances
ADD COLUMN token_type TEXT NOT NULL DEFAULT 'LONG'
  CHECK (token_type IN ('LONG', 'SHORT'));

ALTER TABLE user_pool_balances
DROP CONSTRAINT IF EXISTS user_pool_balances_user_id_pool_address_key;

ALTER TABLE user_pool_balances
ADD CONSTRAINT user_pool_balances_user_pool_side_key
  UNIQUE (user_id, pool_address, token_type);

DROP INDEX IF EXISTS idx_user_pool_balances_user_open;
CREATE INDEX idx_user_pool_balances_user_open
  ON user_pool_balances(user_id, pool_address, token_type)
  WHERE token_balance > 0;

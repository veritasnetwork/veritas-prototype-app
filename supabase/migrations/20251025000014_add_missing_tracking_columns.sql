-- Add missing tracking columns to user_pool_balances table
-- These columns are referenced by the record_trade_atomic function but were never added

ALTER TABLE user_pool_balances
ADD COLUMN IF NOT EXISTS net_bought numeric DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS realized_pnl numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_price numeric;
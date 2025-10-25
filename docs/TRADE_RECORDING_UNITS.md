# Trade Recording Unit Conversions

This document clarifies the unit conversions used throughout the trade recording system to prevent confusion.

## Unit Definitions

### USDC Units
- **Display Units**: Human-readable format (e.g., `10.5 USDC`)
- **Micro-USDC (Lamports)**: On-chain format with 6 decimals (e.g., `10,500,000 micro-USDC`)
- **Conversion**: `1 USDC = 1,000,000 micro-USDC`

### Token Units
- **Display Units**: Human-readable format (e.g., `100 LONG tokens`)
- **Atomic Units**: On-chain format with 6 decimals (e.g., `100,000,000 atomic units`)
- **Conversion**: `1 token = 1,000,000 atomic units`

## Data Flow & Unit Conversions

### Client → API
```typescript
// Client sends in display units
{
  usdc_amount: "10.5",      // Display units (USDC)
  token_amount: "100",      // Display units (tokens)
}
```

### API → Database Function
```typescript
// API passes display units to record_trade_atomic
{
  p_usdc_amount: 10.5,      // Display units (USDC)
  p_token_amount: 100,      // Display units (tokens)
}
```

### Inside record_trade_atomic
```sql
-- Convert display units to micro-USDC for skim calculation
SELECT skim_amount
FROM calculate_skim_with_lock(
  p_user_id,
  p_wallet_address,
  p_pool_address,
  p_token_type,
  (p_usdc_amount * 1000000)::bigint  -- ← Conversion: USDC → micro-USDC
);

-- Belief lock calculation (2% of trade value)
v_new_lock := FLOOR(p_usdc_amount * 0.02);  -- In display units (USDC)
```

### Inside calculate_skim_with_lock
```sql
-- Input: p_trade_amount_micro (in micro-USDC)
-- Calculate 2% lock
v_new_lock := (p_trade_amount_micro / 50)::BIGINT;  -- 2% = divide by 50
-- Output: skim in micro-USDC
```

## Storage Formats

### Database Tables

#### `trades` table
```sql
usdc_amount numeric       -- Display units (USDC)
token_amount numeric      -- Display units (tokens)
belief_lock_skim numeric  -- Display units (USDC)
```

#### `user_pool_balances` table
```sql
token_balance numeric     -- Display units (tokens)
belief_lock numeric       -- Display units (USDC)
```

#### `agents` table
```sql
total_stake bigint        -- Micro-USDC (lamports)
```

## Common Conversion Functions

### JavaScript/TypeScript
```typescript
// Display → Micro
const microUsdc = displayUsdc * 1_000_000;
const atomicTokens = displayTokens * 1_000_000;

// Micro → Display
const displayUsdc = microUsdc / 1_000_000;
const displayTokens = atomicTokens / 1_000_000;
```

### SQL/PostgreSQL
```sql
-- Display → Micro
(display_amount * 1000000)::BIGINT

-- Micro → Display
(micro_amount / 1000000.0)::NUMERIC
```

## Key Invariants

1. **API Input/Output**: Always use display units for client communication
2. **Database Storage**:
   - Trade amounts: Display units
   - Belief locks: Display units
   - Agent stake: Micro-USDC
3. **Skim Calculation**: Internal function works with micro-USDC
4. **On-Chain**: Everything is in atomic/lamport units

## Examples

### Example 1: Buy Trade
```typescript
// Client sends
usdc_amount: "10.5"  // Display units

// API receives
usdcAmount: 10.5  // Parsed as number

// DB function converts for skim calc
(10.5 * 1000000) = 10,500,000 micro-USDC

// Skim calculation
10,500,000 / 50 = 210,000 micro-USDC = 0.21 USDC (2%)

// Belief lock stored
FLOOR(10.5 * 0.02) = 0.21 USDC (display units)
```

### Example 2: Sell Trade with Lock Reduction
```typescript
// User has:
token_balance: 1000 LONG
belief_lock: 2.0 USDC

// User sells 500 LONG
token_amount: 500

// New balance
1000 - 500 = 500 LONG

// Proportional lock reduction
proportion_remaining = 500 / 1000 = 0.5
new_lock = FLOOR(2.0 * 0.5) = 1.0 USDC
```

## Debugging Tips

If you see unexpected values:

1. **Check unit type**: Is this display units or micro-units?
2. **Verify conversions**: Look for `* 1000000` or `/ 1000000`
3. **Check storage**: Which table? What's the column type?
4. **Trace data flow**: Client → API → DB function → Storage

## Migration Notes

After applying the bug fixes (migration `20251024000002`):
- All balance calculations happen inside `record_trade_atomic`
- Units remain consistent throughout the system
- No breaking changes to client API

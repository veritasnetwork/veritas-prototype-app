# Swap Component Specification

## Overview
A unified token trading interface that handles both buying (USDC → TOKEN) and selling (TOKEN → USDC) through a single swap paradigm, similar to DEX interfaces like Uniswap.

## Visual Layout

```
┌──────────────────────────────────────────────┐
│ 🔄 Swap Tokens                               │
├──────────────────────────────────────────────┤
│                                              │
│ You Pay:                                     │
│ ┌────────────────────────────────────────┐   │
│ │ 1.0                  [USDC ▼]         │   │
│ │                                        │   │
│ │ Balance: 100.00 USDC                  │   │
│ └────────────────────────────────────────┘   │
│                                              │
│              [⇅ Swap Direction]             │
│                                              │
│ You Receive (estimated):                     │
│ ┌────────────────────────────────────────┐   │
│ │ ~123.45                [TOKEN ▼]      │   │
│ │                                        │   │
│ │ Balance: 0 tokens                     │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ ─────────────────────────────────────────   │
│                                              │
│ Rate: 1 USDC = 123.45 tokens               │
│ Price impact: 0.3%                          │
│ Minimum received: 122.34 tokens            │
│                                              │
│ [Swap →]                                     │
│                                              │
└──────────────────────────────────────────────┘
```

## Component Structure

### 1. Header
- **Title**: "Swap Tokens" with 🔄 icon
- **Style**: 18px medium, gray-200
- **Optional**: Info icon (?) with tooltip explaining how swaps work

### 2. Input Section - "You Pay"

**Token Input Field**:
- **Input**: Number input, large text (24px)
- **Placeholder**: "0.0"
- **Validation**: Must be > 0, max = user's balance
- **Token selector**: Dropdown showing USDC or TOKEN
  - Icon + symbol + name
  - Example: [💵 USDC] or [🎫 TOKEN]

**Balance Display**:
- **Text**: "Balance: 100.00 USDC" (14px, gray-400)
- **Action**: Clickable "Max" button to fill with full balance
- **Position**: Bottom-right of input field

### 3. Swap Direction Button
- **Icon**: ⇅ (vertical arrows)
- **Position**: Center between two inputs
- **Action**: Swaps "Pay" and "Receive" tokens
- **Effect**: Flips token selection and recalculates amounts
- **Style**:
  - Circular button, 48px diameter
  - Dark background with border
  - Hover: Rotate 180° animation
  - Active: Bounce animation

### 4. Output Section - "You Receive"

**Token Output Field**:
- **Display**: Read-only calculated amount
- **Prefix**: "~" (indicates estimate)
- **Style**: Same as input (24px)
- **Token selector**: Dropdown showing TOKEN or USDC
- **Calculation**: Real-time based on bonding curve

**Balance Display**:
- **Text**: "Balance: 0 tokens" (14px, gray-400)
- **Updates**: After successful swap

### 5. Transaction Details
**Shown between output and swap button**

**Rate** (always visible):
- Format: "1 USDC = 123.45 tokens"
- Or: "1 token = 0.0081 USDC"
- Updates in real-time as input changes
- Color: Gray-300

**Price Impact** (warning if >5%):
- Format: "Price impact: 0.3%"
- Colors:
  - <5%: Gray (normal)
  - 5-10%: Yellow (caution)
  - >10%: Red (warning)
- Icon: ⚠️ if >5%
- Tooltip: "Your trade will move the price by this amount"

**Minimum Received** (for slippage):
- Format: "Minimum received: 122.34 tokens"
- Calculated with 0.5% slippage tolerance
- Only show when inputting (not when output is primary)
- Color: Gray-400

### 6. Swap Button

**States**:

**Default**:
- Text: "Swap →"
- Style: Primary button (blue-500)
- Enabled: When valid amount entered

**No Wallet**:
- Text: "Connect Wallet"
- Action: Trigger wallet connection modal

**Insufficient Balance**:
- Text: "Insufficient USDC Balance" or "Insufficient TOKEN Balance"
- Style: Disabled (gray-600)
- Cursor: not-allowed

**Invalid Amount**:
- Text: "Enter amount"
- Style: Disabled

**Loading** (during transaction):
- Text: "Swapping..." with spinner
- Style: Disabled
- Progress: Show transaction status

**Success** (brief, 2s):
- Text: "Swap Complete ✓"
- Style: Success green
- Then reset to default

## Token Selection Dropdown

### Options
- **USDC**:
  - Icon: 💵 or USDC logo
  - Name: "USD Coin"
  - Symbol: "USDC"
  - Balance: From wallet

- **TOKEN**:
  - Icon: 🎫 or post thumbnail
  - Name: Post title (truncated to 20 chars)
  - Symbol: "TOKEN"
  - Balance: From pool holdings

### Behavior
- Click to open dropdown
- Select to change token
- Auto-recalculates amounts
- Can't select same token for both sides

## Calculations

### Buy (USDC → TOKEN)
```typescript
// Input: USDC amount
// Output: Tokens received

// Using bonding curve: reserve = k * supply^3 / 3
// Solve for new supply after adding USDC

const currentSupply = poolData.token_supply;
const currentReserve = poolData.reserve;
const k = poolData.k_quadratic;

const newReserve = currentReserve + usdcAmount;
const newSupply = Math.cbrt((3 * newReserve) / k);
const tokensReceived = newSupply - currentSupply;

// Apply slippage (0.5%)
const minimumReceived = tokensReceived * 0.995;
```

### Sell (TOKEN → USDC)
```typescript
// Input: Token amount
// Output: USDC received

const newSupply = currentSupply - tokenAmount;
const newReserve = (k * Math.pow(newSupply, 3)) / 3;
const usdcReceived = currentReserve - newReserve;

// Apply slippage
const minimumReceived = usdcReceived * 0.995;
```

### Price Impact
```typescript
const oldPrice = currentReserve / (k * Math.pow(currentSupply, 2));
const newPrice = newReserve / (k * Math.pow(newSupply, 2));
const priceImpact = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
```

## Transaction Flow

### 1. User Input
- User types USDC amount (e.g., "1.0")
- Component calculates tokens received
- Shows rate, price impact, minimum received

### 2. User Clicks "Swap"
- Validate: Wallet connected, sufficient balance, valid amount
- Show confirmation modal (optional):
  ```
  Confirm Swap

  You pay: 1.0 USDC
  You receive: ~123.45 tokens (minimum 122.34)
  Price impact: 0.3%

  [Cancel] [Confirm Swap]
  ```

### 3. Execute Transaction
- Build Solana transaction (buy or sell instruction)
- Sign with Privy wallet
- Send to network
- Show loading state: "Swapping..."
- Monitor transaction status

### 4. Success
- Show success message: "✅ Swapped 1.0 USDC for 123.45 tokens"
- Update balances
- Sync pool data
- Reset form
- Optional: Show transaction link (Solscan)

### 5. Error
- Show error message: "❌ Swap failed: [reason]"
- Keep form state for retry
- Suggest solutions:
  - "Insufficient USDC" → Add funds
  - "Transaction rejected" → Try again
  - "Slippage too high" → Increase tolerance

## Advanced Features (Future)

### Slippage Settings
- Default: 0.5%
- Options: 0.1%, 0.5%, 1.0%, Custom
- Gear icon (⚙️) to open settings modal

### Transaction Deadline
- Default: 20 minutes
- Prevents transaction from executing if delayed too long

### Multi-hop Routing (Future)
- If adding more tokens, route through multiple pools
- Example: TOKEN A → USDC → TOKEN B

## States & Edge Cases

### No Wallet Connected
- Disable inputs
- Show "Connect Wallet" button
- Message: "Connect wallet to start swapping"

### Zero Balance
- Input disabled if balance = 0
- Message: "You don't have any [TOKEN] to swap"
- Suggestion: "Buy tokens first" (if selling)

### Amount Exceeds Balance
- Button disabled
- Red border on input
- Error: "Amount exceeds balance"

### Pool Has Low Liquidity
- Warning: "⚠️ Low liquidity - high price impact expected"
- Show price impact clearly
- Require manual confirmation

### Transaction Pending
- Disable all inputs
- Show spinner + status
- Allow cancel (if supported)

### Pool Doesn't Exist
- Disable swap interface
- Message: "Pool not yet deployed for this post"

## Responsive Behavior

### Desktop
- Two-column layout for details (rate | price impact)
- Larger input text (24px)

### Mobile
- Single-column details
- Slightly smaller text (20px)
- Swap button full-width

## Component Props

```typescript
interface SwapComponentProps {
  poolData: {
    pool_address: string;
    token_supply: number;
    reserve: number; // in micro-USDC
    k_quadratic: number;
  };
  postId: string;
  postTitle: string; // for TOKEN name
  onSwapComplete?: () => void; // callback after successful swap
}
```

## Hooks

```typescript
// Main swap logic
const {
  payAmount,
  receiveAmount,
  payToken,
  receiveToken,
  rate,
  priceImpact,
  minimumReceived,
  isValid,
  swap,
  isSwapping,
  error,
  setPayAmount,
  setPayToken,
  swapDirection,
} = useSwap(poolData, postId);

// Token balances
const { usdcBalance, tokenBalance } = useTokenBalances(
  poolData.pool_address
);
```

## Styling

### Colors
- Input background: White or gray-50
- Input border: gray-300, focus: blue-500
- Button primary: blue-500
- Warning: yellow-500
- Error: red-500

### Spacing
- Outer padding: 24px
- Gap between inputs: 16px
- Internal padding: 16px

### Typography
- Input text: 24px bold
- Labels: 14px medium
- Details: 14px regular
- Button: 16px medium

---

**Status**: ✅ Spec Complete
**Created**: January 2025
**Priority**: HIGH
**Dependencies**: useBuyTokens, useSellTokens hooks
**Related**: PostDetailPanel.md

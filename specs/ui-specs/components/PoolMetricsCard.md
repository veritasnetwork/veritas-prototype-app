# PoolMetricsCard Component Specification

## Overview
Displays key metrics for an ICBS two-sided prediction market pool. The card shows metrics for either the LONG side (bullish) or SHORT side (bearish) based on which side the user has selected in the swap interface.

**Location:** `src/components/post/PostDetailPanel/PoolMetricsCard.tsx`

## Visual Design

```
Desktop:
┌────────────────────────────────────────────────────────────────────┐
│ LONG │ Price: $1.02 (+2.3%) │ Mkt Cap: $1.23k │ Supply: 1.2k │... │
└────────────────────────────────────────────────────────────────────┘

Mobile:
┌─────────────────────────────────┐
│ LONG  Price: $1.02 (+2.3%)     │
├─────────────────────────────────┤
│ Mkt Cap: $1.23k  Supply: 1.2k  │
│ Reserve: $1.08k  24h Vol: $523 │
└─────────────────────────────────┘
```

## Props Interface

```typescript
interface PoolMetricsCardProps {
  // Selected side (synchronized with swap component)
  side: 'LONG' | 'SHORT';

  // LONG side metrics
  priceLong: number;
  marketCapLong: number;
  supplyLong: number;
  reserveLong: number;
  priceChangeLong24h?: number;
  volumeLong?: number;

  // SHORT side metrics
  priceShort: number;
  marketCapShort: number;
  supplyShort: number;
  reserveShort: number;
  priceChangeShort24h?: number;
  volumeShort?: number;
}
```

## Behavior

### Side Selection
- **Controlled Component**: Receives `side` prop from parent (`PostDetailContent`)
- **Synchronized**: When user switches LONG/SHORT in swap, metrics instantly update
- **No direct interaction**: User doesn't click the card; it reflects swap selection

### Displayed Metrics

Based on `side` prop, displays:

**LONG Side (Green):**
- Price: LONG token price with 24h% change
- Mkt Cap: `supplyLong * priceLong`
- Supply: LONG token circulating supply
- Reserve: USDC reserve backing LONG side
- 24h Vol: USDC volume traded on LONG side

**SHORT Side (Red):**
- Price: SHORT token price with 24h% change
- Mkt Cap: `supplyShort * priceShort`
- Supply: SHORT token circulating supply
- Reserve: USDC reserve backing SHORT side
- 24h Vol: USDC volume traded on SHORT side

### Visual Indicators

**Side Badge:**
- LONG: Green text (`text-emerald-400`)
- SHORT: Red text (`text-red-400`)
- Position: Left side of metrics row

**Price Change Badge:**
- Positive: Green background (`bg-emerald-500/20`)
- Negative: Red background (`bg-red-500/20`)
- Format: `+2.3%` or `-1.5%`

## Layout

### Desktop (≥768px)
- **Horizontal scroll**: All metrics in one row
- **Order**: Side Badge | Price (+Change) | Market Cap | Supply | Reserve | Volume
- **Dividers**: Vertical lines between major sections
- **Gap**: 24px (1.5rem) between metrics

### Mobile (<768px)
- **Grid**: 2 columns
- **Price**: Full width row (col-span-2)
- **Remaining**: 2x2 grid
- **Order**: Price | Market Cap/Supply | Reserve/Volume

## Number Formatting

Uses `formatCompactNumber()` helper:
- `< 1,000`: Show with 2 decimals (e.g., `123.45`)
- `≥ 1,000`: Show with k suffix (e.g., `1.23k`)
- `≥ 1,000,000`: Show with m suffix (e.g., `1.23m`)

**Examples:**
- `$0.0081` (price)
- `1.23k` (supply)
- `$2.48m` (market cap)

## Implementation Notes

### State Management
- **Stateless Component**: No internal state
- **Controlled by Parent**: `PostDetailContent` manages `selectedSide` state
- **Props Flow**: Parent → PoolMetricsCard (metrics) + UnifiedSwapComponent (side selection)

### Data Sources
- **Pool Data**: From `usePoolData` hook (on-chain via `fetchPoolData`)
- **Trade Stats**: From `useTradeHistory` API (`/api/posts/[id]/trades`)
- **Metrics Calculation**: Done in parent component

### Responsive Design
- **Breakpoint**: 768px (Tailwind's `md:`)
- **Hidden on mobile**: Desktop layout (`hidden md:flex`)
- **Visible on mobile**: Mobile grid (`md:hidden grid`)

## Integration Example

```tsx
// PostDetailContent.tsx
export function PostDetailContent({ postId }: PostDetailContentProps) {
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const { poolData } = usePoolData(postId);
  const { data: tradeHistory } = useTradeHistory(postId);

  return (
    <>
      <PoolMetricsCard
        side={selectedSide}
        priceLong={poolData.priceLong}
        priceShort={poolData.priceShort}
        marketCapLong={poolData.marketCapLong}
        marketCapShort={poolData.marketCapShort}
        supplyLong={poolData.supplyLong}
        supplyShort={poolData.supplyShort}
        reserveLong={poolData.reserveLong}
        reserveShort={poolData.reserveShort}
        priceChangeLong24h={tradeHistory?.stats?.priceChangePercentLong24h}
        priceChangeShort24h={tradeHistory?.stats?.priceChangePercentShort24h}
        volumeLong={tradeHistory?.stats?.volumeLong}
        volumeShort={tradeHistory?.stats?.volumeShort}
      />

      <UnifiedSwapComponent
        selectedSide={selectedSide}
        onSideChange={setSelectedSide}
        {...otherProps}
      />
    </>
  );
}
```

## Design Rationale

### Why Synchronized with Swap?
- **Clarity**: User sees metrics for the token they're about to trade
- **Context**: Avoids confusion about which side's metrics are shown
- **Simplicity**: No need for separate side toggle in metrics card

### Why Not Show Both Sides?
- **Space**: Limited horizontal space, especially on mobile
- **Focus**: User is interested in one side at a time when trading
- **Cleaner**: Reduces visual clutter

### Why Compact Number Format?
- **Readability**: Easier to scan large numbers at a glance
- **Space**: Fits more metrics in limited space
- **Standard**: Common pattern in trading UIs (Uniswap, dYdX, etc.)

## Related Components

- **UnifiedSwapComponent**: Controls which side is selected
- **TradingHistoryChart**: Shows price history for both LONG and SHORT
- **PostDetailContent**: Parent container managing state

## Files

- Implementation: `src/components/post/PostDetailPanel/PoolMetricsCard.tsx`
- Parent: `src/components/post/PostDetailPanel/PostDetailContent.tsx`
- Types: `src/types/post.types.ts` (pool data interface)

---

**Status**: ✅ Implemented
**Created**: October 2025
**Last Updated**: October 2025

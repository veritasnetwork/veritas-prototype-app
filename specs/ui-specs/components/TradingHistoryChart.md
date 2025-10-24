# TradingHistoryChart Component Specification

## Overview
Displays historical price and volume data for ICBS two-sided prediction markets using lightweight-charts library. Shows separate lines for LONG and SHORT token prices, with volume bars colored by trading side.

**Location:** `src/components/charts/TradingHistoryChart.tsx`

## Visual Design

```
┌────────────────────────────────────────────────┐
│                                                │
│  Price (USDC)                                  │
│  1.05 ┤                    ╱─────             │
│       │         ╱─────────╱   LONG (blue)     │
│  1.00 ┼────────╱                              │
│       │                 ╱────╲                │
│  0.95 ┤        ╱───────╱      ╲  SHORT (orange)│
│       │  ╱────╱                ╲──────        │
│       │                                        │
│       ├────────────────────────────────────────│
│  Vol  │ ▂▄▂▃▄▅▃▄▂▃ (blue=LONG, orange=SHORT)  │
│       └────────────────────────────────────────│
│         10:00  11:00  12:00  13:00  14:00     │
└────────────────────────────────────────────────┘
```

## Props Interface

```typescript
interface TradingHistoryChartProps {
  priceLongData: ChartDataPoint[];
  priceShortData: ChartDataPoint[];
  volumeData: VolumeDataPoint[];
  height?: number; // default 400px
}

interface ChartDataPoint {
  time: number; // Unix timestamp
  value: number; // Price or volume value
}

interface VolumeDataPoint {
  time: number;
  value: number;
  color: string; // 'rgba(185, 217, 235, 0.8)' or 'rgba(249, 115, 22, 0.8)'
}
```

## Chart Structure

### Price Series (Top 75%)

**LONG Line:**
- Color: `#B9D9EB` (light blue)
- Line width: 2px
- Title: "LONG"
- Represents: Price to buy 1 LONG token

**SHORT Line:**
- Color: `#f97316` (orange)
- Line width: 2px
- Title: "SHORT"
- Represents: Price to buy 1 SHORT token

**Price Scale:**
- Position: Right side
- Margins: 10% top, 25% bottom (leaves room for volume)
- Auto-scaling: Yes

### Volume Histogram (Bottom 25%)

**Bars:**
- Light blue (`rgba(185, 217, 235, 0.8)`): LONG trading volume
- Orange (`rgba(249, 115, 22, 0.8)`): SHORT trading volume
- Format: Volume (no decimals)

**Volume Scale:**
- Position: Separate scale
- Margins: 85% top, 0% bottom
- Auto-scaling: Yes

### Time Scale (Bottom)

- Format: `HH:mm` (24-hour format)
- Visible: Yes
- Seconds: Hidden
- Auto-fit: Yes (calls `fitContent()` when data loads)

## Behavior

### Data Loading
1. Chart initializes with empty data
2. When `priceLongData.length > 0`, LONG line appears
3. When `priceShortData.length > 0`, SHORT line appears
4. Chart auto-scales to fit all data points

### Crosshair
- **Vertical line**: Dashed, gray (`#6b7280`)
- **Horizontal line**: Dashed, gray (`#6b7280`)
- **Tooltip**: Shows values when hovering
- **Format**: Automatic (price shows 4 decimals, volume shows full number)

### Responsive Behavior
- **Width**: 100% of container
- **Height**: Fixed (default 400px, configurable via prop)
- **Resize**: Chart width updates on window resize
- **No data**: Shows empty chart with axes (no placeholder message)

### Performance
- **Memoized**: Uses `React.memo()` to prevent unnecessary re-renders
- **Effect dependencies**: `[height, priceLongData, priceShortData, volumeData]`
- **Cleanup**: Removes chart instance on unmount

## ICBS Market Interpretation

### Price Lines Meaning

**LONG Price (Blue):**
- Users who believe the content is relevant/valuable
- Higher price = more confidence/demand for LONG
- Increases when LONG tokens are bought

**SHORT Price (Orange):**
- Users who believe the content is irrelevant/not valuable
- Higher price = more confidence/demand for SHORT
- Increases when SHORT tokens are bought

### Volume Bars Meaning

**Blue Bars (LONG Volume):**
- Total USDC volume traded on LONG side
- Includes both buys and sells of LONG tokens
- Shows activity level for bullish traders

**Orange Bars (SHORT Volume):**
- Total USDC volume traded on SHORT side
- Includes both buys and sells of SHORT tokens
- Shows activity level for bearish traders

### Market Dynamics

Both sides can rise simultaneously because:
- ICBS uses independent pricing for each side
- More trading on one side increases its price
- Not zero-sum until epoch settlement
- Pool reserves adjust based on trading activity

## Integration Example

```tsx
// TradingChartCard.tsx
export function TradingChartCard({ postId }: { postId: string }) {
  const { data: tradeHistory } = useTradeHistory(postId, timeRange);

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl p-4">
      {tradeHistory && (
        <TradingHistoryChart
          priceLongData={tradeHistory.priceLongData}
          priceShortData={tradeHistory.priceShortData}
          volumeData={tradeHistory.volumeData}
          height={400}
        />
      )}
    </div>
  );
}
```

## Data Source

### API Endpoint
`GET /api/posts/[id]/trades?range=24H`

### Response Format
```typescript
{
  priceLongData: [
    { time: 1729700000, value: 1.02 },
    { time: 1729700060, value: 1.03 },
    ...
  ],
  priceShortData: [
    { time: 1729700000, value: 0.98 },
    { time: 1729700060, value: 0.99 },
    ...
  ],
  volumeData: [
    { time: 1729700000, value: 10.5, color: 'rgba(185, 217, 235, 0.8)' },
    { time: 1729700060, value: 8.2, color: 'rgba(249, 115, 22, 0.8)' },
    ...
  ],
  stats: { ... }
}
```

### Time Range Options
- `1H`: Last hour
- `24H`: Last 24 hours (default)
- `7D`: Last 7 days
- `ALL`: All time

## Styling

### Colors
- Background: `#0a0a0a` (very dark gray)
- Grid: Hidden
- Text: `#9ca3af` (gray-400)
- LONG: `#B9D9EB` (light blue)
- SHORT: `#f97316` (orange)
- Crosshair: `#6b7280` (gray-500)

### Chart Options
```typescript
{
  layout: {
    background: { type: ColorType.Solid, color: '#0a0a0a' },
    textColor: '#9ca3af',
  },
  grid: {
    vertLines: { visible: false },
    horzLines: { visible: false },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
    borderColor: 'transparent',
  },
  rightPriceScale: {
    borderColor: 'transparent',
  },
  crosshair: {
    vertLine: { width: 1, color: '#6b7280', style: 1 },
    horzLine: { width: 1, color: '#6b7280', style: 1 },
  },
}
```

## Technical Notes

### Library
- **Package**: `lightweight-charts` v4.x
- **License**: Apache 2.0
- **Docs**: https://tradingview.github.io/lightweight-charts/

### Performance Considerations
- Chart re-renders only when props change (memoized)
- Uses refs to maintain chart instance across renders
- Cleanup function removes chart on unmount
- Resize listener removed on cleanup

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Touch-enabled, pinch-to-zoom

## Related Components

- **TradingChartCard**: Wrapper with time range selector
- **API**: `/api/posts/[id]/trades` endpoint
- **Types**: `src/types/api.ts` (TradeHistoryResponse)

## Files

- Implementation: `src/components/charts/TradingHistoryChart.tsx`
- Parent: `src/components/post/PostDetailPanel/TradingChartCard.tsx`
- API: `app/api/posts/[id]/trades/route.ts`
- Types: `src/types/api.ts`

---

**Status**: ✅ Implemented
**Created**: October 2025
**Last Updated**: October 2025 (Updated to two-line LONG/SHORT design)

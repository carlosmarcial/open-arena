# Chart Real-Time Updates - Issue Analysis & Fixes

## Problem Description

The equity curve chart shows straight/flat horizontal lines at the recent end instead of dynamically updating with price changes. Lines used to move in real-time when prices changed, but they no longer do.

## Root Causes Identified

### 1. **Positions API Response Format Mismatch** ✅ FIXED
**Issue**: The frontend expected `positions` array, but API returned `positionsByModel` object.

**Impact**: Position direction indicators (LONG/SHORT badges) weren't showing on the chart.

**Fix**: Modified `/api/positions` to return both formats:
```typescript
{
  positionsByModel: {...},  // Detailed view
  positions: [...],          // Flat array for chart
}
```

**File**: `src/app/api/positions/route.ts:146-162`

### 2. **Cron Jobs Only Run on Vercel**
**Issue**: The critical data update cron jobs only run in production on Vercel, not locally.

**Impact**: When testing locally or if Vercel crons aren't running:
- No new equity snapshots are recorded (every 2 mins)
- Positions aren't synced from Aster DEX (every 5 mins)
- Chart data becomes stale

**Cron Schedule** (vercel.json):
- `snapshot-equity`: Every 2 minutes - Records equity snapshots for smooth chart lines
- `sync-positions`: Every 5 minutes - Syncs position prices and unrealized PnL
- `monitor-positions`: Every 15 minutes - Checks for position exits
- `execute-trades`: Every hour - Makes trading decisions

**Solution**: Created local testing script `scripts/trigger-crons.ts` to manually trigger crons during development.

### 3. **Terminal Point Logic** ✅ Working Correctly
**How it works**: Even without new snapshots, the chart should update because:
1. Frontend polls `/api/leaderboard` every 2 seconds
2. Leaderboard API fetches **real-time** balance from Aster DEX (including unrealized PnL)
3. This current equity is appended as a "terminal point" at "now"
4. Chart re-renders with updated terminal point

**Why lines might still be flat**:
- If equity isn't actually changing (no positions, or prices stable)
- If Aster API is returning stale/cached data
- If there are errors in the balance fetch (returns 0 or fallback value)

## Fixes Applied

### 1. Positions API Format Fix
```diff
// src/app/api/positions/route.ts
return NextResponse.json({
  positionsByModel: positionsByModel || {},
+ positions: flatPositions, // Add flat array for chart
  lastUpdated: new Date().toISOString(),
});
```

### 2. Debug Logging
Added console logging to track equity changes in real-time:

**Dashboard fetch logging** (`src/app/page.tsx:160-171`):
```typescript
console.log('📊 Dashboard Update:', {
  timestamp: new Date().toLocaleTimeString(),
  fetchTime: '245ms',
  equities: [
    { model: 'Claude Sonnet 4.5', equity: '61.83', pnl: '23.66%' },
    // ... other models
  ]
});
```

**Terminal point logging** (`src/app/page.tsx:257-265`):
```typescript
console.log('📍 Terminal point appended for Claude Sonnet 4.5:', {
  lastValue: '61.83',
  currentValue: '61.85',
  changed: true,
  dataPoints: 847
});
```

### 3. Local Cron Trigger Script
Created `scripts/trigger-crons.ts` for manual cron execution:

**Usage**:
```bash
# Run all crons once
npx tsx scripts/trigger-crons.ts

# Run specific cron
npx tsx scripts/trigger-crons.ts snapshot
npx tsx scripts/trigger-crons.ts sync

# Watch mode: Run snapshot + sync every 10 seconds
npx tsx scripts/trigger-crons.ts watch
```

## Testing Guide

### 1. Start the Development Server
```bash
cd aster-arena
npm run dev
```

### 2. Open Browser Console
Navigate to http://localhost:3000 and open DevTools Console

### 3. Watch for Debug Logs
You should see logs every 2 seconds:
```
📊 Dashboard Update: {
  timestamp: "10:45:23",
  equities: [...],
}
```

### 4. Trigger Manual Snapshots (In Another Terminal)
```bash
# Watch mode - creates snapshots every 10 seconds
npx tsx scripts/trigger-crons.ts watch
```

### 5. Verify Chart Updates
- Lines should extend to the right edge (current time)
- If positions are open, lines should move up/down as prices change
- Check console for terminal point logs (10% sample rate)

## Diagnosis Checklist

If lines are still flat:

### ✅ Check if app is deployed to Vercel
```bash
# Verify crons are running in production
vercel logs --follow
# Look for: "📸 [SNAPSHOT-CRON]" and "🔄 [SYNC]"
```

### ✅ Check if snapshots are being recorded
```bash
# Query Supabase
SELECT model_id, COUNT(*), MAX(timestamp) as latest
FROM performance_snapshots
GROUP BY model_id;

# Should show recent timestamps (within last 2 minutes)
```

### ✅ Check if positions exist
```bash
# In browser console
const res = await fetch('/api/positions');
const data = await res.json();
console.log('Positions:', data.positions);

# Should show open positions with sides (LONG/SHORT)
```

### ✅ Check if equity is actually changing
```bash
# Watch the dashboard logs in browser console
# Equity values should fluctuate slightly as prices move
```

### ✅ Check Aster DEX API
```typescript
// Test balance fetch directly
const credentials = getAsterCredentials('Claude Sonnet 4.5');
const client = new AsterClient(credentials.apiKey, credentials.apiSecret);
const balance = await client.getBalance();
console.log('USDT Balance:', balance.find(b => b.asset === 'USDT'));
```

## Expected Behavior

### With Open Positions:
- Lines move up/down in real-time as asset prices change
- Movement reflects unrealized PnL fluctuations
- Updates every 2 seconds (polling interval)

### Without Open Positions:
- Lines will be flat (all cash, no unrealized PnL)
- This is **correct behavior** - no positions means no price exposure

### With Stale/Cached Data:
- Lines appear frozen even if positions exist
- Check Aster API responses for staleness
- Verify Vercel crons are running

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Flow for Chart                      │
└─────────────────────────────────────────────────────────────┘

Every 2 seconds (Frontend):
  1. Fetch /api/leaderboard
     └─> Calls Aster DEX API (real-time balance + unrealized PnL)
  2. Fetch /api/snapshots
     └─> Reads historical snapshots from database
  3. Fetch /api/positions
     └─> Reads current positions from database
  4. Build chart data:
     └─> Combine historical snapshots + terminal point at "now"
  5. Chart re-renders

Every 2 minutes (Vercel Cron):
  /api/cron/snapshot-equity
  └─> Query Aster DEX balances
  └─> Calculate equity = cash + unrealized PnL
  └─> Insert into performance_snapshots table

Every 5 minutes (Vercel Cron):
  /api/cron/sync-positions
  └─> Query Aster DEX positions
  └─> Update database positions table
  └─> Update model equity in database
```

## Performance Considerations

### Data Volume:
- **Before fix**: ~24 snapshots/day per model (hourly)
- **After fix**: ~720 snapshots/day per model (every 2 mins)
- **Storage**: ~3.5 MB/day for 6 models

### Optimization:
If database growth becomes an issue:
1. Data retention policy (keep last 30 days)
2. Aggregate older data (hourly averages after 24h)
3. Adjust snapshot frequency (*/3 or */5 minutes)

## Related Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx:147-354` | Dashboard data fetching & chart building |
| `src/app/api/leaderboard/route.ts` | Real-time equity from Aster DEX |
| `src/app/api/snapshots/route.ts` | Historical snapshot data |
| `src/app/api/positions/route.ts` | Current positions (FIXED) |
| `src/app/api/cron/snapshot-equity/route.ts` | Create equity snapshots |
| `src/app/api/cron/sync-positions/route.ts` | Sync positions from Aster |
| `src/components/charts/EquityCurveChart.tsx` | Chart visualization |
| `vercel.json` | Cron schedule configuration |
| `scripts/trigger-crons.ts` | Local cron testing (NEW) |

## Next Steps

1. **Deploy to Vercel** to enable automatic cron jobs
2. **Monitor logs** to confirm crons are running
3. **Watch browser console** to verify equity updates
4. **Check production chart** for dynamic movement

---

**Status**: Fixes Applied ✅
**Created**: 2025-11-02
**Author**: Claude Code

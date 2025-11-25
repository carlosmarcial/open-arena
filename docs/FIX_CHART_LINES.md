# Fix: Straight Lines in Equity Curve Chart

## Problem

The equity curve chart was displaying straight lines between data points instead of showing the dynamic ups and downs of trading activity.

### Root Cause

The chart uses **linear interpolation** (`densifySeries` function) to create smooth lines between snapshot data points. However, snapshots were only being created:

1. **Once per hour** when the `execute-trades` cron job runs (line 752 in `/api/cron/execute-trades/route.ts`)
2. This resulted in only **2-3 data points** over the visible timeframe
3. With sparse data, linear interpolation creates **straight lines** between points

Example with 3 snapshots:
```
Start (60.00) -------- Mid (59.50) -------- End (61.35)
             ↑                      ↑
        straight line        straight line
```

## Solution

Created a **new dedicated snapshot cron job** that runs independently of trade execution:

### New File: `/api/cron/snapshot-equity/route.ts`
- Captures equity snapshots for all models
- Runs **every 2 minutes** (configurable)
- Lightweight - only reads data, doesn't execute trades
- Creates synchronized timestamps for all models in each run

### Configuration Changes

Updated `vercel.json` to add the new cron:
```json
{
  "path": "/api/cron/snapshot-equity",
  "schedule": "*/2 * * * *"  // Every 2 minutes
}
```

### Existing Crons
- **execute-trades**: `0 * * * *` (every hour) - Makes trading decisions
- **monitor-positions**: `*/15 * * * *` (every 15 min) - Checks for exits
- **sync-positions**: `*/5 * * * *` (every 5 min) - Updates position prices
- **snapshot-equity**: `*/2 * * * *` (every 2 min) - **NEW** - Creates chart data points

## Impact

With snapshots every 2 minutes instead of every hour:
- **Before**: ~3 points per hour = straight lines
- **After**: ~30 points per hour = smooth, dynamic curves

The chart will now accurately reflect:
- Intraday price movements
- Position P&L changes
- Trading activity impact
- Market volatility

## Testing

### Local Testing
```bash
# Test the new endpoint locally
curl -X GET "http://localhost:3000/api/cron/snapshot-equity" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Deployment
1. Deploy to Vercel
2. Monitor logs to confirm cron is running every 2 minutes
3. Check database: `SELECT COUNT(*) FROM performance_snapshots GROUP BY model_id` - should increase rapidly
4. Watch the chart - lines should become more dynamic within ~30 minutes

## Environment Variables Required

Make sure these are set in your Vercel project:
- `CRON_SECRET`: Authorization token for cron endpoints
- All existing Supabase credentials

## Performance Considerations

### Database Growth
- **Before**: ~24 snapshots/day per model (hourly)
- **After**: ~720 snapshots/day per model (every 2 min)
- **Storage**: ~4-5 KB per snapshot → ~3.5 MB/day for 6 models

### Optimization Options
If database growth becomes an issue:
1. Add data retention policy (keep last 7-30 days)
2. Aggregate older data (hourly averages after 24h)
3. Adjust frequency to */3 or */5 minutes

## Alternative Solutions Considered

### 1. Price-based snapshots (rejected)
- Trigger on significant price movements
- **Issue**: Unpredictable frequency, could still have gaps

### 2. Client-side interpolation (rejected)
- Use actual price data to interpolate between snapshots
- **Issue**: More complex, requires real-time market data

### 3. Reduce densification (quick fix, not ideal)
- Disable or reduce `densifySeries` interpolation
- **Issue**: Doesn't solve root cause, chart would be choppy

### 4. Separate snapshot cron (CHOSEN ✅)
- Simple, predictable, server-side
- Provides consistent data granularity
- Easy to configure frequency

## Monitoring

Check the Vercel logs for:
```
📸 [SNAPSHOT-CRON] Starting equity snapshot creation...
📊 [SNAPSHOT-CRON] Found 6 active models
  ✅ [DeepSeek Chat V3.1] Snapshot created: $61.35
  ✅ [Claude Sonnet 4.5] Snapshot created: $58.99
  ...
✅ [SNAPSHOT-CRON] Completed in 245ms
📊 [SNAPSHOT-CRON] Created 6/6 snapshots
```

## Rollback

If issues arise:
1. Remove the cron entry from `vercel.json`
2. Delete `/api/cron/snapshot-equity/route.ts`
3. Redeploy

The existing hourly snapshots will continue to work.

## Future Enhancements

1. **Variable frequency**: Increase snapshot frequency during high volatility
2. **Smart aggregation**: Automatically compress older data
3. **Multi-timeframe**: Store different granularities for different time ranges
4. **Delta encoding**: Only store changes to reduce storage

---

**Created**: 2025-10-30  
**Author**: Carlos Marcial  
**Status**: Implemented ✅

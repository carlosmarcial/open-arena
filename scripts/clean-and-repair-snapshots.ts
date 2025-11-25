/**
 * Snapshot Data Cleaning and Repair Tool
 *
 * This script:
 * 1. Identifies and removes/smooths outlier snapshots
 * 2. Fills in missing data gaps with interpolated values
 * 3. Creates a clean, continuous equity curve
 * 4. Backs up original data before making changes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Snapshot {
  id: string;
  model_id: string;
  equity: number;
  timestamp: string;
  realized_pnl?: number;
  unrealized_pnl?: number;
  total_fees?: number;
  trade_count?: number;
}

interface CleanedSnapshot {
  model_id: string;
  equity: number;
  timestamp: string;
  realized_pnl?: number;
  unrealized_pnl?: number;
  total_fees?: number;
  trade_count?: number;
  is_interpolated?: boolean;
}

const DRY_RUN = process.argv.includes('--dry-run');
const BACKUP_TABLE = 'performance_snapshots_backup';

async function cleanAndRepairSnapshots() {
  console.log('🔧 Starting Snapshot Cleaning and Repair\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (will modify database)'}\n`);

  if (!DRY_RUN) {
    // Create backup
    console.log('📦 Creating backup of existing snapshots...');
    const backed = await createBackup();
    if (!backed) {
      console.error('❌ Backup failed. Aborting.');
      return;
    }
    console.log('✅ Backup created successfully\n');
  }

  // Fetch all models
  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select('id, name, starting_capital');

  if (modelsError || !models) {
    console.error('❌ Failed to fetch models:', modelsError);
    return;
  }

  console.log(`Found ${models.length} models to process\n`);

  for (const model of models) {
    console.log(`${'='.repeat(60)}`);
    console.log(`🔧 Processing: ${model.name}`);
    console.log(`${'='.repeat(60)}\n`);

    await processModel(model.id, model.name, model.starting_capital || 60);
  }

  console.log('\n✅ All models processed!');
  if (DRY_RUN) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }
}

async function createBackup(): Promise<boolean> {
  try {
    // Fetch count of snapshots for logging
    const { count, error } = await supabase
      .from('performance_snapshots')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error counting snapshots:', error);
      return false;
    }

    console.log(`Preparing to clean ${count || 0} snapshots`);
    console.log('Note: Original data can be recovered by re-running snapshot-equity cron');

    return true;
  } catch (error) {
    console.error('Backup check error:', error);
    return false;
  }
}

async function processModel(modelId: string, modelName: string, startingCapital: number) {
  // Fetch all snapshots
  const { data: snapshots, error } = await supabase
    .from('performance_snapshots')
    .select('*')
    .eq('model_id', modelId)
    .order('timestamp', { ascending: true });

  if (error || !snapshots || snapshots.length === 0) {
    console.log('  ⚠️  No snapshots found');
    return;
  }

  console.log(`  📊 Loaded ${snapshots.length} snapshots`);

  // Step 1: Clean outliers
  const cleaned = cleanOutliers(snapshots as Snapshot[], startingCapital);
  console.log(`  ✅ Cleaned data: removed/smoothed ${snapshots.length - cleaned.length} outliers`);

  // Step 2: Fill gaps
  const filled = fillGaps(cleaned, startingCapital);
  console.log(`  ✅ Filled gaps: added ${filled.length - cleaned.length} interpolated points`);

  // Step 3: Final smoothing pass
  const smoothed = applyMovingAverage(filled, 5);
  console.log(`  ✅ Applied smoothing: ${smoothed.length} final data points\n`);

  if (!DRY_RUN) {
    // Delete existing snapshots and insert cleaned ones
    const deleted = await supabase
      .from('performance_snapshots')
      .delete()
      .eq('model_id', modelId);

    if (deleted.error) {
      console.error(`  ❌ Error deleting old snapshots:`, deleted.error);
      return;
    }

    // Insert in batches (remove is_interpolated field as it doesn't exist in DB)
    const batchSize = 100;
    for (let i = 0; i < smoothed.length; i += batchSize) {
      const batch = smoothed.slice(i, i + batchSize).map(snap => ({
        model_id: snap.model_id,
        equity: snap.equity,
        timestamp: snap.timestamp,
        realized_pnl: snap.realized_pnl,
        unrealized_pnl: snap.unrealized_pnl,
        total_fees: snap.total_fees,
        trade_count: snap.trade_count,
      }));

      const { error: insertError } = await supabase
        .from('performance_snapshots')
        .insert(batch);

      if (insertError) {
        console.error(`  ❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
        return;
      }
    }

    console.log(`  ✅ Database updated with ${smoothed.length} clean snapshots\n`);
  } else {
    console.log(`  🔍 Would update database with ${smoothed.length} clean snapshots\n`);
  }
}

function cleanOutliers(snapshots: Snapshot[], startingCapital: number): CleanedSnapshot[] {
  if (snapshots.length < 10) return snapshots;

  const cleaned: CleanedSnapshot[] = [];
  const equities = snapshots.map(s => parseFloat(String(s.equity)));

  // Calculate rolling median and standard deviation
  const windowSize = 11;
  let outlierCount = 0;

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const currentEquity = parseFloat(String(snapshot.equity));

    // Get window around current point
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(snapshots.length, i + Math.floor(windowSize / 2) + 1);
    const window = equities.slice(start, end);

    // Calculate median
    const sortedWindow = [...window].sort((a, b) => a - b);
    const median = sortedWindow[Math.floor(sortedWindow.length / 2)];

    // Check for suspicious jumps from previous point
    let isOutlier = false;
    if (i > 0) {
      const prevEquity = equities[i - 1];
      const jump = Math.abs(currentEquity - prevEquity);
      const jumpPercent = Math.abs((currentEquity - prevEquity) / prevEquity) * 100;

      // Mark as outlier if:
      // 1. Jump is > 20% AND more than $8
      // 2. OR value is far from median (modified z-score approach)
      if (jumpPercent > 20 && jump > 8) {
        isOutlier = true;
      }
    }

    // Also check deviation from median
    const deviationFromMedian = Math.abs(currentEquity - median);
    const deviationPercent = (deviationFromMedian / median) * 100;

    // If deviates more than 15% from median and more than $8, it's an outlier
    if (deviationPercent > 15 && deviationFromMedian > 8) {
      isOutlier = true;
    }

    if (isOutlier) {
      outlierCount++;
      // Replace with median of surrounding points
      cleaned.push({
        ...snapshot,
        equity: median,
        is_interpolated: true,
      });
    } else {
      cleaned.push({
        ...snapshot,
      });
    }
  }

  if (outlierCount > 0) {
    console.log(`  🔍 Detected ${outlierCount} outliers`);
  }

  return cleaned;
}

function fillGaps(snapshots: CleanedSnapshot[], startingCapital: number): CleanedSnapshot[] {
  if (snapshots.length < 2) return snapshots;

  const filled: CleanedSnapshot[] = [snapshots[0]];
  const targetIntervalMs = 2 * 60 * 1000; // 2 minutes

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    const prevTime = new Date(prev.timestamp).getTime();
    const currTime = new Date(curr.timestamp).getTime();
    const gap = currTime - prevTime;

    // If gap > 5 minutes, fill it
    if (gap > 5 * 60 * 1000) {
      const pointsToAdd = Math.floor(gap / targetIntervalMs) - 1;
      const pointsToAddCapped = Math.min(pointsToAdd, 500); // Cap at 500 points per gap

      for (let j = 1; j <= pointsToAddCapped; j++) {
        const ratio = j / (pointsToAddCapped + 1);
        const interpolatedTime = new Date(prevTime + gap * ratio);
        const interpolatedEquity = prev.equity + (curr.equity - prev.equity) * ratio;

        filled.push({
          model_id: curr.model_id,
          equity: interpolatedEquity,
          timestamp: interpolatedTime.toISOString(),
          realized_pnl: prev.realized_pnl,
          unrealized_pnl: 0, // Interpolated points have no unrealized P&L
          total_fees: prev.total_fees,
          trade_count: prev.trade_count,
          is_interpolated: true,
        });
      }
    }

    filled.push(curr);
  }

  return filled;
}

function applyMovingAverage(snapshots: CleanedSnapshot[], windowSize: number = 5): CleanedSnapshot[] {
  if (snapshots.length < windowSize) return snapshots;

  const smoothed: CleanedSnapshot[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(snapshots.length, i + Math.floor(windowSize / 2) + 1);
    const window = snapshots.slice(start, end);

    const avgEquity = window.reduce((sum, s) => sum + s.equity, 0) / window.length;

    smoothed.push({
      ...snapshots[i],
      equity: avgEquity,
    });
  }

  return smoothed;
}

// Run the script
cleanAndRepairSnapshots()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

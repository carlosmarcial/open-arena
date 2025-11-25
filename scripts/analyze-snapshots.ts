/**
 * Snapshot Data Analysis Tool
 * Analyzes historical snapshot data to identify:
 * - Outliers and anomalies
 * - Missing data gaps
 * - Statistical issues
 * - Data quality metrics
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
}

interface ModelStats {
  modelId: string;
  modelName: string;
  totalSnapshots: number;
  outliers: number;
  gaps: number;
  avgGapMinutes: number;
  maxGapMinutes: number;
  volatility: number;
  suspiciousJumps: number;
  dataQualityScore: number;
}

async function analyzeSnapshots() {
  console.log('📊 Starting Snapshot Data Analysis...\n');

  // Fetch all models
  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select('id, name, starting_capital');

  if (modelsError || !models) {
    console.error('❌ Failed to fetch models:', modelsError);
    return;
  }

  console.log(`Found ${models.length} models\n`);

  const allStats: ModelStats[] = [];

  for (const model of models) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 Analyzing: ${model.name} (${model.id})`);
    console.log(`${'='.repeat(60)}\n`);

    // Fetch all snapshots for this model
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('performance_snapshots')
      .select('id, model_id, equity, timestamp, realized_pnl, unrealized_pnl')
      .eq('model_id', model.id)
      .order('timestamp', { ascending: true });

    if (snapshotsError || !snapshots || snapshots.length === 0) {
      console.log('⚠️  No snapshots found');
      continue;
    }

    const stats = analyzeModelSnapshots(snapshots as Snapshot[], model.starting_capital || 60);
    allStats.push({
      modelId: model.id,
      modelName: model.name,
      ...stats,
    });

    // Print detailed analysis
    printModelAnalysis(model.name, snapshots as Snapshot[], stats);
  }

  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(60) + '\n');

  allStats.sort((a, b) => a.dataQualityScore - b.dataQualityScore);

  console.log('Models by Data Quality (worst to best):\n');
  allStats.forEach((stat, idx) => {
    const qualityEmoji = stat.dataQualityScore > 80 ? '✅' : stat.dataQualityScore > 60 ? '⚠️' : '❌';
    console.log(`${idx + 1}. ${qualityEmoji} ${stat.modelName}`);
    console.log(`   Quality Score: ${stat.dataQualityScore.toFixed(1)}/100`);
    console.log(`   Issues: ${stat.outliers} outliers, ${stat.gaps} gaps, ${stat.suspiciousJumps} jumps`);
    console.log('');
  });
}

function analyzeModelSnapshots(snapshots: Snapshot[], startingCapital: number) {
  const equities = snapshots.map(s => parseFloat(String(s.equity)));
  const timestamps = snapshots.map(s => new Date(s.timestamp).getTime());

  // Calculate statistics
  const mean = equities.reduce((a, b) => a + b, 0) / equities.length;
  const variance = equities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / equities.length;
  const stdDev = Math.sqrt(variance);
  const volatility = (stdDev / mean) * 100;

  // Identify outliers (values more than 2.5 standard deviations from mean)
  let outliers = 0;
  const outlierThreshold = 2.5;
  for (const equity of equities) {
    if (Math.abs(equity - mean) > outlierThreshold * stdDev) {
      outliers++;
    }
  }

  // Identify suspicious jumps (>20% change between consecutive snapshots)
  let suspiciousJumps = 0;
  for (let i = 1; i < equities.length; i++) {
    const prev = equities[i - 1];
    const curr = equities[i];
    const change = Math.abs((curr - prev) / prev);
    if (change > 0.20 && Math.abs(curr - prev) > 5) { // 20% change and more than $5
      suspiciousJumps++;
    }
  }

  // Identify gaps (should be ~2 minute intervals)
  const expectedIntervalMs = 2 * 60 * 1000; // 2 minutes
  const gapThresholdMs = 5 * 60 * 1000; // 5 minutes
  let gaps = 0;
  let totalGapMinutes = 0;
  let maxGapMinutes = 0;

  for (let i = 1; i < timestamps.length; i++) {
    const gapMs = timestamps[i] - timestamps[i - 1];
    if (gapMs > gapThresholdMs) {
      gaps++;
      const gapMinutes = gapMs / 60000;
      totalGapMinutes += gapMinutes;
      maxGapMinutes = Math.max(maxGapMinutes, gapMinutes);
    }
  }

  const avgGapMinutes = gaps > 0 ? totalGapMinutes / gaps : 0;

  // Calculate data quality score (0-100)
  // Deduct points for: outliers, gaps, volatility, jumps
  let qualityScore = 100;
  qualityScore -= Math.min(30, (outliers / snapshots.length) * 100 * 2); // Max -30 for outliers
  qualityScore -= Math.min(20, (gaps / snapshots.length) * 100 * 2); // Max -20 for gaps
  qualityScore -= Math.min(30, volatility / 2); // Max -30 for volatility
  qualityScore -= Math.min(20, (suspiciousJumps / snapshots.length) * 100 * 2); // Max -20 for jumps

  return {
    totalSnapshots: snapshots.length,
    outliers,
    gaps,
    avgGapMinutes,
    maxGapMinutes,
    volatility,
    suspiciousJumps,
    dataQualityScore: Math.max(0, qualityScore),
  };
}

function printModelAnalysis(modelName: string, snapshots: Snapshot[], stats: any) {
  console.log(`Total Snapshots: ${stats.totalSnapshots}`);
  console.log(`Data Quality Score: ${stats.dataQualityScore.toFixed(1)}/100\n`);

  console.log('📉 Statistical Analysis:');
  console.log(`  Volatility: ${stats.volatility.toFixed(2)}%`);
  console.log(`  Outliers: ${stats.outliers} (${((stats.outliers / stats.totalSnapshots) * 100).toFixed(1)}%)`);
  console.log(`  Suspicious Jumps: ${stats.suspiciousJumps}\n`);

  console.log('⏱️  Timing Analysis:');
  console.log(`  Data Gaps (>5 min): ${stats.gaps}`);
  console.log(`  Avg Gap Duration: ${stats.avgGapMinutes.toFixed(1)} minutes`);
  console.log(`  Max Gap Duration: ${stats.maxGapMinutes.toFixed(1)} minutes\n`);

  // Show worst jumps
  if (stats.suspiciousJumps > 0) {
    console.log('⚠️  Top 5 Suspicious Jumps:');
    const jumps: Array<{ from: number; to: number; change: number; timestamp: string }> = [];

    for (let i = 1; i < snapshots.length; i++) {
      const prev = parseFloat(String(snapshots[i - 1].equity));
      const curr = parseFloat(String(snapshots[i].equity));
      const change = Math.abs((curr - prev) / prev) * 100;

      if (change > 20 && Math.abs(curr - prev) > 5) {
        jumps.push({
          from: prev,
          to: curr,
          change,
          timestamp: snapshots[i].timestamp,
        });
      }
    }

    jumps
      .sort((a, b) => b.change - a.change)
      .slice(0, 5)
      .forEach((jump, idx) => {
        const direction = jump.to > jump.from ? '↗️' : '↘️';
        console.log(`  ${idx + 1}. ${direction} $${jump.from.toFixed(2)} → $${jump.to.toFixed(2)} (${jump.change.toFixed(1)}% change)`);
        console.log(`     at ${new Date(jump.timestamp).toLocaleString()}`);
      });
    console.log('');
  }

  // Show equity range
  const equities = snapshots.map(s => parseFloat(String(s.equity)));
  const min = Math.min(...equities);
  const max = Math.max(...equities);
  const current = equities[equities.length - 1];
  console.log(`💰 Equity Range:`);
  console.log(`  Min: $${min.toFixed(2)}`);
  console.log(`  Max: $${max.toFixed(2)}`);
  console.log(`  Current: $${current.toFixed(2)}`);
  console.log(`  Range: $${(max - min).toFixed(2)}\n`);
}

// Run analysis
analyzeSnapshots()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });

/**
 * Clean bad snapshot data from the database
 * Removes erratic snapshots from the first 12-24 hours and keeps only stable points
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanBadSnapshots() {
  console.log('🧹 Starting bad snapshot cleanup...\n');

  // Get all models
  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select('*');

  if (modelsError || !models) {
    console.error('❌ Failed to fetch models:', modelsError);
    return;
  }

  console.log(`📊 Found ${models.length} models\n`);

  for (const model of models) {
    console.log(`\n🔄 Processing ${model.name}...`);

    // Get ALL snapshots for this model
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('performance_snapshots')
      .select('*')
      .eq('model_id', model.id)
      .order('timestamp', { ascending: true });

    if (snapshotsError || !snapshots || snapshots.length === 0) {
      console.log(`  ⚠️  No snapshots found`);
      continue;
    }

    console.log(`  📈 Found ${snapshots.length} snapshots`);

    // Find first and last timestamps
    const firstTime = new Date(snapshots[0].timestamp).getTime();
    const lastTime = new Date(snapshots[snapshots.length - 1].timestamp).getTime();
    const cutoffTime = firstTime + (12 * 60 * 60 * 1000); // First 12 hours

    // Identify bad snapshots (large jumps in first 12h)
    const toDelete: string[] = [];
    let prevEquity = model.starting_capital || 60;

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const snapTime = new Date(snap.timestamp).getTime();
      const equity = parseFloat(snap.equity);

      // Only check first 12 hours
      if (snapTime > cutoffTime) break;

      // Skip first snapshot (anchor point)
      if (i === 0) {
        prevEquity = equity;
        continue;
      }

      // Check for large jumps (>$10)
      const jump = Math.abs(equity - prevEquity);
      if (jump > 10) {
        toDelete.push(snap.id);
        console.log(`  🚫 Flagged: ${new Date(snap.timestamp).toISOString()} - $${prevEquity.toFixed(2)} → $${equity.toFixed(2)} (Δ$${jump.toFixed(2)})`);
      } else {
        prevEquity = equity;
      }
    }

    if (toDelete.length === 0) {
      console.log(`  ✅ No bad snapshots found`);
      continue;
    }

    console.log(`  🗑️  Deleting ${toDelete.length} bad snapshots...`);

    // Delete in batches of 100
    const batchSize = 100;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('performance_snapshots')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`  ❌ Delete error:`, deleteError);
      }
    }

    console.log(`  ✅ Cleaned ${toDelete.length} snapshots`);

    // Verify remaining count
    const { count } = await supabase
      .from('performance_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', model.id);

    console.log(`  📊 Remaining snapshots: ${count}`);
  }

  console.log('\n✅ Cleanup complete!');
}

cleanBadSnapshots().catch(console.error);

/**
 * AGGRESSIVE snapshot cleanup
 * Deletes ALL snapshots from the first 12 hours (the chaotic period)
 * Keeps only: first snapshot + snapshots after 12h mark
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

async function aggressiveCleanSnapshots() {
  console.log('🔥 Starting AGGRESSIVE snapshot cleanup...\n');
  console.log('⚠️  This will DELETE ALL snapshots from the first 12 hours\n');

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

    // Find the cutoff time (12 hours after first snapshot)
    const firstTime = new Date(snapshots[0].timestamp).getTime();
    const cutoffTime = firstTime + (12 * 60 * 60 * 1000); // 12 hours

    // Collect all snapshots in the first 12h (except the very first one)
    const toDelete: string[] = [];
    
    for (let i = 1; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const snapTime = new Date(snap.timestamp).getTime();
      
      if (snapTime <= cutoffTime) {
        toDelete.push(snap.id);
      }
    }

    if (toDelete.length === 0) {
      console.log(`  ✅ No snapshots in first 12h to remove`);
      continue;
    }

    console.log(`  🗑️  Deleting ${toDelete.length} snapshots from first 12 hours...`);
    console.log(`  📍 Keeping first snapshot at: ${new Date(snapshots[0].timestamp).toISOString()}`);
    console.log(`  📍 Cutoff time: ${new Date(cutoffTime).toISOString()}`);

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

    console.log(`  ✅ Deleted ${toDelete.length} snapshots`);

    // Verify remaining count
    const { count } = await supabase
      .from('performance_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', model.id);

    console.log(`  📊 Remaining snapshots: ${count}`);
  }

  console.log('\n✅ AGGRESSIVE cleanup complete!');
  console.log('📝 Result: Each model now has ONLY:');
  console.log('   - First snapshot (starting point)');
  console.log('   - All snapshots after 12h mark (clean data)');
}

aggressiveCleanSnapshots().catch(console.error);

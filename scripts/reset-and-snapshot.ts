/**
 * Reset and Create Fresh Snapshot
 * Deletes all old snapshots and creates one fresh baseline
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetAndSnapshot() {
  console.log('🗑️  Deleting all old snapshots...');

  const { error: deleteError } = await supabase
    .from('performance_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('❌ Delete failed:', deleteError);
    return;
  }

  console.log('✅ Deleted all old snapshots\n');

  console.log('📸 Creating fresh baseline snapshot...');
  console.log('⏳ This will take 30-60 seconds as it fetches data from Aster for all models...\n');

  try {
    const response = await fetch('http://localhost:3000/api/cron/snapshot-equity', {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Fresh snapshot created!\n');
      console.log('📊 Current equity values:');
      data.snapshots?.forEach((snap: any) => {
        console.log(`   ${snap.modelName}: $${snap.equity.toFixed(2)}`);
      });
      console.log('\n🎉 All done! Your cron will now build clean data from this baseline.');
      console.log('   Refresh your dashboard to see the clean slate!');
    } else {
      console.error('❌ Snapshot failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Failed to create snapshot:', error);
  }
}

resetAndSnapshot()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

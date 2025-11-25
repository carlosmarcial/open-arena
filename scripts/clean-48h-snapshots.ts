import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function clean48h() {
  console.log('🔥 Cleaning first 48h of snapshots...\n');
  
  const { data: models } = await supabase.from('models').select('*');
  
  for (const model of models || []) {
    const { data: snapshots } = await supabase
      .from('performance_snapshots')
      .select('*')
      .eq('model_id', model.id)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length === 0) continue;

    const firstTime = new Date(snapshots[0].timestamp).getTime();
    const cutoffTime = firstTime + (48 * 60 * 60 * 1000); // 48 hours

    const toDelete = snapshots
      .slice(1)
      .filter(s => new Date(s.timestamp).getTime() <= cutoffTime)
      .map(s => s.id);

    if (toDelete.length > 0) {
      console.log(`${model.name}: Deleting ${toDelete.length} snapshots from first 48h`);
      
      for (let i = 0; i < toDelete.length; i += 100) {
        await supabase
          .from('performance_snapshots')
          .delete()
          .in('id', toDelete.slice(i, i + 100));
      }
    }
  }
  console.log('\n✅ Done');
}

clean48h();

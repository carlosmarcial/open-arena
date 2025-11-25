/**
 * Nuclear option: Keep only the last 24h of clean snapshots
 * Delete all older snapshots (the entire chaotic early period)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function keepOnlyRecent() {
  console.log('🔥 NUCLEAR CLEANUP: Keeping only last 24h of snapshots\n');
  
  const { data: models } = await supabase.from('models').select('*');
  
  const now = Date.now();
  const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago

  for (const model of models || []) {
    const { data: snapshots } = await supabase
      .from('performance_snapshots')
      .select('*')
      .eq('model_id', model.id)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length === 0) continue;

    // Delete everything older than 24h
    const toDelete = snapshots
      .filter(s => new Date(s.timestamp).getTime() < cutoffTime)
      .map(s => s.id);

    if (toDelete.length > 0) {
      console.log(`${model.name}: Deleting ${toDelete.length} old snapshots (keeping only last 24h)`);
      
      for (let i = 0; i < toDelete.length; i += 100) {
        await supabase
          .from('performance_snapshots')
          .delete()
          .in('id', toDelete.slice(i, i + 100));
      }

      const { count } = await supabase
        .from('performance_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', model.id);

      console.log(`  ✅ Remaining: ${count} snapshots`);
    }
  }
  
  console.log('\n✅ Done - Chart will now show only last 24h of clean data');
}

keepOnlyRecent();

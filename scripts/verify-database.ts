import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabase() {
  console.log('🔍 Verifying database state...\n');

  // Check models
  const { data: models } = await supabase.from('models').select('name, current_equity, status');
  console.log('📊 Models:');
  models?.forEach(m => console.log(`   ${m.name}: $${m.current_equity} (${m.status})`));

  // Check trades
  const { count: tradesCount } = await supabase.from('trades').select('*', { count: 'exact', head: true });
  console.log(`\n💱 Trades: ${tradesCount ?? 0}`);

  // Check positions
  const { count: positionsCount } = await supabase.from('positions').select('*', { count: 'exact', head: true });
  console.log(`📍 Positions: ${positionsCount ?? 0}`);

  // Check reasoning
  const { count: reasoningCount } = await supabase.from('model_reasoning').select('*', { count: 'exact', head: true });
  console.log(`🧠 Model Reasoning: ${reasoningCount ?? 0}`);

  // Check snapshots
  const { count: snapshotsCount } = await supabase.from('performance_snapshots').select('*', { count: 'exact', head: true });
  console.log(`📈 Performance Snapshots: ${snapshotsCount ?? 0}\n`);

  if (tradesCount === 0 && positionsCount === 0 && reasoningCount === 0) {
    console.log('✅ Database is clean and ready for testing!');
  }
}

verifyDatabase();

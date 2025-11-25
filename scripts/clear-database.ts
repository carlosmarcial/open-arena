import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log('🧹 Clearing Supabase tables...\n');

  try {
    // Clear in order (respecting foreign key constraints)
    console.log('Clearing model_reasoning...');
    const { error: reasoningError } = await supabase.from('model_reasoning').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (reasoningError) console.error('❌ Error:', reasoningError.message);
    else console.log('✅ model_reasoning cleared');

    console.log('\nClearing positions...');
    const { error: positionsError } = await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (positionsError) console.error('❌ Error:', positionsError.message);
    else console.log('✅ positions cleared');

    console.log('\nClearing trades...');
    const { error: tradesError } = await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (tradesError) console.error('❌ Error:', tradesError.message);
    else console.log('✅ trades cleared');

    console.log('\nClearing performance_snapshots...');
    const { error: snapshotsError } = await supabase.from('performance_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (snapshotsError) console.error('❌ Error:', snapshotsError.message);
    else console.log('✅ performance_snapshots cleared');

    console.log('\nClearing leaderboard...');
    const { error: leaderboardError } = await supabase.from('leaderboard').delete().neq('model_id', '00000000-0000-0000-0000-000000000000');
    if (leaderboardError) console.error('❌ Error:', leaderboardError.message);
    else console.log('✅ leaderboard cleared');

    // Reset models to starting values
    console.log('\nResetting models to $10,000...');
    const { error: modelsError } = await supabase
      .from('models')
      .update({ 
        current_equity: 10000.00,
        status: 'active'
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (modelsError) console.error('❌ Error:', modelsError.message);
    else console.log('✅ models reset to starting capital');

    console.log('\n✨ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

clearDatabase();

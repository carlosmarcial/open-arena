/**
 * Reset Competition
 * Clears all trading data and resets models to starting state
 * Run: npx tsx scripts/reset-competition.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function resetCompetition() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Resetting competition data...\n');

  // 1. Delete all trades
  console.log('📊 Deleting all trades...');
  const { error: tradesError } = await supabase
    .from('trades')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (tradesError) {
    console.error('❌ Error deleting trades:', tradesError);
  } else {
    console.log('✅ All trades deleted');
  }

  // 2. Delete all positions
  console.log('📍 Deleting all positions...');
  const { error: positionsError } = await supabase
    .from('positions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (positionsError) {
    console.error('❌ Error deleting positions:', positionsError);
  } else {
    console.log('✅ All positions deleted');
  }

  // 3. Delete all model reasoning
  console.log('💭 Deleting all model reasoning...');
  const { error: reasoningError } = await supabase
    .from('model_reasoning')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (reasoningError) {
    console.error('❌ Error deleting reasoning:', reasoningError);
  } else {
    console.log('✅ All reasoning deleted');
  }

  // 4. Delete all performance snapshots
  console.log('📈 Deleting all performance snapshots...');
  const { error: snapshotsError } = await supabase
    .from('performance_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (snapshotsError) {
    console.error('❌ Error deleting snapshots:', snapshotsError);
  } else {
    console.log('✅ All snapshots deleted');
  }

  // 5. Reset all models to starting capital
  console.log('💰 Resetting model equity to starting capital...');
  const { error: modelsError } = await supabase
    .from('models')
    .update({ current_equity: 50 })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
  
  if (modelsError) {
    console.error('❌ Error resetting models:', modelsError);
  } else {
    console.log('✅ All models reset to $50');
  }

  // 6. Refresh the leaderboard materialized view
  console.log('🔄 Refreshing leaderboard...');
  const { error: leaderboardError } = await supabase.rpc('refresh_leaderboard');
  
  if (leaderboardError) {
    console.error('❌ Error refreshing leaderboard:', leaderboardError);
  } else {
    console.log('✅ Leaderboard refreshed');
  }

  console.log('\n✅ Competition reset complete! Ready to start fresh! 🚀');
}

resetCompetition();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearTradingData() {
  console.log('🧹 Clearing all trading data to restart live trading...\n');

  try {
    // Clear in order to respect foreign key constraints
    console.log('📊 Clearing performance snapshots...');
    const { error: snapError } = await supabase.from('performance_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (snapError) throw snapError;

    console.log('🤖 Clearing AI reasoning logs...');
    const { error: reasonError } = await supabase.from('model_reasoning').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (reasonError) throw reasonError;

    console.log('📍 Clearing current positions...');
    const { error: posError } = await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (posError) throw posError;

    console.log('📈 Clearing trade history...');
    const { error: tradeError } = await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (tradeError) throw tradeError;

    console.log('💰 Resetting model equities to $50...');
    const { error: equityError } = await supabase
      .from('models')
      .update({ current_equity: 50.00 })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (equityError) throw equityError;

    // Note: Leaderboard is a materialized view and will update automatically when data changes

    console.log('\n✅ All trading data cleared successfully!');
    console.log('🚀 Live trading will start fresh with all models at $50 equity.');
    console.log('📊 Data will begin repopulating with the next trading cycle.');

  } catch (error) {
    console.error('❌ Error clearing trading data:', error);
    process.exit(1);
  }
}

clearTradingData();

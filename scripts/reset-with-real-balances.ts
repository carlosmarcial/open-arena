/**
 * Reset database with real Aster wallet balances
 * This sets starting_capital and current_equity to actual balances
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { AsterClient } from '@/lib/aster/client';
import { getAsterCredentials } from '@/lib/aster/credentials';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to get real-time balance from Aster DEX
async function getRealBalance(modelName: string): Promise<number> {
  try {
    const credentials = getAsterCredentials(modelName);
    const client = new AsterClient(credentials.apiKey, credentials.apiSecret);
    const balances = await client.getBalance();
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    return usdtBalance ? parseFloat(usdtBalance.availableBalance) : 0;
  } catch (error) {
    console.warn(`Failed to get real balance for ${modelName}:`, error);
    return 0; // Fallback to 0 if API fails
  }
}

async function resetDatabase() {
  console.log('🧹 Clearing trading data...');

  // Clear all trading data
  await supabase.from('performance_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('model_reasoning').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('📊 Fetching real Aster balances and updating models...');

  // Get all models
  const { data: models, error } = await supabase
    .from('models')
    .select('id, name')
    .neq('api_provider', 'btc'); // Skip BTC benchmark

  if (error) {
    console.error('Error fetching models:', error);
    return;
  }

  // Update each model's starting capital with real balance
  for (const model of models!) {
    const realBalance = await getRealBalance(model.name);
    if (realBalance > 0) {
      console.log(`💰 ${model.name}: $${realBalance.toFixed(2)}`);

      await supabase
        .from('models')
        .update({
          starting_capital: realBalance,
          current_equity: realBalance,
        })
        .eq('id', model.id);
    } else {
      console.warn(`⚠️  No balance found for ${model.name}, keeping current values`);
    }
  }

  // Handle BTC benchmark separately (no Aster balance, use fixed amount)
  const btcBalance = 50.00; // As mentioned in docs
  await supabase
    .from('models')
    .update({
      starting_capital: btcBalance,
      current_equity: btcBalance,
    })
    .eq('api_provider', 'btc');

  // Refresh leaderboard materialized view with latest equities
  console.log('📊 Refreshing leaderboard...');
  const { error: leaderboardError } = await supabase.rpc('refresh_leaderboard');
  if (leaderboardError) {
    console.error('Error refreshing leaderboard:', leaderboardError);
  } else {
    console.log('✅ Leaderboard refreshed');
  }

  console.log('✅ Database reset complete!');
  console.log('🎯 Models now start with their actual Aster wallet balances');
}

resetDatabase().catch(console.error);

/**
 * Reset all model equity values to $50
 * This prepares the database for live trading
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetEquity() {
  console.log('🔄 Resetting all model equity to $50...\n');

  try {
    // Use raw SQL to update all models at once
    const { data: models, error: updateError } = await supabase.rpc('exec_sql', {
      query: 'UPDATE models SET starting_capital = 50.00, current_equity = 50.00 RETURNING *'
    });

    // If RPC doesn't work, try direct query
    if (updateError && (updateError.code === '42883' || updateError.code === 'PGRST202')) {
      console.log('Trying alternative approach...');
      
      // Get all models first
      const { data: allModels, error: fetchError } = await supabase
        .from('models')
        .select('*');

      if (fetchError) {
        console.error('❌ Error fetching models:', fetchError);
        console.error('\n💡 You may need to update the database directly via Supabase dashboard.');
        console.error('   Run this SQL query in the SQL Editor:');
        console.error('   UPDATE models SET starting_capital = 50.00, current_equity = 50.00;');
        process.exit(1);
      }

      console.log(`\n✅ Found ${allModels?.length || 0} models in database`);
      console.log('\n⚠️  Cannot update via API due to permissions.');
      console.log('\n💡 Please run this SQL query in your Supabase SQL Editor:');
      console.log('\n   UPDATE models SET starting_capital = 50.00, current_equity = 50.00;\n');
      
      if (allModels && allModels.length > 0) {
        console.log('📊 Current Models:');
        allModels.forEach((model: any) => {
          console.log(`   ${model.icon} ${model.name}: $${model.current_equity}`);
        });
      }
      
      process.exit(0);
    }

    if (updateError) {
      console.error('❌ Error updating models:', updateError);
      process.exit(1);
    }

    console.log(`✅ Updated ${models?.length || 0} models to $50`);
    
    // Display updated models
    if (models && models.length > 0) {
      console.log('\n📊 Updated Models:');
      models.forEach((model: any) => {
        console.log(`   ${model.icon} ${model.name}: $${model.current_equity}`);
      });
    }

    // Update leaderboard view (it's a view, so just refresh the calculation)
    const { error: calcError } = await supabase.rpc('calculate_leaderboard_stats');
    
    if (calcError) {
      console.log('\n⚠️  Could not refresh leaderboard (this is OK if function doesn\'t exist)');
    } else {
      console.log('\n✅ Leaderboard refreshed');
    }

    console.log('\n✨ All done! Dashboard is ready for live trading.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

resetEquity();

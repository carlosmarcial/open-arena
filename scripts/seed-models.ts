/**
 * Script to seed models in the database for live trading
 * Run with: npx tsx scripts/seed-models.ts
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Initialize Supabase with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.log('Please ensure these are in .env.local:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedModels() {
  console.log('🚀 Seeding models for live trading...\n');

  // First, check if models exist
  const { data: existingModels, error: fetchError } = await supabase
    .from('models')
    .select('*');

  if (fetchError) {
    console.error('❌ Error fetching models:', fetchError);
    return;
  }

  console.log('Current models in database:', existingModels?.length || 0);

  if (!existingModels || existingModels.length === 0) {
    console.log('\n📝 No models found. Inserting new models...');
    
    const modelsToInsert = [
      { 
        name: 'Claude Sonnet 4.5', 
        icon: '🌟', 
        color: '#f97316', 
        api_model: 'anthropic/claude-3.5-sonnet-20241022', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      },
      { 
        name: 'GPT 5', 
        icon: '🔮', 
        color: '#3b82f6', 
        api_model: 'openai/gpt-4o', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      },
      { 
        name: 'Mistral Medium 3.1', 
        icon: '🌊', 
        color: '#0ea5e9', 
        api_model: 'mistralai/mistral-medium-3.1', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      },
      { 
        name: 'DeepSeek Chat V3.1', 
        icon: '🌀', 
        color: '#8b5cf6', 
        api_model: 'deepseek/deepseek-chat', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      },
      { 
        name: 'Grok 4', 
        icon: '⚡', 
        color: '#000000', 
        api_model: 'x-ai/grok-2-1212', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      },
      { 
        name: 'Qwen3 Max', 
        icon: '👁️', 
        color: '#ec4899', 
        api_model: 'qwen/qwen-2.5-72b-instruct', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      },
      { 
        name: 'BTC BUY&HODL', 
        icon: '₿', 
        color: '#f7931a', 
        api_model: 'btc-hodl', 
        starting_capital: 50, 
        current_equity: 50, 
        status: 'active' 
      }
    ];
    
    const { data: inserted, error: insertError } = await supabase
      .from('models')
      .insert(modelsToInsert)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting models:', insertError);
      return;
    } else {
      console.log('✅ Successfully inserted', inserted.length, 'models');
    }
  } else {
    console.log('\n🔄 Models already exist. Ensuring all are active...');
    
    // Update all models to active status
    const { data: updated, error: updateError } = await supabase
      .from('models')
      .update({ status: 'active' })
      .neq('status', 'active')
      .select();
    
    if (updateError) {
      console.error('❌ Error updating models:', updateError);
      return;
    }
    
    if (updated && updated.length > 0) {
      console.log('✅ Activated', updated.length, 'inactive models');
    } else {
      console.log('✅ All models were already active');
    }
  }
  
  // Verify final state
  const { data: activeModels, error: verifyError } = await supabase
    .from('models')
    .select('name, status, api_model, current_equity')
    .eq('status', 'active')
    .order('name');
  
  if (verifyError) {
    console.error('❌ Error verifying models:', verifyError);
    return;
  }
  
  console.log('\n📊 Active models ready for trading:');
  console.log('═══════════════════════════════════════');
  activeModels?.forEach(model => {
    console.log(`${model.api_model === 'btc-hodl' ? '₿' : '🤖'} ${model.name}: $${model.current_equity} USDT`);
  });
  console.log('═══════════════════════════════════════');
  console.log(`\n✅ Total models: ${activeModels?.length}`);
  console.log('🎯 Ready for live trading!');
}

seedModels().catch(console.error);

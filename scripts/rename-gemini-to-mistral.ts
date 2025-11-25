#!/usr/bin/env tsx

/**
 * Rename legacy Gemini model entries to Mistral Medium 3.1.
 * Run with: npx tsx scripts/rename-gemini-to-mistral.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const MISTRAL_PROPS = {
  name: 'Mistral Medium 3.1',
  api_provider: 'mistral',
  api_model: 'mistralai/mistral-medium-3.1',
  icon: '🌊',
  color: '#0ea5e9',
};

async function renameGeminiModels() {
  console.log('🔄 Looking for legacy Gemini models...');

  const { data: models, error } = await supabase
    .from('models')
    .select('id, name, api_model, current_equity, starting_capital');

  if (error) {
    console.error('❌ Failed to fetch models:', error);
    process.exit(1);
  }

  const legacyModels =
    models?.filter(
      (model) =>
        model.name?.toLowerCase().includes('gemini') ||
        model.api_model?.toLowerCase().includes('gemini')
    ) ?? [];

  if (legacyModels.length === 0) {
    console.log('✅ No legacy Gemini models found. Nothing to update.');
    return;
  }

  for (const model of legacyModels) {
    console.log(`🛠️  Updating "${model.name}" (${model.api_model}) → "${MISTRAL_PROPS.name}"`);

    const { error: updateError } = await supabase
      .from('models')
      .update(MISTRAL_PROPS)
      .eq('id', model.id);

    if (updateError) {
      console.error(`   ❌ Failed to update model ${model.id}:`, updateError);
      process.exit(1);
    }
  }

  console.log('📊 Refreshing leaderboard to reflect new model meta...');
  const { error: leaderboardError } = await supabase.rpc('refresh_leaderboard');
  if (leaderboardError) {
    console.error('   ⚠️  Leaderboard refresh failed:', leaderboardError);
  } else {
    console.log('   ✅ Leaderboard refreshed');
  }

  const { data: updated, error: verifyError } = await supabase
    .from('models')
    .select('name, api_model, current_equity')
    .order('name');

  if (verifyError) {
    console.error('❌ Failed to verify updated models:', verifyError);
    process.exit(1);
  }

  console.log('\n📋 Models after update:');
  updated?.forEach((model) => {
    console.log(`   • ${model.name} (${model.api_model}) → $${Number(model.current_equity).toFixed(2)}`);
  });

  console.log('\n✅ Gemini models successfully remapped to Mistral Medium 3.1');
}

renameGeminiModels().catch((err) => {
  console.error('Unexpected error renaming models:', err);
  process.exit(1);
});

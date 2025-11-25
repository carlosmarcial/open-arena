import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { getAIModelLogo } from '../src/lib/utils/logos';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkModels() {
  console.log('🔍 Checking models in database...\n');

  const { data: models } = await supabase.from('models').select('*');
  
  if (!models) {
    console.error('❌ No models found');
    return;
  }

  console.log('Models and their logos:\n');
  models.forEach(model => {
    const logo = getAIModelLogo(model.api_model);
    console.log(`${model.icon} ${model.name}`);
    console.log(`   api_model: ${model.api_model}`);
    console.log(`   logo path: ${logo || '❌ NOT FOUND'}`);
    console.log('');
  });
}

checkModels();

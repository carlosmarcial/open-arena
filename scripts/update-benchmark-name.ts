/**
 * Update benchmark model name from BTC BUY&HODL to ETH BUY&HODL
 * Run: npx tsx scripts/update-benchmark-name.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function updateBenchmarkName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Updating benchmark model name from BTC BUY&HODL to ETH BUY&HODL...');

  const { data, error } = await supabase
    .from('models')
    .update({ name: 'ETH BUY&HODL' })
    .eq('api_model', 'btc-hodl')
    .select();

  if (error) {
    console.error('❌ Error updating model:', error);
    process.exit(1);
  }

  console.log('✅ Successfully updated benchmark model name!');
  console.log('Updated records:', data);
}

updateBenchmarkName();

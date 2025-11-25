import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkBenchmark() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('api_model', 'btc-hodl');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Current benchmark model:', JSON.stringify(data, null, 2));
}

checkBenchmark();

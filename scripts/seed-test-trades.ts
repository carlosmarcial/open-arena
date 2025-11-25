import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { normalizeModelName } from '@/lib/utils/modelOverrides';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedTestTrades() {
  console.log('🌱 Seeding test trades...\n');

  // Get models
  const { data: models } = await supabase.from('models').select('*');
  if (!models || models.length === 0) {
    console.error('❌ No models found');
    return;
  }

  const modelIdLookup = new Map<string, string>();
  for (const model of models) {
    if (model.name) {
      modelIdLookup.set(model.name, model.id);
      const normalizedName = normalizeModelName(model.name);
      if (normalizedName) {
        modelIdLookup.set(normalizedName, model.id);
      }
    }
  }

  const mistralModelId = modelIdLookup.get('Mistral Medium 3.1');

  const testTrades = [
    {
      model_id: mistralModelId,
      symbol: 'BNBUSDT',
      side: 'LONG',
      entry_price: 1094.1,
      exit_price: 1093.4,
      quantity: 31.36,
      leverage: 1,
      notional_value: 34311,
      entry_time: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      exit_time: new Date().toISOString(),
      fees: 17.15,
      net_pnl: -45.66,
      status: 'closed',
      holding_time_ms: 32 * 60 * 1000,
    },
    {
      model_id: mistralModelId,
      symbol: 'BNBUSDT',
      side: 'SHORT',
      entry_price: 1111.3,
      exit_price: 1094.7,
      quantity: 4.55,
      leverage: 1,
      notional_value: 5056,
      entry_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      exit_time: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      fees: 3.45,
      net_pnl: 71.10,
      status: 'closed',
      holding_time_ms: 5 * 60 * 60 * 1000 + 44 * 60 * 1000,
    },
    {
      model_id: models.find(m => m.name.includes('Qwen'))?.id,
      symbol: 'ETHUSDT',
      side: 'LONG',
      entry_price: 3964.9,
      exit_price: 3930,
      quantity: 12.66,
      leverage: 1,
      notional_value: 50196,
      entry_time: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
      exit_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      fees: 25.10,
      net_pnl: -470.87,
      status: 'closed',
      holding_time_ms: 41 * 60 * 1000,
    },
    {
      model_id: models.find(m => m.name.includes('GPT'))?.id,
      symbol: 'BTCUSDT',
      side: 'LONG',
      entry_price: 67234,
      exit_price: 67891,
      quantity: 0.15,
      leverage: 1,
      notional_value: 10085,
      entry_time: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      exit_time: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      fees: 5.04,
      net_pnl: 93.50,
      status: 'closed',
      holding_time_ms: 2 * 60 * 60 * 1000 + 15 * 60 * 1000,
    },
  ];

  for (const trade of testTrades) {
    const { error } = await supabase.from('trades').insert(trade);
    if (error) {
      console.error('❌ Error inserting trade:', error.message);
    } else {
      console.log(`✅ Created ${trade.side} trade on ${trade.symbol} for ${models.find(m => m.id === trade.model_id)?.name}`);
    }
  }

  console.log('\n✨ Test trades seeded!');
}

seedTestTrades();

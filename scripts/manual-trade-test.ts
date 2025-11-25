import { createClient } from '@supabase/supabase-js';
import { createTradingAgent, Portfolio, MarketData } from '../src/lib/trading/agent';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function manualTradeTest() {
  console.log('🤖 Manual Trading Test\n');

  // Get all models
  const { data: models, error } = await supabase
    .from('models')
    .select('*')
    .eq('status', 'active');

  if (error || !models || models.length === 0) {
    console.error('❌ Could not fetch models:', error?.message);
    return;
  }

  console.log(`Found ${models.length} active models:\n`);
  models.forEach((model, idx) => {
    console.log(`${idx + 1}. ${model.icon} ${model.name} - $${model.current_equity}`);
  });

  // For now, test with first model (Claude)
  const testModel = models[0];
  console.log(`\n🎯 Testing with: ${testModel.icon} ${testModel.name}\n`);

  try {
    console.log('📊 Preparing minimal market data...');
    const marketData: MarketData[] = [];

    const portfolio: Portfolio = {
      equity: Number(testModel.current_equity) || 0,
      availableCash: Number(testModel.current_equity) || 0,
      totalPnl: 0,
      pnlPercentage: 0,
      positions: [],
    };

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('❌ Missing OPENROUTER_API_KEY in .env.local');
      return;
    }

    console.log('🧠 Running AI agent...');
    console.log('⏳ This may take 10-30 seconds...\n');

    const agent = createTradingAgent(apiKey, testModel.name);
    const result = await agent.analyzeAndDecide(portfolio, marketData);

    if (result.action === 'HOLD') {
      console.log('💤 Decision: HOLD (no trade executed)');
      console.log(`Reasoning: ${result.reasoning.substring(0, 200)}...`);
      console.log(`Confidence: ${result.confidence}%`);
    } else {
      console.log('✅ Action suggested!');
      console.log(`Action: ${result.action}`);
      if (result.symbol) console.log(`Symbol: ${result.symbol}`);
      if (result.size) console.log(`Size: ${result.size}`);
      if (result.leverage) console.log(`Leverage: ${result.leverage}x`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`\nFull reasoning:\n${result.reasoning}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

manualTradeTest();

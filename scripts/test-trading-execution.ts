/**
 * Test Trading Execution Script
 * 
 * Run this script to manually test the trading bot logic
 * before deploying to Vercel Cron
 * 
 * Usage:
 *   npx tsx scripts/test-trading-execution.ts
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testTradingExecution() {
  console.log('🧪 Testing trading execution locally...\n');

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in .env.local');
    process.exit(1);
  }

  try {
    // Call the local API endpoint
    const response = await fetch('http://localhost:3000/api/cron/execute-trades', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', data);
      process.exit(1);
    }

    console.log('\n✅ Trading execution completed successfully!\n');
    console.log('📊 Results:');
    console.log(`   Duration: ${data.duration}ms`);
    console.log(`   Timestamp: ${data.timestamp}`);
    console.log(`   Models processed: ${data.results.length}\n`);

    // Display results for each model
    data.results.forEach((result: any) => {
      const emoji = result.success ? '✅' : '❌';
      console.log(`${emoji} ${result.modelName}:`);
      console.log(`   Action: ${result.action}`);
      if (result.tradeId) {
        console.log(`   Trade ID: ${result.tradeId}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    });

    console.log('\n🎉 Check your dashboard at http://localhost:3000');
    console.log('   Completed trades should appear in the "COMPLETED TRADES" tab\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.log('\n💡 Make sure:');
    console.log('   1. Your dev server is running (npm run dev)');
    console.log('   2. All API keys are set in .env.local');
    console.log('   3. Supabase database is configured\n');
    process.exit(1);
  }
}

testTradingExecution();

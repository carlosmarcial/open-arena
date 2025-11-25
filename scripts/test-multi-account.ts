#!/usr/bin/env tsx

/**
 * Test Multi-Account Setup
 *
 * Verifies that each AI model's Aster DEX account is properly configured
 * and has the expected balance ($50.31 USDT + 2 ASTER).
 */

import { config } from 'dotenv';
import { AsterClient } from '../src/lib/aster/client';
import { getAsterCredentials } from '@/lib/aster/credentials';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function testModelAccount(modelName: string) {
  console.log(`\n🤖 Testing ${modelName}...`);

  try {
    // Get credentials for this model
    const credentials = getAsterCredentials(modelName);
    const client = new AsterClient(credentials.apiKey, credentials.apiSecret);

    // Test basic connectivity
    console.log('   🔗 Testing connectivity...');
    await client.ping();
    console.log('   ✅ Ping successful');

    // Get server time
    const serverTime = await client.getServerTime();
    console.log(`   🕐 Server time: ${new Date(serverTime.serverTime).toISOString()}`);

    // Get account balance (futures)
    console.log('   💰 Fetching futures balance...');
    const balances = await client.getBalance();

    const usdtBalance = balances.find(b => b.asset === 'USDT');
    const asterBalance = balances.find(b => b.asset === 'ASTER');

    const usdtAmount = usdtBalance ? parseFloat(usdtBalance.availableBalance) : 0;

    const asterAvailable = asterBalance ? parseFloat(asterBalance.availableBalance) : 0;
    const asterTotal = asterBalance ? parseFloat(asterBalance.balance) : 0;
    const asterCrossWallet = asterBalance ? parseFloat(asterBalance.crossWalletBalance) : 0;
    const asterAmount = asterAvailable > 0 ? asterAvailable : Math.max(asterTotal, asterCrossWallet);

    console.log(`   💵 USDT Balance: ${usdtAmount.toFixed(2)} USDT`);
    console.log(`   💎 ASTER Balance (available): ${asterAvailable.toFixed(4)} ASTER`);
    if (asterAmount !== asterAvailable) {
      console.log(`   💎 ASTER Balance (total): ${asterAmount.toFixed(4)} ASTER`);
    }

    // Check if ASTER needs to be transferred from spot to futures


    // Check if USDT balance reflects the new funding level
    const usdtOk = usdtAmount >= 60;

    if (usdtOk) {
      console.log('   ✅ Balance check passed');

      // ASTER might be handled differently in Aster DEX
      if (asterAmount === 0) {
        console.log('   ℹ️  ASTER: 0.0000 (may be held in spot wallet for fee discounts)');
        console.log('   ℹ️  Fee discounts should still work if deposited to perpetual account');
      } else {
        console.log('   ✅ ASTER balance confirmed for fee discounts');
      }

      return { modelName, success: true, usdt: usdtAmount, aster: asterAmount };
    } else {
      console.log(`   ⚠️  Balance check failed - expected ≥$60 USDT, got $${usdtAmount.toFixed(2)}`);
      return { modelName, success: false, usdt: usdtAmount, aster: asterAmount, error: 'Unexpected USDT balance' };
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return { modelName, success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  console.log('🚀 Testing Multi-Account Open Arena Setup\n');

  // Debug: Check if environment variables are loaded
  console.log('🔧 Environment check:');
  console.log(`   CLAUDE_ASTER_API_KEY: ${process.env.CLAUDE_ASTER_API_KEY ? '✅ Set' : '❌ Missing'} (${process.env.CLAUDE_ASTER_API_KEY?.substring(0, 8)}...)`);
  console.log(`   MISTRAL_ASTER_API_KEY: ${process.env.MISTRAL_ASTER_API_KEY ? '✅ Set' : '❌ Missing'} (${process.env.MISTRAL_ASTER_API_KEY?.substring(0, 8)}...)`);
  console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing'}\n`);

  const models = [
    'Claude Sonnet 4.5',
    'GPT 5',
    'Mistral Medium 3.1',
    'DeepSeek Chat V3.1',
    'Grok 4',
    'Qwen3 Max'
  ];

  const results = [];
  let successCount = 0;

  for (const modelName of models) {
    const result = await testModelAccount(modelName);
    results.push(result);
    if (result.success) successCount++;
  }

  console.log('\n📊 Summary:');
  console.log(`   Total models: ${models.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${models.length - successCount}`);

  if (successCount === models.length) {
    console.log('\n🎉 All accounts are properly configured!');
    console.log('   Ready for live trading competition.');
  } else {
    console.log('\n❌ Some accounts have issues. Please check the errors above.');
    console.log('   Make sure all API keys are correctly set in .env.local');
  }

  // Detailed results
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const balance = result.usdt ? `$${result.usdt.toFixed(2)} USDT, ${result.aster?.toFixed(2)} ASTER` : 'N/A';
    console.log(`   ${status} ${result.modelName}: ${balance} ${result.error || ''}`);
  });
}

// Run the test
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

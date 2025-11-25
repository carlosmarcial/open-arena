/**
 * Test script to verify Aster API connection
 * Run with: npx tsx scripts/test-aster-api.ts
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

import { AsterClient } from '../src/lib/aster/client';

async function testAsterAPI() {
  console.log('🔍 Testing Aster API connection...\n');

  // Get credentials from environment
  const apiKey = process.env.ASTER_API_KEY;
  const apiSecret = process.env.ASTER_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('❌ Missing API credentials in .env.local');
    console.log('\nPlease add:');
    console.log('ASTER_API_KEY=your_key_here');
    console.log('ASTER_API_SECRET=your_secret_here');
    process.exit(1);
  }

  const client = new AsterClient(apiKey, apiSecret);

  try {
    // Test 1: Ping
    console.log('1️⃣ Testing ping...');
    await client.ping();
    console.log('   ✅ Ping successful\n');

    // Test 2: Server time
    console.log('2️⃣ Getting server time...');
    const timeData = await client.getServerTime();
    console.log(`   ✅ Server time: ${new Date(timeData.serverTime).toISOString()}\n`);

    // Test 3: Exchange info
    console.log('3️⃣ Getting exchange info...');
    const exchangeInfo = await client.getExchangeInfo();
    console.log(`   ✅ Found ${exchangeInfo.symbols.length} trading pairs`);
    console.log(`   📊 Sample symbols: ${exchangeInfo.symbols.slice(0, 5).map(s => s.symbol).join(', ')}\n`);

    // Test 4: Get prices
    console.log('4️⃣ Getting current prices...');
    const prices = await client.getPrice();
    const btcPrice = prices.find((p: any) => p.symbol === 'BTCUSDT');
    const ethPrice = prices.find((p: any) => p.symbol === 'ETHUSDT');
    const solPrice = prices.find((p: any) => p.symbol === 'SOLUSDT');
    
    console.log('   ✅ Current prices:');
    if (btcPrice) console.log(`      BTC: $${parseFloat(btcPrice.price).toLocaleString()}`);
    if (ethPrice) console.log(`      ETH: $${parseFloat(ethPrice.price).toLocaleString()}`);
    if (solPrice) console.log(`      SOL: $${parseFloat(solPrice.price).toLocaleString()}\n`);

    // Test 5: Get account balance
    console.log('5️⃣ Getting account balance...');
    try {
      const balances = await client.getBalance();
      const usdtBalance = balances.find(b => b.asset === 'USDT');
      
      console.log('   ✅ Account balance:');
      if (usdtBalance) {
        console.log(`      USDT: ${parseFloat(usdtBalance.availableBalance).toFixed(2)}`);
        console.log(`      Available: ${parseFloat(usdtBalance.availableBalance).toFixed(2)}`);
      } else {
        console.log('      No USDT balance found');
      }
      console.log();
    } catch (error: any) {
      console.log('   ⚠️  Could not fetch balance:', error.message);
      console.log('   (This is normal if API key has limited permissions)\n');
    }

    // Test 6: Get positions
    console.log('6️⃣ Getting current positions...');
    try {
      const positions = await client.getPositions();
      const openPositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
      
      console.log(`   ✅ Open positions: ${openPositions.length}`);
      if (openPositions.length > 0) {
        openPositions.forEach(pos => {
          console.log(`      ${pos.symbol}: ${pos.positionAmt} @ $${pos.entryPrice} (${pos.leverage}x)`);
        });
      }
      console.log();
    } catch (error: any) {
      console.log('   ⚠️  Could not fetch positions:', error.message);
      console.log('   (This is normal if API key has limited permissions)\n');
    }

    console.log('✅ All tests passed! Aster API is working correctly.\n');
    console.log('🎉 You\'re ready to start building Open Arena!');

  } catch (error: any) {
    console.error('\n❌ Error testing Aster API:');
    console.error(error.message);
    
    if (error.message.includes('Invalid API-key')) {
      console.log('\n💡 Tip: Double-check your ASTER_API_KEY in .env.local');
    } else if (error.message.includes('Signature')) {
      console.log('\n💡 Tip: Double-check your ASTER_API_SECRET in .env.local');
    }
    
    process.exit(1);
  }
}

// Run the test
testAsterAPI();

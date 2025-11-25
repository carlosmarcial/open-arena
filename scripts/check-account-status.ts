import { config } from 'dotenv';
import { resolve } from 'path';
import { AsterClient } from '@/lib/aster/client';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function checkAccountStatus() {
  console.log('🔍 Checking detailed Aster account status...\n');

  const asterApiKey = process.env.ASTER_API_KEY;
  const asterApiSecret = process.env.ASTER_API_SECRET;

  if (!asterApiKey || !asterApiSecret) {
    console.error('❌ Missing Aster API credentials');
    process.exit(1);
  }

  const client = new AsterClient(asterApiKey, asterApiSecret);

  try {
    // Check account info
    console.log('1️⃣ Account Information:');
    const accountInfo = await client.getAccountInfo();
    console.log('   Total Wallet Balance:', accountInfo.totalWalletBalance, 'USDT');
    console.log('   Available Balance:', accountInfo.availableBalance, 'USDT');

    // Check balances
    console.log('\n2️⃣ Asset Balances:');
    const balances = await client.getBalance();
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    if (usdtBalance) {
      console.log('   USDT Balance:', usdtBalance.balance);
      console.log('   USDT Available:', usdtBalance.availableBalance);
    }

    // Check current prices
    console.log('\n3️⃣ Current DOGE Price:');
    const dogePrices = await client.getPrice('DOGEUSDT');
    if (dogePrices && dogePrices.price) {
      console.log('   DOGE/USDT:', parseFloat(dogePrices.price).toFixed(6));
    }

    // Check recent trades (last 24 hours)
    console.log('\n4️⃣ Recent DOGE Trades:');
    const recentTrades = await client.getTradeHistory('DOGEUSDT', 10); // Last 10 trades
    if (recentTrades && recentTrades.length > 0) {
      recentTrades.slice(0, 5).forEach((trade, index) => { // Show last 5
        console.log(`   ${index + 1}. ${trade.side} ${parseFloat(trade.qty).toFixed(0)} DOGE @ $${parseFloat(trade.price).toFixed(6)} (${new Date(trade.time).toLocaleString()})`);
      });
    } else {
      console.log('   No recent DOGE trades found');
    }

    // Check open orders
    console.log('\n5️⃣ Open Orders:');
    const openOrders = await client.getOpenOrders('DOGEUSDT');
    if (openOrders && openOrders.length > 0) {
      openOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ${order.side} ${order.origQty} ${order.symbol} @ $${parseFloat(order.price).toFixed(6)} (${order.status})`);
      });
    } else {
      console.log('   No open DOGE orders');
    }

    // Check positions
    console.log('\n6️⃣ Current Positions:');
    const positions = await client.getPositions();
    if (positions && positions.length > 0) {
      positions.forEach((pos, index) => {
        const amount = parseFloat(pos.positionAmt);
        const side = amount > 0 ? 'LONG' : 'SHORT';
        const symbol = pos.symbol.replace('USDT', '');
        console.log(`   ${index + 1}. ${Math.abs(amount)} ${symbol} (${side}) @ $${parseFloat(pos.entryPrice).toFixed(4)}`);
      });
    } else {
      console.log('   No open positions');
    }

    console.log('\n✅ Account status check complete!');

  } catch (error) {
    console.error('❌ Error checking account:', error);
  }
}

checkAccountStatus();

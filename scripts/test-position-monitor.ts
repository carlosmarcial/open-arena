/**
 * Test Position Monitor Script
 * 
 * Run this to test the position monitoring logic
 * 
 * Usage:
 *   npx tsx scripts/test-position-monitor.ts
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testPositionMonitor() {
  console.log('👁️  Testing position monitor locally...\n');

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in .env.local');
    process.exit(1);
  }

  try {
    const response = await fetch('http://localhost:3000/api/cron/monitor-positions', {
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

    console.log('\n✅ Position monitor completed successfully!\n');
    console.log('📊 Results:');
    console.log(`   Duration: ${data.duration}ms`);
    console.log(`   Timestamp: ${data.timestamp}`);
    console.log(`   Positions monitored: ${data.positionsMonitored}`);
    console.log(`   Positions updated: ${data.positionsUpdated}`);
    console.log(`   Positions closed: ${data.positionsClosed}`);

    if (data.positionsClosed > 0) {
      console.log('\n🎯 Positions were auto-closed! Check:');
      console.log('   - COMPLETED TRADES tab for closed trades');
      console.log('   - POSITIONS tab to see remaining open positions');
    } else if (data.positionsMonitored === 0) {
      console.log('\n💡 No open positions to monitor.');
      console.log('   Run test-trading-execution.ts first to create positions.');
    } else {
      console.log('\n✅ All positions updated with current prices.');
      console.log('   None hit take profit/stop loss yet.');
    }

    console.log('\n🎉 Check your dashboard at http://localhost:3000\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.log('\n💡 Make sure:');
    console.log('   1. Your dev server is running (npm run dev)');
    console.log('   2. All API keys are set in .env.local');
    console.log('   3. Supabase database is configured\n');
    process.exit(1);
  }
}

testPositionMonitor();

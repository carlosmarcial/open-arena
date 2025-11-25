/**
 * Investigation Script: Analyze Equity Curve Spikes
 * This script queries the database to find anomalies in the performance_snapshots data
 */

import { supabase } from '../src/lib/supabase';

async function investigateSpikes() {
  console.log('🔍 Investigating equity curve spikes...\n');

  // 1. Check for large equity changes
  console.log('📊 Checking for large equity jumps:\n');
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('performance_snapshots')
    .select('model_id, equity, timestamp')
    .gte('timestamp', '2025-11-06T02:00:00Z')
    .lte('timestamp', '2025-11-06T07:00:00Z')
    .order('model_id')
    .order('timestamp');

  if (snapshotsError) {
    console.error('Error fetching snapshots:', snapshotsError);
    return;
  }

  if (!snapshots || snapshots.length === 0) {
    console.log('❌ No snapshots found in the specified time range');
    return;
  }

  // Group by model and calculate deltas
  const byModel = new Map<string, Array<{ timestamp: string; equity: number }>>();
  
  for (const snapshot of snapshots) {
    if (!byModel.has(snapshot.model_id)) {
      byModel.set(snapshot.model_id, []);
    }
    byModel.get(snapshot.model_id)!.push({
      timestamp: snapshot.timestamp,
      equity: Number(snapshot.equity)
    });
  }

  // Analyze each model
  for (const [modelId, data] of byModel.entries()) {
    // Get model name
    const { data: modelData } = await supabase
      .from('models')
      .select('name')
      .eq('id', modelId)
      .single();

    const modelName = modelData?.name || modelId.substring(0, 8);
    
    console.log(`\n📈 Model: ${modelName}`);
    console.log(`   Total snapshots: ${data.length}`);

    // Find large changes
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const change = curr.equity - prev.equity;
      const changePercent = Math.abs(change / prev.equity) * 100;

      if (changePercent > 5) { // More than 5% change
        console.log(`   🚨 LARGE CHANGE DETECTED:`);
        console.log(`      Time: ${prev.timestamp} → ${curr.timestamp}`);
        console.log(`      Equity: $${prev.equity.toFixed(2)} → $${curr.equity.toFixed(2)}`);
        console.log(`      Change: $${change.toFixed(2)} (${changePercent.toFixed(1)}%)`);
      }
    }
  }

  // 2. Check for duplicate timestamps
  console.log('\n\n📅 Checking for duplicate timestamps:\n');
  
  // Manual duplicate check (RPC method may not exist)
  const timestamps = new Map<string, number>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.model_id}-${snapshot.timestamp}`;
    timestamps.set(key, (timestamps.get(key) || 0) + 1);
  }

  const dupsFound = Array.from(timestamps.entries()).filter(([_, count]) => count > 1);
  if (dupsFound.length > 0) {
    console.log(`❌ Found ${dupsFound.length} duplicate timestamp(s):`);
    dupsFound.forEach(([key, count]) => {
      console.log(`   ${key}: ${count} occurrences`);
    });
  } else {
    console.log('✅ No duplicate timestamps found');
  }

  // 3. Check for trades during spike times
  console.log('\n\n💰 Checking for trades during spike period:\n');
  const { data: trades, error: tradesError } = await supabase
    .from('trades')
    .select('model_id, symbol, side, entry_price, exit_price, quantity, leverage, net_pnl, entry_time, exit_time, status')
    .or(`entry_time.gte.2025-11-06T02:00:00Z,exit_time.gte.2025-11-06T02:00:00Z`)
    .or(`entry_time.lte.2025-11-06T07:00:00Z,exit_time.lte.2025-11-06T07:00:00Z`)
    .order('entry_time');

  if (tradesError) {
    console.error('Error fetching trades:', tradesError);
  } else if (!trades || trades.length === 0) {
    console.log('❌ No trades found during this period');
  } else {
    console.log(`✅ Found ${trades.length} trade(s):`);
    for (const trade of trades) {
      const { data: modelData } = await supabase
        .from('models')
        .select('name')
        .eq('id', trade.model_id)
        .single();

      console.log(`\n   Model: ${modelData?.name || 'Unknown'}`);
      console.log(`   ${trade.side} ${trade.symbol} @ ${trade.leverage}x leverage`);
      console.log(`   Entry: $${trade.entry_price} at ${trade.entry_time}`);
      if (trade.exit_time) {
        console.log(`   Exit: $${trade.exit_price} at ${trade.exit_time}`);
        console.log(`   P&L: $${trade.net_pnl}`);
      } else {
        console.log(`   Status: ${trade.status} (still open)`);
      }
    }
  }

  // 4. Check chart data structure
  console.log('\n\n📊 Checking data passed to chart:\n');
  
  // Simulate what the leaderboard API returns
  const { data: models } = await supabase
    .from('models')
    .select('id, name, current_equity, starting_capital')
    .order('current_equity', { ascending: false });

  if (models) {
    console.log('Current model equities:');
    for (const model of models) {
      const snapCount = byModel.get(model.id)?.length || 0;
      console.log(`   ${model.name}: $${model.current_equity} (${snapCount} snapshots)`);
    }
  }

  console.log('\n✅ Investigation complete!\n');
  process.exit(0);
}

investigateSpikes().catch((error) => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});

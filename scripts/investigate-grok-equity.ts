/**
 * Investigation Script: Grok 4 Equity Fluctuations
 * This script analyzes why Grok 4's equity jumps around
 */

import { supabase } from '../src/lib/supabase';

async function investigateGrokEquity() {
  console.log('🔍 Investigating Grok 4 equity fluctuations...\n');

  // 1. Find Grok 4 model
  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select('*')
    .ilike('name', '%grok%');

  if (modelsError || !models || models.length === 0) {
    console.error('❌ Could not find Grok 4 model');
    return;
  }

  const grokModel = models[0];
  console.log(`📊 Found: ${grokModel.name}`);
  console.log(`   ID: ${grokModel.id}`);
  console.log(`   Current Equity: $${grokModel.current_equity}`);
  console.log(`   Starting Capital: $${grokModel.starting_capital}\n`);

  // 2. Get recent equity snapshots (last 50)
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('performance_snapshots')
    .select('equity, timestamp')
    .eq('model_id', grokModel.id)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (snapshotsError || !snapshots) {
    console.error('❌ Error fetching snapshots:', snapshotsError);
    return;
  }

  console.log(`📈 Last 50 equity snapshots:\n`);
  
  // Analyze for large changes
  let minEquity = Infinity;
  let maxEquity = -Infinity;
  const changes: Array<{ from: number; to: number; change: number; percent: number; time: string }> = [];

  for (let i = 0; i < snapshots.length; i++) {
    const equity = Number(snapshots[i].equity);
    minEquity = Math.min(minEquity, equity);
    maxEquity = Math.max(maxEquity, equity);

    if (i > 0) {
      const prevEquity = Number(snapshots[i - 1].equity);
      const change = equity - prevEquity;
      const changePercent = (change / prevEquity) * 100;

      if (Math.abs(changePercent) > 3) {
        changes.push({
          from: prevEquity,
          to: equity,
          change,
          percent: changePercent,
          time: snapshots[i].timestamp
        });
      }
    }
  }

  console.log(`   Range: $${minEquity.toFixed(2)} - $${maxEquity.toFixed(2)}`);
  console.log(`   Difference: $${(maxEquity - minEquity).toFixed(2)}\n`);

  if (changes.length > 0) {
    console.log(`🚨 Found ${changes.length} large changes (>3%):\n`);
    changes.forEach(c => {
      console.log(`   ${c.time}`);
      console.log(`   $${c.from.toFixed(2)} → $${c.to.toFixed(2)} (${c.change > 0 ? '+' : ''}${c.change.toFixed(2)} / ${c.percent.toFixed(1)}%)\n`);
    });
  } else {
    console.log('✅ No large changes detected in last 50 snapshots\n');
  }

  // 3. Check for open positions
  const { data: positions, error: positionsError } = await supabase
    .from('positions')
    .select('*')
    .eq('model_id', grokModel.id);

  if (positionsError) {
    console.error('❌ Error fetching positions:', positionsError);
  } else {
    console.log(`💼 Current Open Positions: ${positions?.length || 0}\n`);
    if (positions && positions.length > 0) {
      positions.forEach(p => {
        console.log(`   ${p.side} ${p.symbol}`);
        console.log(`   Entry: $${p.entry_price} × ${p.quantity} @ ${p.leverage}x`);
        console.log(`   Unrealized P&L: $${p.unrealized_pnl}`);
        console.log(`   Last Updated: ${p.last_updated}\n`);
      });
    }
  }

  // 4. Check recent trades
  const { data: trades, error: tradesError } = await supabase
    .from('trades')
    .select('*')
    .eq('model_id', grokModel.id)
    .order('entry_time', { ascending: false })
    .limit(10);

  if (tradesError) {
    console.error('❌ Error fetching trades:', tradesError);
  } else {
    console.log(`💰 Last 10 Trades:\n`);
    trades?.forEach(t => {
      console.log(`   ${t.side} ${t.symbol} @ ${t.leverage}x`);
      console.log(`   Entry: $${t.entry_price} at ${t.entry_time}`);
      if (t.exit_time) {
        console.log(`   Exit: $${t.exit_price} at ${t.exit_time}`);
        console.log(`   P&L: $${t.net_pnl}`);
      } else {
        console.log(`   Status: ${t.status}`);
      }
      console.log();
    });
  }

  // 5. Look for patterns
  console.log('🔎 Analysis:\n');

  const recentSnapshots = snapshots.slice(0, 10);
  const equityValues = recentSnapshots.map(s => Number(s.equity));
  const avgEquity = equityValues.reduce((a, b) => a + b, 0) / equityValues.length;
  const volatility = Math.sqrt(
    equityValues.reduce((sum, val) => sum + Math.pow(val - avgEquity, 2), 0) / equityValues.length
  );

  console.log(`   Average Equity (last 10): $${avgEquity.toFixed(2)}`);
  console.log(`   Volatility (std dev): $${volatility.toFixed(2)}`);
  console.log(`   Volatility %: ${((volatility / avgEquity) * 100).toFixed(2)}%`);

  // Check if equity goes to specific values repeatedly
  const equityFrequency = new Map<number, number>();
  snapshots.forEach(s => {
    const rounded = Math.round(Number(s.equity));
    equityFrequency.set(rounded, (equityFrequency.get(rounded) || 0) + 1);
  });

  const frequentValues = Array.from(equityFrequency.entries())
    .filter(([_, count]) => count > 5)
    .sort((a, b) => b[1] - a[1]);

  if (frequentValues.length > 0) {
    console.log(`\n   📊 Frequently occurring equity values:`);
    frequentValues.forEach(([value, count]) => {
      console.log(`      $${value}: ${count} times (${((count / snapshots.length) * 100).toFixed(1)}%)`);
    });
  }

  console.log('\n✅ Investigation complete!\n');
  process.exit(0);
}

investigateGrokEquity().catch((error) => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});

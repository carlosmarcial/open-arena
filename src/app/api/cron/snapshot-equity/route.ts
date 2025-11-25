/**
 * GET /api/cron/snapshot-equity
 * Creates performance snapshots for all models (without executing trades)
 * This should be called more frequently than execute-trades (e.g., every 1-2 minutes)
 * to create smoother equity curves in the chart.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { AsterClient } from '@/lib/aster/client';
import { getAsterCredentials } from '@/lib/aster/credentials';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const startTime = Date.now();
  console.log('\n📸 [SNAPSHOT-CRON] Starting equity snapshot creation...');

  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ [SNAPSHOT-CRON] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize shared Aster client for market prices
    const sharedAsterClient = new AsterClient('', '');
    const marketPrices = await sharedAsterClient.getPrice();

    // Get all active models
    const { data: modelsRaw, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('status', 'active');

    const models = (modelsRaw || []).map((model) => applyModelUIOverrides(model));

    if (modelsError || !models) {
      throw new Error(`Failed to fetch models: ${modelsError?.message}`);
    }

    console.log(`📊 [SNAPSHOT-CRON] Found ${models.length} active models`);

    // Use a single timestamp for this snapshot run
    const runTimestamp = new Date().toISOString();
    const snapshots: any[] = [];

    for (const model of models) {
      try {
        const credentials = getAsterCredentials(model.name);
        const modelAsterClient = new AsterClient(credentials.apiKey, credentials.apiSecret);

        // Get real account balance
        const balances = await modelAsterClient.getBalance();
        const usdtBalance = balances.find((b: any) => b.asset === 'USDT');

        if (!usdtBalance) {
          console.error(`  ❌ [${model.name}] No USDT balance found`);
          continue;
        }

        // Get real positions from Aster DEX
        const asterPositions = await modelAsterClient.getPositions();
        const activeAsterPositions = asterPositions.filter((pos: any) =>
          pos.positionAmt && parseFloat(pos.positionAmt) !== 0
        );

        // Calculate total unrealized P&L from real Aster positions for logging only
        const unrealizedPnl = activeAsterPositions.reduce((sum: number, pos: any) => {
          const unrealizedProfit = parseFloat(pos.unRealizedProfit) || 0;
          // Sanity check: If unrealized P&L is suspiciously large (> $50), log it
          if (Math.abs(unrealizedProfit) > 50) {
            console.warn(`  ⚠️  [${model.name}] Large unrealized P&L detected: $${unrealizedProfit.toFixed(2)} for ${pos.symbol}`);
          }
          return sum + unrealizedProfit;
        }, 0);

        // Real-time equity calculation
        // Use the 'balance' field from Aster API which is the total wallet balance
        // This already includes unrealized P&L and is the most reliable field
        const totalBalance = parseFloat(usdtBalance.balance);
        const crossWalletBalance = parseFloat(usdtBalance.crossWalletBalance);
        const availableBalance = parseFloat(usdtBalance.availableBalance);
        const crossUnPnl = parseFloat(usdtBalance.crossUnPnl || '0');

        let realTimeEquity = totalBalance;

        // Data validation: Log if there's a mismatch between different PNL sources
        if (Math.abs(crossUnPnl - unrealizedPnl) > 0.5) {
          console.warn(`  ⚠️  [${model.name}] PNL mismatch: crossUnPnl=$${crossUnPnl.toFixed(2)} vs positionsUnPnl=$${unrealizedPnl.toFixed(2)}`);
        }

        // Data integrity check: balance fields should be consistent
        if (Math.abs(totalBalance - crossWalletBalance) > 0.01) {
          console.warn(`  ⚠️  [${model.name}] Balance field mismatch: totalBalance=$${totalBalance.toFixed(2)} vs crossWallet=$${crossWalletBalance.toFixed(2)}`);
        }
        if (Math.abs(crossWalletBalance - availableBalance) > 10) {
          console.warn(`  ⚠️  [${model.name}] Large margin usage: available=$${availableBalance.toFixed(2)}, total=$${totalBalance.toFixed(2)} (${activeAsterPositions.length} positions)`);
        }

        // Sanity check: Equity should never drop below 0 or exceed reasonable bounds
        const startingCapital = model.starting_capital || 60;
        const minEquity = Math.max(0, startingCapital * 0.1); // Don't drop below 10% of starting capital (was 20%)
        const maxEquity = startingCapital * 2.5; // Don't exceed 2.5x starting capital (was 3x)

        if (realTimeEquity < minEquity) {
          console.warn(`  ⚠️  [${model.name}] Equity too low: $${realTimeEquity.toFixed(2)} (min: $${minEquity.toFixed(2)}), capping at minimum`);
          realTimeEquity = minEquity;
        }

        if (realTimeEquity > maxEquity) {
          console.warn(`  ⚠️  [${model.name}] Equity too high: $${realTimeEquity.toFixed(2)} (max: $${maxEquity.toFixed(2)}), capping at maximum`);
          realTimeEquity = maxEquity;
        }

        // Check for suspicious jumps from previous snapshot
        const { data: lastSnapshot } = await supabase
          .from('performance_snapshots')
          .select('equity, timestamp')
          .eq('model_id', model.id)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (lastSnapshot && lastSnapshot.length > 0) {
          const prevEquity = parseFloat(String(lastSnapshot[0].equity));
          const change = realTimeEquity - prevEquity;
          const changePercent = (change / prevEquity) * 100;

          // Stricter change detection: > 10% or > $5 absolute change (was 25% and $10)
          if (Math.abs(changePercent) > 10 || Math.abs(change) > 5) {
            console.warn(`  ⚠️  [${model.name}] Large equity change detected:`);
            console.warn(`     Previous: $${prevEquity.toFixed(2)} → Current: $${realTimeEquity.toFixed(2)} (${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)`);
            console.warn(`     TotalBalance: $${totalBalance.toFixed(2)}, Available: $${availableBalance.toFixed(2)}, UnrealizedPnL: $${crossUnPnl.toFixed(2)}`);

            // Check if a trade was closed in this period
            const { data: recentTrades } = await supabase
              .from('trades')
              .select('net_pnl, exit_timestamp')
              .eq('model_id', model.id)
              .eq('status', 'closed')
              .gte('exit_timestamp', lastSnapshot[0].timestamp)
              .order('exit_timestamp', { ascending: false });

            if (recentTrades && recentTrades.length > 0) {
              const totalPnl = recentTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl || '0'), 0);
              console.log(`     ✓ ${recentTrades.length} trade(s) closed with total PNL: $${totalPnl.toFixed(2)}`);
            } else {
              console.warn(`     ⚠️  NO TRADES CLOSED - Equity change may be from unrealized PNL fluctuations`);
            }
          }
        }

        // Update model equity in database
        await supabase
          .from('models')
          .update({ current_equity: realTimeEquity })
          .eq('id', model.id);

        // Get closed trades stats
        const { data: closedTrades } = await supabase
          .from('trades')
          .select('net_pnl, fees')
          .eq('model_id', model.id)
          .eq('status', 'closed');

        const realizedPnl = closedTrades?.reduce(
          (sum, t) => sum + (parseFloat(t.net_pnl) || 0),
          0
        ) || 0;

        const totalFees = closedTrades?.reduce(
          (sum, t) => sum + (parseFloat(t.fees) || 0),
          0
        ) || 0;

        const tradeCount = closedTrades?.length || 0;
        const currentEquity = realTimeEquity;

        // Create snapshot
        const { error: snapshotError } = await supabase
          .from('performance_snapshots')
          .insert({
            model_id: model.id,
            equity: currentEquity,
            realized_pnl: realizedPnl,
            unrealized_pnl: unrealizedPnl,
            total_fees: totalFees,
            trade_count: tradeCount,
            timestamp: runTimestamp,
          });

        if (snapshotError) {
          console.error(`  ❌ [${model.name}] Snapshot error:`, snapshotError);
        } else {
          console.log(`  ✅ [${model.name}] Snapshot created: $${currentEquity.toFixed(2)}`);
          snapshots.push({
            modelId: model.id,
            modelName: model.name,
            equity: currentEquity,
          });
        }
      } catch (modelError) {
        console.error(`  ❌ [${model.name}] Error:`, modelError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ [SNAPSHOT-CRON] Completed in ${duration}ms`);
    console.log(`📊 [SNAPSHOT-CRON] Created ${snapshots.length}/${models.length} snapshots`);

    return NextResponse.json({
      success: true,
      timestamp: runTimestamp,
      duration,
      snapshotsCreated: snapshots.length,
      snapshots,
    });
  } catch (error) {
    console.error('❌ [SNAPSHOT-CRON] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/***
 * Vercel Cron Job - Force Sync Positions
 *
 * Runs every 5 minutes to force sync positions from Aster DEX
 * This is a lightweight version of the monitor job that only syncs
 *
 * Cron schedule: every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { AsterClient } from '@/lib/aster/client';
import { getAsterCredentials } from '@/lib/aster/credentials';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';
import { inferAsterPositionSide } from '@/lib/aster/position-utils';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔄 [SYNC] Position sync started at', new Date().toISOString());

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [SYNC] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active models
    const { data: modelsRaw, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('status', 'active');

    const models = (modelsRaw || []).map((model) => applyModelUIOverrides(model));

    if (modelsError || !models || models.length === 0) {
      console.error('❌ [SYNC] Failed to fetch active models:', modelsError?.message);
      throw new Error('Failed to fetch active models');
    }

    console.log(`🤖 [SYNC] Found ${models.length} active models`);

    let totalSynced = 0;

    // Sync positions for each model
    for (const model of models) {
      try {
        const credentials = getAsterCredentials(model.name);
        const modelAsterClient = new AsterClient(credentials.apiKey, credentials.apiSecret);

        // Get real positions from Aster DEX
        const asterPositions = await modelAsterClient.getPositions();
        const activeAsterPositions = asterPositions.filter((pos: any) =>
          pos.positionAmt && parseFloat(pos.positionAmt) !== 0
        );

        console.log(`📊 [SYNC] ${model.name}: ${activeAsterPositions.length} active positions on Aster DEX`);

        // Update our database positions to match reality
        for (const asterPos of activeAsterPositions) {
          const symbol = asterPos.symbol;
          const side = inferAsterPositionSide(asterPos);
          const amt = parseFloat(asterPos.positionAmt);
          const entryPrice = parseFloat(asterPos.entryPrice);
          const quantity = Math.abs(Number.isFinite(amt) ? amt : 0);
          const leverage = parseFloat(asterPos.leverage);
          const markPrice = parseFloat(asterPos.markPrice);
          const unrealizedPnl = parseFloat(asterPos.unRealizedProfit);

          // Find matching position in our database
          const { data: existingDbPos } = await supabase
            .from('positions')
            .select('*')
            .eq('model_id', model.id)
            .eq('symbol', symbol)
            .limit(1);

          if (existingDbPos && existingDbPos.length > 0) {
            // Update existing position
            await supabase
              .from('positions')
              .update({
                side: side,
                entry_price: entryPrice,
                current_price: markPrice,
                quantity: quantity,
                leverage: leverage,
                notional_value: quantity * entryPrice,
                unrealized_pnl: unrealizedPnl,
                last_updated: new Date().toISOString(),
              })
              .eq('id', existingDbPos[0].id);

            console.log(`   ✅ Updated ${symbol} ${side}: $${entryPrice} × ${quantity}`);
          } else {
            // Look for existing trade record
            const tradeQuery = await supabase
              .from('trades')
              .select('id')
              .eq('model_id', model.id)
              .eq('symbol', symbol)
              .eq('status', 'open')
              .limit(1);

            let tradeData = tradeQuery.data;

            if (!tradeData || tradeData.length === 0) {
              // No trade found, create one from Aster position data
              console.log(`   📝 No trade record found, creating from Aster position data...`);
              const { data: newTrade, error: tradeInsertError } = await supabase
                .from('trades')
                .insert({
                  model_id: model.id,
                  symbol: symbol,
                  side: side,
                  entry_price: entryPrice,
                  quantity: quantity,
                  leverage: leverage,
                  notional_value: quantity * entryPrice,
                  entry_time: new Date().toISOString(), // Use current time as approximation
                  status: 'open',
                  fees: 0, // Will be calculated on close
                })
                .select('id')
                .single();

              if (tradeInsertError) {
                console.error(`   ❌ Failed to create trade record:`, tradeInsertError);
                continue;
              }

              tradeData = [newTrade];
              console.log(`   🆕 Created trade record: ${newTrade.id}`);
            }

            if (tradeData && tradeData.length > 0) {
              await supabase.from('positions').insert({
                model_id: model.id,
                trade_id: tradeData[0].id,
                symbol: symbol,
                side: side,
                entry_price: entryPrice,
                current_price: markPrice,
                quantity: quantity,
                leverage: leverage,
                notional_value: quantity * entryPrice,
                unrealized_pnl: unrealizedPnl,
              });

              console.log(`   🆕 Created position ${symbol} ${side}: $${entryPrice} × ${quantity}`);
            } else {
              console.log(`   ⚠️ ${symbol} ${side} failed to create trade/position records`);
            }
          }

          totalSynced++;
        }

        // Update model equity based on real account balance
        const balances = await modelAsterClient.getBalance();
        const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
        const availableCash = usdtBalance ? parseFloat(usdtBalance.availableBalance) : 0;
        const totalPositionPnl = activeAsterPositions.reduce((sum: number, pos: any) =>
          sum + (parseFloat(pos.unRealizedProfit) || 0), 0
        );
        const realEquity = availableCash + totalPositionPnl;

        await supabase
          .from('models')
          .update({ current_equity: realEquity })
          .eq('id', model.id);

        console.log(`   💰 ${model.name} equity: $${realEquity.toFixed(2)}`);

      } catch (error) {
        console.error(`❌ [SYNC] Error syncing ${model.name}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [SYNC] Sync complete in ${duration}ms - ${totalSynced} positions synced`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      positionsSynced: totalSynced,
    });

  } catch (error) {
    console.error('❌ [SYNC] Fatal error:', error);
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

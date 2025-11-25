/**
 * Vercel Cron Job - Monitor Open Positions
 * 
 * This runs every 5 minutes to:
 * - Update current prices for all open positions
 * - Recalculate unrealized P&L
 * - Auto-close positions that hit take profit or stop loss
 * 
 * Runs every 5 minutes (cron: 0/5 * * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { AsterClient } from '@/lib/aster/client';
import { roundQuantity } from '@/lib/aster/precision';
import { getAsterCredentials } from '@/lib/aster/credentials';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';
import { inferAsterPositionSide } from '@/lib/aster/position-utils';

// Risk management defaults - used when models do not specify
const DEFAULT_TAKE_PROFIT_PERCENT = 0.05;
const DEFAULT_STOP_LOSS_PERCENT = 0.03;
const DEFAULT_MAX_HOLD_MINUTES = 24 * 60;

const MIN_TAKE_PROFIT_PERCENT = 0.01;
const MAX_TAKE_PROFIT_PERCENT = 0.2;
const MIN_STOP_LOSS_PERCENT = 0.005;
const MAX_STOP_LOSS_PERCENT = 0.12;
const MIN_HOLD_MINUTES = 30;
const MAX_HOLD_MINUTES = 48 * 60;

// Feature flags and optional overrides via environment
const MODEL_DRIVEN_EXITS = process.env.MODEL_DRIVEN_EXITS === 'true';
const EMERGENCY_STOP_PCT = process.env.EMERGENCY_STOP_PCT ? Math.abs(parseFloat(process.env.EMERGENCY_STOP_PCT)) : undefined; // e.g., 0.20 for -20%
const ENV_DEFAULT_TP = process.env.DEFAULT_TP_PCT ? Math.abs(parseFloat(process.env.DEFAULT_TP_PCT)) : undefined;
const ENV_DEFAULT_SL = process.env.DEFAULT_SL_PCT ? Math.abs(parseFloat(process.env.DEFAULT_SL_PCT)) : undefined;
const ENV_DEFAULT_MAX_HOLD = process.env.DEFAULT_MAX_HOLD ? Math.abs(parseInt(process.env.DEFAULT_MAX_HOLD, 10)) : undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizePercent(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  const normalized = value > 1 ? value / 100 : value;
  return clamp(Math.abs(normalized), min, max);
}

function normalizeOptionalPercent(value: number | null | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  const normalized = value > 1 ? value / 100 : value;
  return clamp(Math.abs(normalized), min, max);
}

function normalizeHoldMinutes(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_HOLD_MINUTES;
  }

  return clamp(Math.round(value), MIN_HOLD_MINUTES, MAX_HOLD_MINUTES);
}

function resolvePositionSide(position: {
  side?: string | null;
  trades?: { side?: string | null } | null;
}): 'LONG' | 'SHORT' {
  const tradeSide = position.trades?.side?.toUpperCase();
  if (tradeSide === 'LONG' || tradeSide === 'SHORT') {
    return tradeSide;
  }

  const stored = position.side?.toUpperCase();
  return stored === 'SHORT' ? 'SHORT' : 'LONG';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('👁️ [MONITOR] Position monitoring started at', new Date().toISOString());

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [MONITOR] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize shared Aster client for public market data
    const sharedAsterClient = new AsterClient('', '');

    // Get all active models first (needed for syncing positions)
    const { data: modelsRaw, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('status', 'active');

    const models = (modelsRaw || []).map((model) => applyModelUIOverrides(model));

    if (modelsError || !models || models.length === 0) {
      console.error('❌ [MONITOR] Failed to fetch active models:', modelsError?.message);
      throw new Error('Failed to fetch active models');
    }

    console.log(`🤖 [MONITOR] Found ${models.length} active models`);

    // Get all open positions
    let { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select(`
        *,
        models (
          id,
          name,
          current_equity,
          api_model
        ),
        trades (
          side
        )
      `);

    if (positionsError || !positions || positions.length === 0) {
      console.log('✅ [MONITOR] No open positions to monitor');
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        positionsMonitored: 0,
        positionsClosed: 0,
      });
    }

    console.log(`📊 [MONITOR] Monitoring ${positions.length} open positions`);

    // Get current market prices
    const marketPrices = await sharedAsterClient.getPrice();

    let positionsUpdated = 0;
    let positionsClosed = 0;

    // FIRST: Sync real positions from Aster DEX for each model
    console.log('🔄 Syncing real positions from Aster DEX...');

    for (const model of models) {
      try {
        const credentials = getAsterCredentials(model.name);
        const modelAsterClient = new AsterClient(credentials.apiKey, credentials.apiSecret);

        // Get real positions from Aster DEX
        const asterPositions = await modelAsterClient.getPositions();
        const activeAsterPositions = asterPositions.filter((pos: any) =>
          pos.positionAmt && parseFloat(pos.positionAmt) !== 0
        );

        console.log(`📊 ${model.name}: ${activeAsterPositions.length} active positions on Aster DEX`);

        // Update our database positions to match reality
        for (const asterPos of activeAsterPositions) {
          const symbol = asterPos.symbol;
          // Side mapping for One-Way mode: Aster returns positionSide 'BOTH'.
          // Use the sign of positionAmt to infer side when not explicitly LONG/SHORT.
          const amt = parseFloat(asterPos.positionAmt);
          const side = inferAsterPositionSide(asterPos);
          const entryPrice = parseFloat(asterPos.entryPrice);
          const quantity = Math.abs(Number.isFinite(amt) ? amt : 0);
          const leverage = parseFloat(asterPos.leverage);
          const markPrice = parseFloat(asterPos.markPrice);
          const unrealizedPnl = parseFloat(asterPos.unRealizedProfit);

          // Find matching position in our database
          const existingDbPos = positions.find((dbPos: any) =>
            dbPos.model_id === model.id &&
            dbPos.symbol === symbol &&
            (dbPos.side === side || true) // Match symbol regardless of side (since we had mismatches)
          );

          if (existingDbPos) {
            // Update existing position with real Aster data
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
              .eq('id', existingDbPos.id);

            console.log(`   ✅ Updated ${symbol} ${side}: $${entryPrice} × ${quantity} @ ${leverage}x`);
          } else {
            console.log(`   ⚠️ ${symbol} ${side} exists on Aster DEX but not in database`);
          }
        }

        // Update model equity based on real account balance
        const balances = await modelAsterClient.getBalance();
        const usdtBalance = balances.find((b: any) => b.asset === 'USDT');

        const parseNumber = (value: any) => {
          if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
          }
          if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
          }
          return 0;
        };

        const availableCash = usdtBalance ? parseNumber(usdtBalance.availableBalance) : 0;
        const walletBalance = usdtBalance ? parseNumber(usdtBalance.balance) : 0;
        const crossWalletBalance = usdtBalance ? parseNumber(usdtBalance.crossWalletBalance) : 0;
        const crossUnrealized = usdtBalance ? parseNumber(usdtBalance.crossUnPnl) : 0;
        const priorRecordedEquity = Number.parseFloat(String(model.current_equity ?? '0'));

        // IMPORTANT: Aster's crossWalletBalance and wallet balance fields ALREADY include unrealized P&L
        // Do NOT add crossUnPnl on top of them - that would double-count unrealized P&L
        // Only use crossUnPnl if we have no wallet balance data

        let realEquity: number | null = null;

        // Priority 1: Use crossWalletBalance (includes unrealized P&L already)
        if (Number.isFinite(crossWalletBalance) && Math.abs(crossWalletBalance) > 0.0001) {
          realEquity = crossWalletBalance;
        }
        // Priority 2: Use walletBalance (includes unrealized P&L already)
        else if (Number.isFinite(walletBalance) && Math.abs(walletBalance) > 0.0001) {
          realEquity = walletBalance;
        }
        // Priority 3: Use available cash + unrealized (if no wallet balance)
        else if (Number.isFinite(availableCash) && Math.abs(availableCash) > 0.0001) {
          realEquity = availableCash + crossUnrealized;
        }
        // Priority 4: Keep prior equity (stable)
        else if (Number.isFinite(priorRecordedEquity)) {
          realEquity = priorRecordedEquity;
        }
        // Priority 5: Fallback to unrealized only
        else {
          realEquity = crossUnrealized;
        }

        // Guard against NaN/Infinity and force 2 decimal precision
        if (!Number.isFinite(realEquity)) {
          realEquity = Number.isFinite(priorRecordedEquity) ? priorRecordedEquity : 0;
        }

        const normalizedEquity = Math.round(realEquity * 100) / 100;

        await supabase
          .from('models')
          .update({ current_equity: normalizedEquity })
          .eq('id', model.id);

        // Log which source was used for equity calculation
        let equitySource = 'unknown';
        if (Number.isFinite(crossWalletBalance) && Math.abs(crossWalletBalance) > 0.0001) {
          equitySource = 'crossWalletBalance';
        } else if (Number.isFinite(walletBalance) && Math.abs(walletBalance) > 0.0001) {
          equitySource = 'walletBalance';
        } else if (Number.isFinite(availableCash) && Math.abs(availableCash) > 0.0001) {
          equitySource = `availableCash ($${availableCash.toFixed(2)}) + unrealized ($${crossUnrealized.toFixed(2)})`;
        } else {
          equitySource = 'prior equity (no change)';
        }

        console.log(
          `   💰 ${model.name} equity: $${normalizedEquity.toFixed(2)} [source: ${equitySource}]`,
        );

      } catch (error) {
        console.error(`❌ Error syncing ${model.name}:`, error);
      }
    }

    console.log('✅ Position sync complete\n');

    // Re-fetch positions after sync
    const { data: updatedPositions } = await supabase
      .from('positions')
      .select(`
        *,
        models (
          id,
          name,
          api_model
        ),
        trades (
          side
        )
      `)
      .order('created_at', { ascending: false });

    positions = updatedPositions || [];

    // Process each position for monitoring
    for (const position of positions) {
      try {
        const priceData = marketPrices.find((p: any) => p.symbol === position.symbol);
        if (!priceData) {
          console.warn(`⚠️ [MONITOR] No price data for ${position.symbol}`);
          continue;
        }

        const currentPrice = parseFloat(priceData.price);
        const entryPrice = parseFloat(position.entry_price);
        const quantityParsed = parseFloat(position.quantity);
        const quantity = Number.isFinite(quantityParsed) ? Math.abs(quantityParsed) : 0;
        const effectiveSide = resolvePositionSide(position);

        // Calculate unrealized P&L
        let unrealizedPnl = 0;
        let priceChangePercent = 0;

        if (effectiveSide === 'LONG') {
          unrealizedPnl = (currentPrice - entryPrice) * quantity;
          priceChangePercent = (currentPrice - entryPrice) / entryPrice;
        } else {
          unrealizedPnl = (entryPrice - currentPrice) * quantity;
          priceChangePercent = (entryPrice - currentPrice) / entryPrice;
        }

        // Update position with current price and P&L
        await supabase
          .from('positions')
          .update({
            current_price: currentPrice,
            unrealized_pnl: unrealizedPnl,
            last_updated: new Date().toISOString(),
          })
          .eq('id', position.id);

        positionsUpdated++;

        const rawTakeProfit = position.take_profit_percent !== null && position.take_profit_percent !== undefined
          ? Number(position.take_profit_percent)
          : undefined;
        const rawStopLoss = position.stop_loss_percent !== null && position.stop_loss_percent !== undefined
          ? Number(position.stop_loss_percent)
          : undefined;
        const rawMaxHold = position.max_hold_minutes !== null && position.max_hold_minutes !== undefined
          ? Number(position.max_hold_minutes)
          : undefined;

        // Model-driven exits: only enforce TP/SL/Hold if present; otherwise use defaults only when feature flag is OFF
        const takeProfitPercent = typeof rawTakeProfit === 'number'
          ? normalizeOptionalPercent(rawTakeProfit, MIN_TAKE_PROFIT_PERCENT, MAX_TAKE_PROFIT_PERCENT)
          : (MODEL_DRIVEN_EXITS ? undefined : normalizePercent(ENV_DEFAULT_TP ?? DEFAULT_TAKE_PROFIT_PERCENT, MIN_TAKE_PROFIT_PERCENT, MAX_TAKE_PROFIT_PERCENT, ENV_DEFAULT_TP ?? DEFAULT_TAKE_PROFIT_PERCENT));

        const stopLossPercent = typeof rawStopLoss === 'number'
          ? normalizeOptionalPercent(rawStopLoss, MIN_STOP_LOSS_PERCENT, MAX_STOP_LOSS_PERCENT)
          : (MODEL_DRIVEN_EXITS ? undefined : normalizePercent(ENV_DEFAULT_SL ?? DEFAULT_STOP_LOSS_PERCENT, MIN_STOP_LOSS_PERCENT, MAX_STOP_LOSS_PERCENT, ENV_DEFAULT_SL ?? DEFAULT_STOP_LOSS_PERCENT));

        const maxHoldMinutes = typeof rawMaxHold === 'number'
          ? clamp(Math.round(rawMaxHold), MIN_HOLD_MINUTES, MAX_HOLD_MINUTES)
          : (MODEL_DRIVEN_EXITS ? undefined : clamp(ENV_DEFAULT_MAX_HOLD ?? DEFAULT_MAX_HOLD_MINUTES, MIN_HOLD_MINUTES, MAX_HOLD_MINUTES));

        const maxHoldTimeMs = typeof maxHoldMinutes === 'number' ? maxHoldMinutes * 60 * 1000 : undefined;

        // Check if position should be auto-closed
        // NEVER close BTC HODL benchmark - it's a permanent position
        const isBTCHodl = position.models.api_model === 'btc-hodl';
        const emergencyStopHit = typeof EMERGENCY_STOP_PCT === 'number' && priceChangePercent <= -Math.abs(EMERGENCY_STOP_PCT);
        const shouldClose = !isBTCHodl && (
          (typeof takeProfitPercent === 'number' && priceChangePercent >= takeProfitPercent) || // Take profit hit
          (typeof stopLossPercent === 'number' && priceChangePercent <= -stopLossPercent) || // Stop loss hit
          (typeof maxHoldTimeMs === 'number' && (Date.now() - new Date(position.created_at).getTime()) > maxHoldTimeMs) || // Max hold time
          emergencyStopHit // Global emergency stop (if configured)
        );

        if (shouldClose) {
          const reason =
            (typeof takeProfitPercent === 'number' && priceChangePercent >= takeProfitPercent) ? 'TAKE_PROFIT' :
            (typeof stopLossPercent === 'number' && priceChangePercent <= -stopLossPercent) ? 'STOP_LOSS' :
            (typeof maxHoldTimeMs === 'number' && (Date.now() - new Date(position.created_at).getTime()) > maxHoldTimeMs) ? 'MAX_HOLD_TIME' :
            'EMERGENCY_STOP';

          const tpText = typeof takeProfitPercent === 'number' ? `${(takeProfitPercent * 100).toFixed(1)}%` : '—';
          const slText = typeof stopLossPercent === 'number' ? `${(stopLossPercent * 100).toFixed(1)}%` : '—';
          const holdText = typeof maxHoldMinutes === 'number' ? `${maxHoldMinutes}m` : '—';
          console.log(`🎯 [MONITOR] Auto-closing ${position.models.name} ${effectiveSide} ${position.symbol} - Reason: ${reason} (Δ ${(priceChangePercent * 100).toFixed(2)}% | TP ${tpText} | SL ${slText} | Hold ${holdText})`);

          // Get model's Aster credentials
          const credentials = getAsterCredentials(position.models.name);
          const modelAsterClient = new AsterClient(credentials.apiKey, credentials.apiSecret);

          // Calculate holding time
          const entryTime = new Date(position.created_at);
          const exitTime = new Date();
          const holdingTimeMs = exitTime.getTime() - entryTime.getTime();

          // Place closing order on Aster
          let actualExitPrice = currentPrice;
          try {
            const closingSide = effectiveSide === 'LONG' ? 'SELL' : 'BUY';
            const roundedQty = roundQuantity(position.symbol, Math.abs(quantity));

            console.log(`   Placing ${closingSide} order to close: ${roundedQty} ${position.symbol}...`);

            const closeOrderResponse = await modelAsterClient.placeOrder({
              symbol: position.symbol,
              side: closingSide,
              type: 'MARKET',
              quantity: roundedQty,
              reduceOnly: true, // Important: this closes the position only
            });

            const closeExecutedQty = parseFloat(closeOrderResponse.executedQty || '0');
            const closeAvgPrice = parseFloat(closeOrderResponse.avgPrice || '0');
            const closePriceField = parseFloat(closeOrderResponse.price || '0');
            const closeCumQuote = parseFloat(closeOrderResponse.cumQuote || '0');

            if (Number.isFinite(closeAvgPrice) && closeAvgPrice > 0) {
              actualExitPrice = closeAvgPrice;
            } else if (Number.isFinite(closePriceField) && closePriceField > 0) {
              actualExitPrice = closePriceField;
            } else if (Number.isFinite(closeCumQuote) && closeCumQuote > 0 && closeExecutedQty > 0) {
              actualExitPrice = closeCumQuote / closeExecutedQty;
            } else {
              actualExitPrice = currentPrice;
            }

            console.log('   ↳ Auto-close fill details', {
              executedQty: closeOrderResponse.executedQty,
              avgPrice: closeOrderResponse.avgPrice,
              cumQuote: closeOrderResponse.cumQuote,
              resolvedExitPrice: actualExitPrice,
            });
            console.log(`   ✅ Position closed! Exit price: $${actualExitPrice.toFixed(2)}`);
          } catch (asterError) {
            console.error(`   ⚠️ Failed to close position on Aster:`, asterError);
            // Continue with estimated exit price if API fails
            console.log(`   Using market price for P&L calculation`);
          }

          // Recalculate P&L with actual exit price
          const netPnl =
            effectiveSide === 'LONG'
              ? (actualExitPrice - entryPrice) * quantity
              : (entryPrice - actualExitPrice) * quantity;

          // Update trade record
          const { error: tradeUpdateError } = await supabase
            .from('trades')
            .update({
              exit_price: actualExitPrice,
              exit_time: exitTime.toISOString(),
              holding_time_ms: holdingTimeMs,
              net_pnl: netPnl,
              status: 'closed',
            })
            .eq('id', position.trade_id);

          if (tradeUpdateError) {
            console.error(`❌ [MONITOR] Failed to update trade:`, tradeUpdateError);
            continue;
          }

          // Remove from positions table
          await supabase
            .from('positions')
            .delete()
            .eq('id', position.id);

          // Update model equity
          const newEquity = parseFloat(position.models.current_equity) + netPnl;
          await supabase
            .from('models')
            .update({ current_equity: newEquity })
            .eq('id', position.models.id);

          positionsClosed++;
          console.log(`✅ [MONITOR] Position closed: ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)} P&L`);
        }

      } catch (posError) {
        console.error(`❌ [MONITOR] Error processing position ${position.id}:`, posError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [MONITOR] Completed in ${duration}ms - Updated: ${positionsUpdated}, Closed: ${positionsClosed}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      positionsMonitored: positions.length,
      positionsUpdated,
      positionsClosed,
    });

  } catch (error) {
    console.error('❌ [MONITOR] Fatal error:', error);
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

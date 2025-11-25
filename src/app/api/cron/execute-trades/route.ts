/**
 * Vercel Cron Job - Execute AI Trading Decisions
 * 
 * This endpoint is triggered automatically by Vercel Cron
 * on a schedule defined in vercel.json
 * 
 * Security: Verifies cron secret to prevent unauthorized access
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { AsterClient } from '@/lib/aster/client';
import { createTradingAgent, Portfolio, MarketData } from '@/lib/trading/agent';
import { buildMarketSnapshot } from '@/lib/market/snapshot';
import { roundQuantity } from '@/lib/aster/precision';
import { getAsterCredentials } from '@/lib/aster/credentials';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

// Safety limits - Post-launch aggressive tuning
const MAX_POSITION_SIZE_PERCENT = 0.35; // 35% of equity per trade
const MAX_OPEN_POSITIONS = 3; // Max 3 positions per model
const MIN_POSITION_SIZE_USD = 10; // Minimum $10 per trade
const MAX_LEVERAGE = 10; // Max 10x leverage
const DEFAULT_TAKE_PROFIT_PERCENT = 0.05; // 5% fallback take profit
const DEFAULT_STOP_LOSS_PERCENT = 0.03; // 3% fallback stop loss
const MIN_TAKE_PROFIT_PERCENT = 0.01; // Minimum +1%
const MAX_TAKE_PROFIT_PERCENT = 0.2;  // Maximum +20%
const MIN_STOP_LOSS_PERCENT = 0.005;  // Minimum -0.5%
const MAX_STOP_LOSS_PERCENT = 0.12;   // Maximum -12%
const DEFAULT_MAX_HOLD_MINUTES = 24 * 60; // 24 hours fallback
const MIN_HOLD_MINUTES = 30;
const MAX_HOLD_MINUTES = 48 * 60; // 48 hours cap

// Feature flags and optional overrides via environment
const MODEL_DRIVEN_EXITS = process.env.MODEL_DRIVEN_EXITS === 'true';
const EMERGENCY_STOP_PCT = process.env.EMERGENCY_STOP_PCT ? Math.abs(parseFloat(process.env.EMERGENCY_STOP_PCT)) : undefined; // e.g., 0.20 for -20%
const ENV_DEFAULT_TP = process.env.DEFAULT_TP_PCT ? Math.abs(parseFloat(process.env.DEFAULT_TP_PCT)) : undefined;
const ENV_DEFAULT_SL = process.env.DEFAULT_SL_PCT ? Math.abs(parseFloat(process.env.DEFAULT_SL_PCT)) : undefined;
const ENV_DEFAULT_MAX_HOLD = process.env.DEFAULT_MAX_HOLD ? Math.abs(parseInt(process.env.DEFAULT_MAX_HOLD, 10)) : undefined;
interface TradingResult {
  modelId: string;
  modelName: string;
  action: string;
  success: boolean;
  error?: string;
  tradeId?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizePercent(
  value: number | undefined,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return defaultValue;
  }

  // Accept values expressed as percentages (e.g., 8 for 8%) or decimals (0.08)
  const normalized = value > 1 ? value / 100 : value;
  return clamp(normalized, min, max);
}

function normalizeHoldMinutes(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_HOLD_MINUTES;
  }

  return clamp(Math.round(value), MIN_HOLD_MINUTES, MAX_HOLD_MINUTES);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('🤖 [CRON] Trading bot execution started at', new Date().toISOString());

  try {
    // CHECK 29-DAY TRADING CUTOFF (EXTENDED FROM 15 DAYS)
    const TRADING_START_DATE = new Date('2025-10-23T20:15:00Z'); // Oct 23, 2025 8:15 PM UTC
    const TRADING_END_DATE = new Date('2025-11-21T20:15:00Z');   // Nov 21, 2025 8:15 PM UTC (29 days total)
    const now = new Date();

    if (now > TRADING_END_DATE) {
      console.log('⛔ [CRON] Trading competition ended on', TRADING_END_DATE.toISOString());
      console.log('📊 [CRON] 29-day competition complete! No new trades will be placed.');
      console.log('🏆 [CRON] Check the leaderboard for final results!');
      return NextResponse.json({
        success: true,
        message: 'Trading competition has ended after 29 days',
        tradingStartDate: TRADING_START_DATE.toISOString(),
        tradingEndDate: TRADING_END_DATE.toISOString(),
        competitionDuration: '29 days',
        timestamp: now.toISOString(),
      });
    }

    const daysElapsed = Math.floor((now.getTime() - TRADING_START_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = Math.ceil((TRADING_END_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((TRADING_END_DATE.getTime() - now.getTime()) / (1000 * 60 * 60));

    console.log('📅 [CRON] Trading Competition - Day', daysElapsed, 'of 29');
    if (hoursRemaining < 24) {
      console.log(`⏰ [CRON] FINAL DAY! ${hoursRemaining} hours remaining`);
    } else {
      console.log(`⏳ [CRON] ${daysRemaining} days remaining (ends ${TRADING_END_DATE.toLocaleString()})`);
    }

    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [CRON] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for OpenRouter API key (shared across models)
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error('Missing OpenRouter API key');
    }

    // Initialize a shared Aster client for public market data (no auth needed)
    const sharedAsterClient = new AsterClient('', '');

    // Debug: Check if service role key is available
    console.log('🔑 [CRON] Service role key available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch active models from database
    const { data: modelsRaw, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('status', 'active');

    if (modelsError) {
      console.error('❌ [CRON] Database error:', modelsError.message, modelsError.code);
      throw new Error(`Database error: ${modelsError.message}`);
    }
    
    const models = (modelsRaw || []).map((model) => applyModelUIOverrides(model));

    if (!models || models.length === 0) {
      console.error('❌ [CRON] No active models found in database');
      // Try to fetch ALL models to debug
      const { data: allModels } = await supabase
        .from('models')
        .select('name, status');
      console.log('📋 [CRON] All models in database:', allModels);
      throw new Error('No active models found');
    }

    console.log(`📊 [CRON] Found ${models.length} active models`);

    // Get market data from Aster (public endpoint, no auth needed)
    let marketTickers;
    try {
      marketTickers = await sharedAsterClient.get24hrTicker();
    } catch (error) {
      console.error('❌ [CRON] Failed to fetch market tickers:', error);
      throw new Error('Market data fetch failed');
    }

    // Fallback prices in case API fails
    const FALLBACK_PRICES: Record<string, number> = {
      'BTCUSDT': 110000,
      'ETHUSDT': 3800,
      'SOLUSDT': 180,
      'BNBUSDT': 1100,
      'DOGEUSDT': 0.18,
      'SUIUSDT': 1.80,
    };

    const marketData: MarketData[] = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'SUIUSDT'
    ].map(symbol => {
      const ticker = Array.isArray(marketTickers)
        ? marketTickers.find((t: any) => t.symbol === symbol)
        : (marketTickers?.symbol === symbol ? marketTickers : null);
      let price = ticker ? parseFloat(ticker.lastPrice ?? ticker.price ?? '0') : 0;

      // Use fallback if price is 0 or invalid
      if (!price || price <= 0) {
        price = FALLBACK_PRICES[symbol] || 1;
        console.warn(`⚠️ [CRON] Using fallback price for ${symbol}: $${price}`);
      }

      return {
        symbol,
        price,
        change24h: ticker ? parseFloat(ticker.priceChangePercent ?? '0') : 0,
        volume24h: ticker ? parseFloat(ticker.volume ?? ticker.quoteVolume ?? '0') : 0,
      };
    });

    console.log('💹 [CRON] Market data fetched:', marketData.map(m => `${m.symbol}: $${m.price.toFixed(2)} (${m.change24h.toFixed(2)}%)`).join(', '));

    const zeroSignalAssets = marketData.filter(m => !Number.isFinite(m.change24h) || Math.abs(m.change24h) < 0.0001);
    if (zeroSignalAssets.length) {
      console.warn('⚠️  [CRON] Zero 24h change detected for:', zeroSignalAssets.map(a => a.symbol).join(', ') || 'n/a');
    }
    if (!marketData.length || marketData.every(m => m.price === 0)) {
      console.error('❌ [CRON] Market ticker data missing prices. Upstream API may be down.');
      throw new Error('All market prices are zero - cannot proceed with trading');
    }

    // Execute trading for each model
    const results: TradingResult[] = [];

    for (const model of models) {
      try {
        console.log(`\n🤖 [${model.name}] Processing...`);

        // Get model-specific Aster credentials and create client
        const credentials = getAsterCredentials(model.name);
        const modelAsterClient = new AsterClient(credentials.apiKey, credentials.apiSecret);

        const fetchAvailableCash = async () => {
          const balances = await modelAsterClient.getBalance();
          const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
          return usdtBalance ? parseFloat(usdtBalance.availableBalance) : 0;
        };

        let availableCash = await fetchAvailableCash();
        let modelEquity = parseFloat(model.current_equity);

        console.log(`💰 [${model.name}] Available balance: ${availableCash.toFixed(2)} USDT`);

        // Get model's current positions from database
        const { data: positions } = await supabase
          .from('positions')
          .select('*')
          .eq('model_id', model.id);

        let openPositions = (positions || []).map((p) => ({ ...p }));

        // Calculate model's portfolio
        const totalUnrealizedPnl = openPositions.reduce((sum, p) => sum + (parseFloat(p.unrealized_pnl) || 0), 0);
        const equity = modelEquity + totalUnrealizedPnl;
        const totalPnl = equity - parseFloat(model.starting_capital);
        const pnlPercentage = (totalPnl / parseFloat(model.starting_capital)) * 100;

        const portfolio: Portfolio = {
          equity,
          availableCash,
          totalPnl,
          pnlPercentage,
          positions: openPositions.map(p => ({
            symbol: p.symbol,
            side: p.side,
            entryPrice: parseFloat(p.entry_price),
            quantity: parseFloat(p.quantity),
            leverage: p.leverage,
            unrealizedPnl: parseFloat(p.unrealized_pnl) || 0,
            takeProfitPercent: p.take_profit_percent !== null && p.take_profit_percent !== undefined ? parseFloat(p.take_profit_percent) : undefined,
            stopLossPercent: p.stop_loss_percent !== null && p.stop_loss_percent !== undefined ? parseFloat(p.stop_loss_percent) : undefined,
            maxHoldMinutes: p.max_hold_minutes !== null && p.max_hold_minutes !== undefined ? parseInt(p.max_hold_minutes, 10) : undefined,
          })),
        };

        console.log(`💼 [${model.name}] Portfolio: $${equity.toFixed(2)} equity, ${openPositions.length} positions`);

        // Build rich market snapshot before invoking model (feeds context + stored later)
        const snapshot = await buildMarketSnapshot(sharedAsterClient, model.id);

        // Create trading agent and get decision with additional context memory
        const agent = createTradingAgent(openrouterApiKey, model.name);
        const decision = await agent.analyzeAndDecide(portfolio, marketData, {
          recentDecisions: snapshot.recent_decisions ?? [],
          indicatorHighlights: snapshot.indicator_highlights ?? [],
          marketRegime: snapshot.market_regime ?? null,
        });

        console.log(`🧠 [${model.name}] Decision: ${decision.action} (confidence: ${decision.confidence}%)`);
        console.log(`📝 [${model.name}] Reasoning: ${decision.reasoning.substring(0, 100)}...`);

        const closePosition = async (positionToClose: any, reason: string) => {
          if (!positionToClose) {
            throw new Error('No position found to close');
          }

          console.log(`📉 [${model.name}] Closing ${positionToClose.side} ${positionToClose.symbol} (${reason})`);

          const symbol = positionToClose.symbol;
          const entryTime = new Date(positionToClose.created_at);
          const exitTime = new Date();
          const holdingTimeMs = exitTime.getTime() - entryTime.getTime();

          const marketEntry = marketData.find(m => m.symbol === symbol);
          const marketPrice = marketEntry?.price || FALLBACK_PRICES[symbol] || 1;
          if (marketPrice <= 0) {
            throw new Error(`No valid price data for ${symbol}`);
          }

          let actualExitPrice = marketPrice;
          let netPnl = 0;

          try {
            const closingSide = positionToClose.side === 'LONG' ? 'SELL' : 'BUY';
            const roundedQty = roundQuantity(symbol, Math.abs(parseFloat(positionToClose.quantity)));

            console.log(`   Placing ${closingSide} order to close: ${roundedQty} ${symbol}...`);
            const closeOrderResponse = await modelAsterClient.placeOrder({
              symbol,
              side: closingSide,
              type: 'MARKET',
              quantity: roundedQty,
              reduceOnly: true,
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
            }

            console.log('   ↳ Close fill details', {
              executedQty: closeOrderResponse.executedQty,
              avgPrice: closeOrderResponse.avgPrice,
              cumQuote: closeOrderResponse.cumQuote,
              resolvedExitPrice: actualExitPrice,
            });
            console.log(`   ✅ Position closed! Exit price: $${actualExitPrice.toFixed(4)}`);
          } catch (asterError) {
            console.error(`   ⚠️ Failed to close position on Aster:`, asterError);
            console.log(`   Using market price for P&L calculation: $${marketPrice.toFixed(4)}`);
            actualExitPrice = marketPrice;
          }

          const entryPrice = parseFloat(positionToClose.entry_price);
          const quantity = Math.abs(parseFloat(positionToClose.quantity));

          if (positionToClose.side === 'LONG') {
            netPnl = (actualExitPrice - entryPrice) * quantity;
          } else {
            netPnl = (entryPrice - actualExitPrice) * quantity;
          }

          const { error: tradeUpdateError } = await supabase
            .from('trades')
            .update({
              exit_price: actualExitPrice,
              exit_time: exitTime.toISOString(),
              holding_time_ms: holdingTimeMs,
              net_pnl: netPnl,
              status: 'closed',
            })
            .eq('id', positionToClose.trade_id);

          if (tradeUpdateError) {
            throw tradeUpdateError;
          }

          await supabase
            .from('positions')
            .delete()
            .eq('id', positionToClose.id);

          modelEquity += netPnl;
          await supabase
            .from('models')
            .update({ current_equity: modelEquity })
            .eq('id', model.id);

          openPositions = openPositions.filter(p => p.id !== positionToClose.id);
          availableCash = await fetchAvailableCash();

          console.log(`✅ [${model.name}] Position closed: ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)} P&L`);

          return {
            netPnl,
            actualExitPrice,
            holdingTimeMs,
          };
        };

        // Build readable decision string
        let decisionText: string = decision.action;
        if (decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') {
          const side = decision.action === 'OPEN_LONG' ? 'LONG' : 'SHORT';
          // Model-driven exits: only apply defaults if flag is OFF. Env overrides take precedence when provided.
          const tpProvided = typeof decision.takeProfitPercent === 'number';
          const slProvided = typeof decision.stopLossPercent === 'number';
          const holdProvided = typeof decision.maxHoldMinutes === 'number';

          const fallbackTp = ENV_DEFAULT_TP ?? DEFAULT_TAKE_PROFIT_PERCENT;
          const fallbackSl = ENV_DEFAULT_SL ?? DEFAULT_STOP_LOSS_PERCENT;
          const fallbackHold = ENV_DEFAULT_MAX_HOLD ?? DEFAULT_MAX_HOLD_MINUTES;

          const takeProfitPercent = tpProvided
            ? normalizePercent(decision.takeProfitPercent!, MIN_TAKE_PROFIT_PERCENT, MAX_TAKE_PROFIT_PERCENT, decision.takeProfitPercent!)
            : (MODEL_DRIVEN_EXITS ? undefined : normalizePercent(fallbackTp, MIN_TAKE_PROFIT_PERCENT, MAX_TAKE_PROFIT_PERCENT, fallbackTp));

          const stopLossPercent = slProvided
            ? normalizePercent(decision.stopLossPercent!, MIN_STOP_LOSS_PERCENT, MAX_STOP_LOSS_PERCENT, decision.stopLossPercent!)
            : (MODEL_DRIVEN_EXITS ? undefined : normalizePercent(fallbackSl, MIN_STOP_LOSS_PERCENT, MAX_STOP_LOSS_PERCENT, fallbackSl));

          const maxHoldMinutes = holdProvided
            ? normalizeHoldMinutes(decision.maxHoldMinutes!)
            : (MODEL_DRIVEN_EXITS ? undefined : normalizeHoldMinutes(fallbackHold));

          const leverageText = decision.leverage ?? 'N/A';
          const sizeValue = decision.size ?? NaN;
          const sizeText = Number.isFinite(sizeValue) ? sizeValue.toFixed(2) : 'N/A';
          const tpText = typeof takeProfitPercent === 'number' ? `${(takeProfitPercent * 100).toFixed(1)}%` : '—';
          const slText = typeof stopLossPercent === 'number' ? `${(stopLossPercent * 100).toFixed(1)}%` : '—';
          const holdText = typeof maxHoldMinutes === 'number' ? `${maxHoldMinutes}m` : '—';
          decisionText = `OPEN ${side} ${decision.symbol ?? 'N/A'} $${sizeText} ${leverageText}x (TP ${tpText}, SL ${slText}, Hold ${holdText})`;
        } else if (decision.action === 'CLOSE' && decision.symbol) {
          decisionText = `CLOSE ${decision.symbol}`;
        }
        // For HOLD, decisionText remains 'HOLD'

        // Save reasoning to database
        await supabase.from('model_reasoning').insert({
          model_id: model.id,
          reasoning_text: decision.reasoning,
          decision: decisionText,
          confidence: decision.confidence,
          market_snapshot: snapshot,
        });

        // Execute trade decision
        console.log(`🤖 [${model.name}] Decision: ${decision.action} | Size: $${decision.size?.toFixed(2) || 'N/A'} | Leverage: ${decision.leverage || 'N/A'}x | Symbol: ${decision.symbol || 'N/A'}`);

        if (decision.action === 'HOLD') {
          results.push({
            modelId: model.id,
            modelName: model.name,
            action: 'HOLD',
            success: true,
          });
        } else if (decision.action === 'CLOSE' && decision.symbol) {
          const positionToClose = openPositions.find(p => p.symbol === decision.symbol);

          if (!positionToClose) {
            console.log(`⚠️  [${model.name}] No open position found for ${decision.symbol}`);
            results.push({
              modelId: model.id,
              modelName: model.name,
              action: 'SKIP',
              success: true,
              error: 'No position to close',
            });
            continue;
          }

          await closePosition(positionToClose, 'MODEL_CLOSE');

          results.push({
            modelId: model.id,
            modelName: model.name,
            action: 'CLOSE',
            success: true,
          });
        } else if (decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') {
          const symbol = decision.symbol || 'BTCUSDT';
          const desiredSide = decision.action === 'OPEN_LONG' ? 'LONG' : 'SHORT';

          // Model-driven exits: compute TP/SL/Hold only if provided, else optional
          const tpProvided = typeof decision.takeProfitPercent === 'number';
          const slProvided = typeof decision.stopLossPercent === 'number';
          const holdProvided = typeof decision.maxHoldMinutes === 'number';

          const fallbackTp = ENV_DEFAULT_TP ?? DEFAULT_TAKE_PROFIT_PERCENT;
          const fallbackSl = ENV_DEFAULT_SL ?? DEFAULT_STOP_LOSS_PERCENT;
          const fallbackHold = ENV_DEFAULT_MAX_HOLD ?? DEFAULT_MAX_HOLD_MINUTES;

          const takeProfitPercent = tpProvided
            ? normalizePercent(decision.takeProfitPercent!, MIN_TAKE_PROFIT_PERCENT, MAX_TAKE_PROFIT_PERCENT, decision.takeProfitPercent!)
            : (MODEL_DRIVEN_EXITS ? undefined : normalizePercent(fallbackTp, MIN_TAKE_PROFIT_PERCENT, MAX_TAKE_PROFIT_PERCENT, fallbackTp));
          const stopLossPercent = slProvided
            ? normalizePercent(decision.stopLossPercent!, MIN_STOP_LOSS_PERCENT, MAX_STOP_LOSS_PERCENT, decision.stopLossPercent!)
            : (MODEL_DRIVEN_EXITS ? undefined : normalizePercent(fallbackSl, MIN_STOP_LOSS_PERCENT, MAX_STOP_LOSS_PERCENT, fallbackSl));
          const maxHoldMinutes = holdProvided
            ? normalizeHoldMinutes(decision.maxHoldMinutes!)
            : (MODEL_DRIVEN_EXITS ? undefined : normalizeHoldMinutes(fallbackHold));

          let reversalPerformed = false;
          const existingPositionSameSymbol = openPositions.find(p => p.symbol === symbol);
          if (existingPositionSameSymbol && existingPositionSameSymbol.side !== desiredSide) {
            console.log(`🔄 [${model.name}] Reversing ${symbol} from ${existingPositionSameSymbol.side} to ${desiredSide}`);
            await closePosition(existingPositionSameSymbol, `REVERSE_TO_${desiredSide}`);
            reversalPerformed = true;
          } else if (existingPositionSameSymbol) {
            console.log(`⚠️  [${model.name}] ${desiredSide} ${symbol} already open, skipping additional entry`);
            results.push({
              modelId: model.id,
              modelName: model.name,
              action: 'SKIP',
              success: true,
              error: 'Position already open',
            });
            continue;
          }

          if (openPositions.length >= MAX_OPEN_POSITIONS) {
            console.log(`⏭️  [${model.name}] Max positions reached (${openPositions.length}/${MAX_OPEN_POSITIONS}), skipping new entry`);
            results.push({
              modelId: model.id,
              modelName: model.name,
              action: 'SKIP',
              success: true,
              error: 'Max positions reached',
            });
            continue;
          }

          const refreshedUnrealized = openPositions.reduce((sum, p) => sum + (parseFloat(p.unrealized_pnl) || 0), 0);
          const effectiveEquity = modelEquity + refreshedUnrealized;

          const maxPositionSize = effectiveEquity * MAX_POSITION_SIZE_PERCENT;
          const requestedSize = Math.max(decision.size || 0, 0);
          const positionSize = Math.min(requestedSize, maxPositionSize, availableCash * 0.9);

          console.log(`💰 [${model.name}] Position sizing:`, {
            equity: effectiveEquity.toFixed(2),
            maxPositionSize: maxPositionSize.toFixed(2),
            availableCash: availableCash.toFixed(2),
            requestedSize: requestedSize.toFixed(2),
            finalSize: positionSize.toFixed(2),
          });

          if (positionSize < MIN_POSITION_SIZE_USD) {
            console.log(`⚠️  [${model.name}] Position size too small: $${positionSize.toFixed(2)}, skipping`);
            results.push({
              modelId: model.id,
              modelName: model.name,
              action: 'SKIP',
              success: true,
              error: 'Position size too small',
            });
            continue;
          }

          const leverage = Math.min(decision.leverage || MAX_LEVERAGE, MAX_LEVERAGE);

          console.log(`📈 [${model.name}] Opening ${desiredSide} ${symbol}: $${positionSize.toFixed(2)} @ ${leverage}x`);
          console.log(
            `   🎯 Risk plan -> TP ${typeof takeProfitPercent === 'number' ? (takeProfitPercent * 100).toFixed(2) + '%' : '—'}, SL ${typeof stopLossPercent === 'number' ? (stopLossPercent * 100).toFixed(2) + '%' : '—'}, Max hold ${typeof maxHoldMinutes === 'number' ? maxHoldMinutes + 'm' : '—'}`
          );

          const marketEntry = marketData.find(m => m.symbol === symbol);
          const currentPrice = marketEntry?.price || FALLBACK_PRICES[symbol] || 1;

          console.log(`   Market data for ${symbol}:`, {
            found: !!marketEntry,
            price: marketEntry?.price,
            usingFallback: !marketEntry?.price || marketEntry.price <= 0,
            finalPrice: currentPrice,
          });

          if (currentPrice <= 0) {
            throw new Error(`No valid price data for ${symbol}`);
          }

          const quantity = positionSize / currentPrice;

          // Execute market order on Aster
          const side = decision.action === 'OPEN_LONG' ? 'BUY' : 'SELL';
          const positionSide = desiredSide;

          // Use model-specific Aster client for opening order

          let orderId: string | null = null;
          let actualEntryPrice = currentPrice;
          let actualQuantity = quantity;

          try {
            // 1. First set the leverage for this symbol
            console.log(`   Setting leverage to ${leverage}x for ${symbol}...`);
            await modelAsterClient.changeLeverage(symbol, leverage);

            // 2. Place the market order (use symbol-specific precision)
            const roundedQty = roundQuantity(symbol, quantity);
            console.log(`   Placing ${side} order: ${roundedQty} ${symbol}...`);
            const orderResponse = await modelAsterClient.placeOrder({
              symbol,
              side,
              type: 'MARKET',
              quantity: roundedQty,
              // Note: positionSide removed - Aster account is in One-Way mode
            });
            orderId = orderResponse.orderId.toString();
            const executedQty = parseFloat(orderResponse.executedQty || '0');
            actualQuantity = executedQty > 0 ? executedQty : roundedQty; // Use rounded quantity as fallback

            const avgPrice = parseFloat(orderResponse.avgPrice || '0');
            const priceField = parseFloat(orderResponse.price || '0');
            const cumQuote = parseFloat(orderResponse.cumQuote || '0');

            // Try to get actual fill price from order response
            if (Number.isFinite(avgPrice) && avgPrice > 0) {
              actualEntryPrice = avgPrice;
            } else if (Number.isFinite(priceField) && priceField > 0) {
              actualEntryPrice = priceField;
            } else if (Number.isFinite(cumQuote) && cumQuote > 0 && actualQuantity > 0) {
              actualEntryPrice = cumQuote / actualQuantity;
            } else {
              // Fallback to market price - ensure it's valid
              actualEntryPrice = currentPrice > 0 ? currentPrice : FALLBACK_PRICES[symbol] || 1;
              console.warn(`   ⚠️ Using market price fallback for ${symbol}: $${actualEntryPrice.toFixed(4)}`);
            }

            // Ensure entry price is never zero
            if (!actualEntryPrice || actualEntryPrice <= 0) {
              actualEntryPrice = FALLBACK_PRICES[symbol] || 1;
              console.error(`   ❌ Invalid entry price, using fallback: $${actualEntryPrice.toFixed(4)}`);
            }

            console.log('   ↳ Fill details', {
              executedQty: orderResponse.executedQty,
              avgPrice: orderResponse.avgPrice,
              cumQuote: orderResponse.cumQuote,
              resolvedEntryPrice: actualEntryPrice,
              resolvedQuantity: actualQuantity,
            });

            console.log(`   ✅ Order placed! ID: ${orderId}, Price: $${actualEntryPrice.toFixed(4)}, Qty: ${actualQuantity.toFixed(4)}`);
          } catch (asterError) {
            console.error(`   ❌ Aster API error:`, asterError);
            // If order fails, skip creating database records
            results.push({
              modelId: model.id,
              modelName: model.name,
              action: 'ERROR',
              success: false,
              error: `Aster order failed: ${asterError instanceof Error ? asterError.message : String(asterError)}`,
            });
            continue;
          }

          const tpText = typeof takeProfitPercent === 'number' ? `${(takeProfitPercent * 100).toFixed(1)}%` : '—';
          const slText = typeof stopLossPercent === 'number' ? `${(stopLossPercent * 100).toFixed(1)}%` : '—';
          const holdText = typeof maxHoldMinutes === 'number' ? `${maxHoldMinutes}m` : '—';
          decisionText = `OPEN ${desiredSide} ${symbol} $${positionSize.toFixed(2)} ${leverage}x (TP ${tpText}, SL ${slText}, Hold ${holdText})`;

          // Create trade record with real order data
          const { data: trade, error: tradeError } = await supabase
            .from('trades')
            .insert({
              model_id: model.id,
              symbol,
              side: positionSide,
              entry_price: actualEntryPrice,
              quantity: actualQuantity,
              leverage,
              notional_value: actualQuantity * actualEntryPrice,
              entry_time: new Date().toISOString(),
              status: 'open',
              fees: actualQuantity * actualEntryPrice * 0.0004, // 0.04% taker fee estimate
              aster_order_id: orderId, // Store the real order ID for tracking
              take_profit_percent: typeof takeProfitPercent === 'number' ? takeProfitPercent : null,
              stop_loss_percent: typeof stopLossPercent === 'number' ? stopLossPercent : null,
              max_hold_minutes: typeof maxHoldMinutes === 'number' ? maxHoldMinutes : null,
            })
            .select()
            .single();

          if (tradeError) {
            throw tradeError;
          }

          // Create position record
          await supabase.from('positions').insert({
            model_id: model.id,
            trade_id: trade.id,
            symbol,
            side: positionSide,
            entry_price: actualEntryPrice,
            current_price: actualEntryPrice,
            quantity: actualQuantity,
            leverage,
            notional_value: actualQuantity * actualEntryPrice,
            unrealized_pnl: 0,
            take_profit_percent: typeof takeProfitPercent === 'number' ? takeProfitPercent : null,
            stop_loss_percent: typeof stopLossPercent === 'number' ? stopLossPercent : null,
            max_hold_minutes: typeof maxHoldMinutes === 'number' ? maxHoldMinutes : null,
          });

          console.log(`✅ [${model.name}] Trade opened: ${trade.id}`);

          availableCash = await fetchAvailableCash();

          const resultAction = reversalPerformed ? `REVERSE_${desiredSide}` : decision.action;

          results.push({
            modelId: model.id,
            modelName: model.name,
            action: resultAction,
            success: true,
            tradeId: trade.id,
          });
        }

      } catch (modelError) {
        console.error(`❌ [${model.name}] Error:`, modelError);
        results.push({
          modelId: model.id,
          modelName: model.name,
          action: 'ERROR',
          success: false,
          error: modelError instanceof Error ? modelError.message : String(modelError),
        });
      }
    }

    // Create performance snapshots for all models after trading
    // Use a single timestamp for this run so chart points align
    console.log('\n📸 [CRON] Creating performance snapshots...');
    const runTimestamp = new Date().toISOString();
    for (const model of models) {
      try {
        // Get updated model equity
        const { data: updatedModel } = await supabase
          .from('models')
          .select('current_equity')
          .eq('id', model.id)
          .single();

        const currentEquity = updatedModel ? parseFloat(updatedModel.current_equity) : parseFloat(model.current_equity);

        // Get current positions for unrealized P&L
        const { data: positions } = await supabase
          .from('positions')
          .select('unrealized_pnl')
          .eq('model_id', model.id);

        const unrealizedPnl = positions?.reduce((sum, p) => sum + (parseFloat(p.unrealized_pnl) || 0), 0) || 0;

        // Get closed trades stats
        const { data: closedTrades } = await supabase
          .from('trades')
          .select('net_pnl, fees')
          .eq('model_id', model.id)
          .eq('status', 'closed');

        const realizedPnl = closedTrades?.reduce((sum, t) => sum + (parseFloat(t.net_pnl) || 0), 0) || 0;
        const totalFees = closedTrades?.reduce((sum, t) => sum + (parseFloat(t.fees) || 0), 0) || 0;
        const tradeCount = closedTrades?.length || 0;

        // Create snapshot
        await supabase.from('performance_snapshots').insert({
          model_id: model.id,
          equity: currentEquity,
          realized_pnl: realizedPnl,
          unrealized_pnl: unrealizedPnl,
          total_fees: totalFees,
          trade_count: tradeCount,
          // Align snapshots from the same cron execution to a single timestamp
          timestamp: runTimestamp,
        });

        console.log(`  ✅ [${model.name}] Snapshot created: $${currentEquity.toFixed(2)}`);
      } catch (snapshotError) {
        console.error(`  ❌ [${model.name}] Snapshot error:`, snapshotError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ [CRON] Execution completed in ${duration}ms`);
    console.log(`📊 [CRON] Results: ${results.filter(r => r.success).length}/${results.length} successful`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      results,
    });

  } catch (error) {
    console.error('❌ [CRON] Fatal error:', error);
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

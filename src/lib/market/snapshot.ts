/**
 * Market snapshot builder for ModelChat expanded card (Alpha Arena style)
 */

import { AsterClient } from '@/lib/aster/client';
import { supabase, Position as DBPosition } from '@/lib/supabase';
import { ema, rsi, macd, atr } from '@/lib/utils/indicators';
import { calculateSharpeRatio } from '@/lib/utils/calculations';

const ASSETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'] as const;

type AssetSymbol = typeof ASSETS[number];

type K = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };

type PerAssetMetrics = {
  symbol: AssetSymbol;
  current_price: number;
  current_ema20: number;
  current_macd: number;
  current_rsi7: number;
  intraday: {
    mid_prices: number[];
    ema20: number[];
    macd_hist: number[];
    rsi7: number[];
    rsi14: number[];
  };
  ctx4h: {
    ema20: number;
    ema50: number;
    atr3: number;
    atr14: number;
    currVol: number;
    avgVol: number;
    macd_hist: number[];
    rsi14: number[];
  };
  fundingRate: number | null;
  openInterest: { latest: number | null; average: number | null };
};

export async function buildMarketSnapshot(aster: AsterClient, modelId: string) {
  const now = new Date();

  // Prompt context: minutes since start and invocation count
  const { data: firstLog } = await supabase
    .from('model_reasoning')
    .select('timestamp')
    .eq('model_id', modelId)
    .order('timestamp', { ascending: true })
    .limit(1)
    .single();

  const { count: invocations } = await supabase
    .from('model_reasoning')
    .select('*', { count: 'exact', head: true })
    .eq('model_id', modelId);

  const minutesSinceStart = firstLog
    ? Math.floor((now.getTime() - new Date(firstLog.timestamp as any).getTime()) / 60000)
    : 0;

  // Account context
  const { data: model } = await supabase.from('models').select('*').eq('id', modelId).single();
  const equity = Number(model?.current_equity ?? 0);
  const starting = Number(model?.starting_capital ?? 0);
  const totalPnl = equity - starting;
  const pnlPct = starting ? (totalPnl / starting) * 100 : 0;

  // Positions
  const { data: pos } = await supabase
    .from('positions')
    .select('*')
    .eq('model_id', modelId);
  const positions: DBPosition[] = (pos as any) || [];

  // Per-asset metrics
  const perAsset: PerAssetMetrics[] = [];
  for (const symbol of ASSETS) {
    try {
      const k3 = (await aster.getCandlesticks(symbol, '3m', 60)) as K[];
      const k4 = (await aster.getCandlesticks(symbol, '4h', 30)) as K[];
      const closes3 = k3.map((c) => c.close);
      const highs4 = k4.map((c) => c.high);
      const lows4 = k4.map((c) => c.low);
      const closes4 = k4.map((c) => c.close);

      const ema20Arr3 = ema(closes3, 20);
      const macd3 = macd(closes3);
      const rsi7Arr3 = rsi(closes3, 7);
      const rsi14Arr3 = rsi(closes3, 14);

      const ema20_4h = ema(closes4, 20).at(-1) ?? (closes4.at(-1) ?? 0);
      const ema50_4h = ema(closes4, 50).at(-1) ?? (closes4.at(-1) ?? 0);
      const atr3_4h = atr(highs4, lows4, closes4, 3).at(-1) ?? 0;
      const atr14_4h = atr(highs4, lows4, closes4, 14).at(-1) ?? 0;
      const macd4 = macd(closes4);
      const rsi14_4h = rsi(closes4, 14);

      const mid_prices = k3.map((c) => (c.high + c.low) / 2);

      // Funding & Open Interest
      let fundingRate: number | null = null;
      try {
        const prem = await aster.getPremiumIndex(symbol);
        fundingRate = prem?.lastFundingRate != null ? Number(prem.lastFundingRate) : null;
      } catch {
        fundingRate = null;
      }

      let oiLatest: number | null = null;
      let oiAvg: number | null = null;
      try {
        const oi = await aster.getOpenInterest(symbol);
        oiLatest = oi?.openInterest != null ? Number(oi.openInterest) : null;
        const hist = await aster.getOpenInterestHist(symbol, '5m', 10);
        if (hist.length > 0) {
          oiAvg = hist.reduce((s, v) => s + v, 0) / hist.length;
        } else {
          oiAvg = oiLatest;
        }
      } catch {
        oiLatest = null;
        oiAvg = null;
      }

      perAsset.push({
        symbol,
        current_price: closes3.at(-1) ?? 0,
        current_ema20: ema20Arr3.at(-1) ?? (closes3.at(-1) ?? 0),
        current_macd: macd3.hist.at(-1) ?? 0,
        current_rsi7: rsi7Arr3.at(-1) ?? 0,
        intraday: {
          mid_prices,
          ema20: ema20Arr3.slice(-10),
          macd_hist: macd3.hist.slice(-10),
          rsi7: rsi7Arr3.slice(-10),
          rsi14: rsi14Arr3.slice(-10),
        },
        ctx4h: {
          ema20: ema20_4h,
          ema50: ema50_4h,
          atr3: atr3_4h,
          atr14: atr14_4h,
          currVol: k4.at(-1)?.volume ?? 0,
          avgVol: k4.length ? k4.reduce((s, c) => s + c.volume, 0) / k4.length : 0,
          macd_hist: macd4.hist.slice(-10),
          rsi14: rsi14_4h.slice(-10),
        },
        fundingRate,
        openInterest: { latest: oiLatest, average: oiAvg },
      });
    } catch (e) {
      console.error(`[snapshot] Failed to build metrics for ${symbol}:`, e);
      // Partial fallback for asset
      perAsset.push({
        symbol,
        current_price: 0,
        current_ema20: 0,
        current_macd: 0,
        current_rsi7: 0,
        intraday: { mid_prices: [], ema20: [], macd_hist: [], rsi7: [], rsi14: [] },
        ctx4h: { ema20: 0, ema50: 0, atr3: 0, atr14: 0, currVol: 0, avgVol: 0, macd_hist: [], rsi14: [] },
        fundingRate: null,
        openInterest: { latest: null, average: null },
      });
    }
  }

  // Gather recent decisions for context memory (newest first)
  const { data: recentReasoning } = await supabase
    .from('model_reasoning')
    .select('decision, reasoning_text, confidence, timestamp')
    .eq('model_id', modelId)
    .order('timestamp', { ascending: false })
    .limit(5);
  const recent_decisions = (recentReasoning ?? []).map((entry: any) => ({
    decision: entry.decision as string,
    reasoning: entry.reasoning_text as string,
    confidence: Number(entry.confidence ?? 0),
    timestamp: entry.timestamp,
  }));

  const indicator_highlights = perAsset.map((asset) => {
    const name = asset.symbol.replace('USDT', '');
    const priceVsEma = asset.current_price > asset.current_ema20
      ? 'above 3m EMA20'
      : asset.current_price < asset.current_ema20
        ? 'below 3m EMA20'
        : 'at 3m EMA20';

    const macdHist = asset.intraday.macd_hist.slice(-3);
    let macdSlope = 'flat';
    if (macdHist.length >= 2) {
      const diff = macdHist[macdHist.length - 1] - macdHist[0];
      if (diff > 0.0005) macdSlope = 'rising';
      else if (diff < -0.0005) macdSlope = 'falling';
    }
    const macdLatest = macdHist.at(-1) ?? 0;
    const macdState = `${macdLatest >= 0 ? 'positive' : 'negative'} & ${macdSlope}`;

    const rsi = asset.current_rsi7;
    const rsiState = rsi >= 70 ? 'overbought' : rsi <= 30 ? 'oversold' : `neutral (${round(rsi, 1)})`;

    const volumeRatio = asset.ctx4h.avgVol ? asset.ctx4h.currVol / asset.ctx4h.avgVol : 0;
    const volumeState = volumeRatio > 1.3 ? 'volume surging' : volumeRatio < 0.7 ? 'volume cooling' : 'volume average';

    const fundingState = asset.fundingRate == null ? 'funding N/A' : `funding ${round(asset.fundingRate * 100, 2)}bps`;

    return {
      symbol: name,
      summary: [
        `Price ${priceVsEma}`,
        `MACD ${macdState}`,
        `RSI ${rsiState}`,
        volumeState,
        fundingState,
      ].join(' | '),
    };
  });

  const atrPercents = perAsset
    .map((asset) => asset.current_price > 0 ? (asset.ctx4h.atr14 / asset.current_price) * 100 : 0)
    .filter((v) => Number.isFinite(v) && v > 0);
  const avgAtrPct = atrPercents.length ? atrPercents.reduce((s, v) => s + v, 0) / atrPercents.length : 0;
  const fundingValues = perAsset
    .map((asset) => asset.fundingRate)
    .filter((v): v is number => typeof v === 'number');
  const avgFunding = fundingValues.length
    ? fundingValues.reduce((sum, v) => sum + v, 0) / fundingValues.length
    : null;
  const aboveEma = perAsset.filter((asset) => asset.current_price >= asset.current_ema20).length;
  const macdPositive = perAsset.filter((asset) => ((asset.intraday.macd_hist.at(-1) ?? 0)) >= 0).length;
  const rsiValues = perAsset
    .map((asset) => asset.current_rsi7)
    .filter((v) => Number.isFinite(v) && v > 0);
  const avgRsi = rsiValues.length ? rsiValues.reduce((sum, v) => sum + v, 0) / rsiValues.length : 0;

  let regimeLabel: 'RISK-ON' | 'RISK-OFF' | 'NEUTRAL' = 'NEUTRAL';
  let regimeCommentary = 'Mixed signals across majors; stay selective until a clearer trend emerges.';

  if (aboveEma >= Math.ceil(perAsset.length * 0.6) && macdPositive >= Math.ceil(perAsset.length * 0.6) && avgRsi >= 55) {
    regimeLabel = 'RISK-ON';
    regimeCommentary = 'Momentum leans bullish with most assets holding above EMA20 and MACD positive; favor high-conviction long setups.';
  } else if (aboveEma <= Math.floor(perAsset.length * 0.4) && macdPositive <= Math.floor(perAsset.length * 0.4) && avgRsi <= 45) {
    regimeLabel = 'RISK-OFF';
    regimeCommentary = 'Majority of assets trade below EMA20 with weak momentum; protect capital and wait for better conditions.';
  }

  const market_regime = {
    label: regimeLabel,
    commentary: regimeCommentary,
    metrics: {
      'Assets ≥ EMA20': `${aboveEma}/${perAsset.length}`,
      'MACD ≥ 0': `${macdPositive}/${perAsset.length}`,
      'Avg RSI7': round(avgRsi, 1),
      'Avg ATR14%': round(avgAtrPct, 2),
      'Avg Funding Rate (bps)': avgFunding != null ? round(avgFunding * 100, 2) : 'N/A',
    },
  };

  // Sharpe ratio from performance snapshots
  const { data: snaps } = await supabase
    .from('performance_snapshots')
    .select('equity,timestamp')
    .eq('model_id', modelId)
    .order('timestamp', { ascending: true })
    .limit(200);
  const equities = (snaps ?? []).map((s: any) => Number(s.equity));
  const returns: number[] = [];
  for (let i = 1; i < equities.length; i++) {
    const prev = equities[i - 1] || 0;
    if (prev > 0) returns.push((equities[i] - prev) / prev);
  }
  const sharpe_ratio = returns.length ? Number(calculateSharpeRatio(returns, 0).toFixed(2)) : 0;

  // Positions detailed
  const positions_detailed = positions.map((p) => {
    const isLong = p.side === 'LONG';
    const entry = Number(p.entry_price);
    const qty = Number(p.quantity);
    const lev = Number(p.leverage || 1);
    const cur = Number((p as any).current_price ?? entry);
    const storedTp = Number((p as any).take_profit_percent ?? 0);
    const storedSl = Number((p as any).stop_loss_percent ?? 0);
    const tpPercent = storedTp > 0 ? storedTp : 0.05;
    const slPercent = storedSl > 0 ? storedSl : 0.03;
    const stop = isLong ? entry * (1 - slPercent) : entry * (1 + slPercent);
    const target = isLong ? entry * (1 + tpPercent) : entry * (1 - tpPercent);
    const liq = isLong ? entry * (1 - 1 / Math.max(lev, 1)) : entry * (1 + 1 / Math.max(lev, 1));
    const risk_usd = Math.abs(entry - stop) * qty;
    const notional_usd = Number((p as any).notional_value ?? entry * qty * (lev > 1 ? 1 : 1));

    // Reference 4h EMA20 for invalidation
    const sym = p.symbol as AssetSymbol;
    const ctx = perAsset.find((a) => a.symbol === sym)?.ctx4h;

    return {
      symbol: sym.replace('USDT', ''),
      quantity: qty,
      entry_price: entry,
      current_price: cur,
      liquidation_price: liq,
      unrealized_pnl: Number((p as any).unrealized_pnl ?? (isLong ? (cur - entry) * qty : (entry - cur) * qty)),
      leverage: lev,
      exit_plan: {
        profit_target: target,
        stop_loss: stop,
        max_hold_minutes: Number((p as any).max_hold_minutes ?? 24 * 60),
        invalidation_condition: ctx
          ? `Close if a 4h candle closes ${isLong ? '<' : '>'} ${ctx.ema20.toFixed(2)} (20EMA) AND the 4h MACD histogram decreases for 2 consecutive bars.`
          : 'Close on 4h 20EMA break with weakening MACD histogram.',
      },
      confidence: 0.6,
      risk_usd,
      sl_oid: -1,
      tp_oid: -1,
      wait_for_fill: false,
      entry_oid: -1,
      notional_usd,
    };
  });

  const positionsValue = positions_detailed.reduce((s, p) => s + (p.notional_usd || 0), 0);
  const availableCash = Math.max(0, equity - positionsValue);

  // TRADING_DECISIONS (placeholder HOLDs)
  const trading_decisions = positions_detailed.map((pd) => ({
    symbol: pd.symbol,
    action: 'HOLD',
    confidence: Math.round(60),
    quantity: pd.quantity,
  }));

  // Build user_prompt text block
  const lines: string[] = [];
  lines.push(
    `It has been ${minutesSinceStart} minutes since you started trading. The current time is ${now.toISOString()} and you've been invoked ${invocations ?? 0} times. Below, we are providing you with a variety of state data, price data, and predictive signals so you can discover alpha. Below that is your current account information, value, performance, positions, etc.`,
    '',
    'ALL OF THE PRICE OR SIGNAL DATA BELOW IS ORDERED: OLDEST → NEWEST',
    '',
    'CURRENT MARKET STATE FOR ALL COINS'
  );

  if (recent_decisions.length) {
    lines.push('', 'RECENT MODEL DECISIONS (newest first)');
    for (const decision of recent_decisions) {
      const ts = new Date(decision.timestamp);
      lines.push(
        `- ${ts.toISOString()} | ${decision.decision} | Confidence: ${decision.confidence}%`,
        `  ${truncate(decision.reasoning, 320)}`
      );
    }
    lines.push('');
  } else {
    lines.push('', 'RECENT MODEL DECISIONS: None recorded yet.', '');
  }

  lines.push('MARKET REGIME SNAPSHOT:', `- Regime: ${market_regime.label}`, `- Commentary: ${market_regime.commentary}`);
  for (const [metric, value] of Object.entries(market_regime.metrics)) {
    lines.push(`  - ${metric}: ${value}`);
  }
  lines.push('');

  if (indicator_highlights.length) {
    lines.push('KEY TECHNICAL HIGHLIGHTS:');
    for (const highlight of indicator_highlights) {
      lines.push(`- ${highlight.symbol}: ${highlight.summary}`);
    }
    lines.push('');
  }

  for (const a of perAsset) {
    const coin = a.symbol.replace('USDT', '');
    lines.push(
      `ALL ${coin} DATA`,
      `current_price = ${round(a.current_price)}, current_ema20 = ${round(a.current_ema20)}, current_macd = ${round(a.current_macd)}, current_rsi (7 period) = ${round(a.current_rsi7)}`,
      '',
      `Open Interest: Latest: ${nullable(a.openInterest.latest)} Average: ${nullable(a.openInterest.average)}`,
      '',
      `Funding Rate: ${nullable(a.fundingRate)}`,
      '',
      'Intraday series (by minute, oldest → latest):',
      '',
      `Mid prices: [${a.intraday.mid_prices.map((v) => round(v)).join(', ')}]`,
      '',
      `EMA indicators (20‑period): [${a.intraday.ema20.map((v) => round(v)).join(', ')}]`,
      '',
      `MACD indicators: [${a.intraday.macd_hist.map((v) => round(v)).join(', ')}]`,
      '',
      `RSI indicators (7‑Period): [${a.intraday.rsi7.map((v) => round(v)).join(', ')}]`,
      '',
      `RSI indicators (14‑Period): [${a.intraday.rsi14.map((v) => round(v)).join(', ')}]`,
      '',
      'Longer‑term context (4‑hour timeframe):',
      '',
      `20‑Period EMA: ${round(a.ctx4h.ema20)} vs. 50‑Period EMA: ${round(a.ctx4h.ema50)}`,
      '',
      `3‑Period ATR: ${round(a.ctx4h.atr3)} vs. 14‑Period ATR: ${round(a.ctx4h.atr14)}`,
      '',
      `Current Volume: ${round(a.ctx4h.currVol)} vs. Average Volume: ${round(a.ctx4h.avgVol)}`,
      '',
      `MACD indicators: [${a.ctx4h.macd_hist.map((v) => round(v)).join(', ')}]`,
      '',
      `RSI indicators (14‑Period): [${a.ctx4h.rsi14.map((v) => round(v)).join(', ')}]`,
      ''
    );
  }

  lines.push(
    'HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE',
    `Current Total Return (percent): ${round(pnlPct)}%`,
    `Available Cash: ${round(availableCash)}`,
    `Current Account Value: ${round(equity)}`
  );

  const user_prompt = lines.join('\n');

  return {
    user_prompt,
    metrics: perAsset,
    account: { equity, pnlPct, availableCash },
    positions_detailed,
    sharpe_ratio,
    trading_decisions,
    recent_decisions,
    indicator_highlights,
    market_regime,
  };
}

function round(v: number | null | undefined, p = 3): string {
  if (v == null || !Number.isFinite(v)) return '0';
  return Number(v).toFixed(p).replace(/\.0+$/, '.0');
}

function nullable(v: number | null | undefined): string {
  return v == null ? 'N/A' : String(v);
}

function truncate(value: string | null | undefined, limit = 320): string {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

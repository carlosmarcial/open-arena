/**
 * Technical Indicators (lightweight, dependency-free)
 */

// Exponential Moving Average
export function ema(values: number[], period: number): number[] {
  if (period <= 0 || values.length === 0) return Array(values.length).fill(0);
  const k = 2 / (period + 1);
  const out = Array<number>(values.length).fill(0);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    out[i] = v;
    prev = v;
  }
  return out;
}

// Simple Moving Average (helper)
export function sma(values: number[], period: number): number[] {
  if (period <= 0 || values.length === 0) return Array(values.length).fill(0);
  const out = Array<number>(values.length).fill(0);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out[i] = i >= period - 1 ? sum / period : sum / (i + 1);
  }
  return out;
}

// Relative Strength Index (Wilder's smoothing)
export function rsi(closes: number[], period = 14): number[] {
  const n = closes.length;
  if (n < 2) return Array(n).fill(0);
  const gains: number[] = new Array(n).fill(0);
  const losses: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    gains[i] = Math.max(diff, 0);
    losses[i] = Math.max(-diff, 0);
  }
  const out = Array<number>(n).fill(0);
  let avgGain = 0, avgLoss = 0;
  // Seed
  const seed = Math.min(period, n - 1);
  for (let i = 1; i <= seed; i++) { avgGain += gains[i]; avgLoss += losses[i]; }
  avgGain /= period; avgLoss /= period;
  out[seed] = calcRsi(avgGain, avgLoss);
  // Wilder smoothing
  for (let i = seed + 1; i < n; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out[i] = calcRsi(avgGain, avgLoss);
  }
  // Fill leading with 0
  for (let i = 0; i < seed; i++) out[i] = 0;
  return out;
}

function calcRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// MACD with histogram
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number[]; signal: number[]; hist: number[] } {
  if (closes.length === 0) {
    return { macd: [], signal: [], hist: [] };
  }
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => (emaFast[i] ?? 0) - (emaSlow[i] ?? 0));
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
  return { macd: macdLine, signal: signalLine, hist };
}

// Average True Range (Wilder)
export function atr(high: number[], low: number[], close: number[], period = 14): number[] {
  const n = Math.min(high.length, low.length, close.length);
  if (n === 0) return [];
  const tr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const prevClose = i > 0 ? close[i - 1] : close[i];
    const range1 = high[i] - low[i];
    const range2 = Math.abs(high[i] - prevClose);
    const range3 = Math.abs(low[i] - prevClose);
    tr[i] = Math.max(range1, range2, range3);
  }
  // Wilder smoothing
  const out = Array<number>(n).fill(0);
  let sum = 0;
  const seed = Math.min(period, n);
  for (let i = 0; i < seed; i++) sum += tr[i];
  let prev = sum / period;
  out[seed - 1] = prev;
  for (let i = seed; i < n; i++) {
    const v = (prev * (period - 1) + tr[i]) / period;
    out[i] = v; prev = v;
  }
  for (let i = 0; i < seed - 1; i++) out[i] = out[seed - 1];
  return out;
}

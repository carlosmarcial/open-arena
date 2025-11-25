/**
 * Trading metrics calculations
 */

import type { Trade } from '@/types';

/**
 * Calculate Sharpe Ratio
 * Measures risk-adjusted returns
 * Formula: (Mean Return - Risk-Free Rate) / Std Dev of Returns
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length === 0) return 0;

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = calculateStandardDeviation(returns);

  if (stdDev === 0) return 0;

  return (meanReturn - riskFreeRate) / stdDev;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate win rate
 * Percentage of profitable trades
 */
export function calculateWinRate(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.netPnl !== null);
  if (closedTrades.length === 0) return 0;

  const winningTrades = closedTrades.filter(t => t.netPnl! > 0);
  return (winningTrades.length / closedTrades.length) * 100;
}

/**
 * Calculate expectancy
 * Average expected profit/loss per trade
 */
export function calculateExpectancy(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.netPnl !== null);
  if (closedTrades.length === 0) return 0;

  const winningTrades = closedTrades.filter(t => t.netPnl! > 0);
  const losingTrades = closedTrades.filter(t => t.netPnl! <= 0);

  if (winningTrades.length === 0 && losingTrades.length === 0) return 0;

  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.netPnl!, 0) / winningTrades.length
    : 0;

  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl!, 0) / losingTrades.length)
    : 0;

  const winRate = winningTrades.length / closedTrades.length;
  const lossRate = 1 - winRate;

  return (winRate * avgWin) - (lossRate * avgLoss);
}

/**
 * Calculate biggest win
 */
export function calculateBiggestWin(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.netPnl !== null);
  if (closedTrades.length === 0) return 0;

  return Math.max(...closedTrades.map(t => t.netPnl!));
}

/**
 * Calculate biggest loss
 */
export function calculateBiggestLoss(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.netPnl !== null);
  if (closedTrades.length === 0) return 0;

  return Math.min(...closedTrades.map(t => t.netPnl!));
}

/**
 * Calculate total fees
 */
export function calculateTotalFees(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.fees, 0);
}

/**
 * Calculate average trade size
 */
export function calculateAvgTradeSize(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed');
  if (closedTrades.length === 0) return 0;

  const total = closedTrades.reduce((sum, t) => sum + t.notionalValue, 0);
  return total / closedTrades.length;
}

/**
 * Calculate median trade size
 */
export function calculateMedianTradeSize(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed');
  if (closedTrades.length === 0) return 0;

  const sizes = closedTrades.map(t => t.notionalValue).sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);

  return sizes.length % 2 === 0
    ? (sizes[mid - 1] + sizes[mid]) / 2
    : sizes[mid];
}

/**
 * Calculate average holding time (in minutes)
 */
export function calculateAvgHoldingTime(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.holdingTime !== null);
  if (closedTrades.length === 0) return 0;

  const totalMs = closedTrades.reduce((sum, t) => sum + t.holdingTime!, 0);
  const avgMs = totalMs / closedTrades.length;

  return Math.round(avgMs / 60000); // Convert to minutes
}

/**
 * Calculate median holding time (in minutes)
 */
export function calculateMedianHoldingTime(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.holdingTime !== null);
  if (closedTrades.length === 0) return 0;

  const times = closedTrades.map(t => t.holdingTime!).sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);

  const medianMs = times.length % 2 === 0
    ? (times[mid - 1] + times[mid]) / 2
    : times[mid];

  return Math.round(medianMs / 60000); // Convert to minutes
}

/**
 * Calculate percentage of long trades
 */
export function calculatePercentLong(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed');
  if (closedTrades.length === 0) return 0;

  const longTrades = closedTrades.filter(t => t.side === 'LONG');
  return (longTrades.length / closedTrades.length) * 100;
}

/**
 * Calculate average leverage
 */
export function calculateAvgLeverage(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed');
  if (closedTrades.length === 0) return 0;

  const total = closedTrades.reduce((sum, t) => sum + t.leverage, 0);
  return total / closedTrades.length;
}

/**
 * Calculate median leverage
 */
export function calculateMedianLeverage(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.status === 'closed');
  if (closedTrades.length === 0) return 0;

  const leverages = closedTrades.map(t => t.leverage).sort((a, b) => a - b);
  const mid = Math.floor(leverages.length / 2);

  return leverages.length % 2 === 0
    ? (leverages[mid - 1] + leverages[mid]) / 2
    : leverages[mid];
}

/**
 * Format holding time as "XH YM" or "Xm"
 */
export function formatHoldingTime(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}H ${minutes}M`;
  }
  return `${minutes}m`;
}

/**
 * Format currency with proper decimals
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

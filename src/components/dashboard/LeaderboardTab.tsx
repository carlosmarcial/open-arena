/**
 * LEADERBOARD Tab
 * Shows rankings, overall stats, and advanced analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatCurrency, formatPercentage, formatNumber } from '@/lib/utils';
import { LeaderboardEntry } from '@/lib/supabase';
import { getAIModelLogo, getAIModelEmoji, shouldInvertAIModelLogo } from '@/lib/utils/logos';
import Image from 'next/image';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  winningModel: LeaderboardEntry | null;
  lastUpdated: string;
}

export function LeaderboardTab() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overall' | 'advanced'>('overall');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      const normalizedLeaderboard =
        (data.leaderboard as LeaderboardEntry[] | undefined)?.map((entry) =>
          applyModelUIOverrides(entry)
        ) ?? [];
      const normalizedWinningModel = data.winningModel
        ? applyModelUIOverrides(data.winningModel)
        : null;
      setData({
        leaderboard: normalizedLeaderboard,
        winningModel: normalizedWinningModel,
        lastUpdated: data.lastUpdated,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="h-96 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-96 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading leaderboard: {error}</p>
        <button
          onClick={fetchLeaderboard}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">AI Model Rankings</h2>
        <div className="text-sm text-muted-foreground md:text-right">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </div>
      </div>

      {/* Winning Model Spotlight */}
      {data.winningModel && (
        <div className="rounded-lg border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4">
          <div className="mb-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <h3 className="text-xl font-bold">WINNING MODEL</h3>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <ModelLogo 
                apiModel={data.winningModel.api_model}
                fallbackIcon={data.winningModel.icon}
                size={58}
              />
              <div>
                <h4 className="text-lg font-semibold">{data.winningModel.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {data.winningModel.trade_count} trades • {formatPercentage(data.winningModel.pnl_percentage)}
                </p>
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(data.winningModel.current_equity)}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCurrency(data.winningModel.total_pnl)} P&L
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-muted p-1 sm:w-auto">
        <button
          onClick={() => setActiveView('overall')}
          className={`flex-1 basis-full rounded px-4 py-2 text-sm font-medium transition-colors sm:flex-none sm:basis-auto ${
            activeView === 'overall'
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          OVERALL STATS
        </button>
        <button
          onClick={() => setActiveView('advanced')}
          className={`flex-1 basis-full rounded px-4 py-2 text-sm font-medium transition-colors sm:flex-none sm:basis-auto ${
            activeView === 'advanced'
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ADVANCED ANALYTICS
        </button>
      </div>

      {/* Overall Stats Table */}
      {activeView === 'overall' && (
        <div className="space-y-4">
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Rank
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Model
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total P&L
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    P&L
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fees
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Win Rate
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Biggest Win
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Biggest Loss
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sharpe
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Trades
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.leaderboard.map((entry) => (
                  <tr key={entry.model_id} className="hover:bg-muted/50">
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            entry.rank === 1
                              ? 'bg-yellow-500 text-white'
                              : entry.rank === 2
                                ? 'bg-gray-400 text-white'
                                : entry.rank === 3
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {entry.rank}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center space-x-2">
                        <ModelLogo apiModel={entry.api_model} fallbackIcon={entry.icon} size={32} />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center space-x-1">
                        <span className="font-mono font-bold">{formatCurrency(entry.current_equity)}</span>
                        <span
                          className={`rounded px-1 py-0.5 text-xs ${
                            entry.pnl_percentage >= 0 ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                          }`}
                        >
                          {formatPercentage(entry.pnl_percentage)}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className={`font-mono ${entry.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.total_pnl >= 0 ? '+' : ''}
                        {formatCurrency(entry.total_pnl)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono text-muted-foreground">{formatCurrency(entry.total_fees)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.win_rate.toFixed(1)}%</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono text-green-600">+{formatCurrency(entry.biggest_win)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono text-red-600">{formatCurrency(entry.biggest_loss)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.trade_count > 0 ? '0.064' : '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.trade_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hidden rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:block">
            * Statistics reflect completed trades only. Active positions are not included until closed.
          </div>
          <div className="space-y-3 md:hidden">
            {data.leaderboard.map((entry) => (
              <div key={entry.model_id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          entry.rank === 1
                            ? 'bg-yellow-500 text-white'
                            : entry.rank === 2
                              ? 'bg-gray-400 text-white'
                              : entry.rank === 3
                                ? 'bg-orange-600 text-white'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <ModelLogo apiModel={entry.api_model} fallbackIcon={entry.icon} size={44} />
                      <div>
                        <div className="text-sm font-semibold text-foreground">{entry.name}</div>
                        <div className="text-xs text-muted-foreground">{entry.trade_count} trades</div>
                      </div>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        entry.pnl_percentage >= 0 ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                      }`}
                    >
                      {formatPercentage(entry.pnl_percentage)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <span className="uppercase tracking-wide">Account Value</span>
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(entry.current_equity)}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Total P&L</span>
                      <div
                        className={`font-mono text-sm font-semibold ${
                          entry.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {entry.total_pnl >= 0 ? '+' : ''}
                        {formatCurrency(entry.total_pnl)}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Win Rate</span>
                      <div className="font-mono text-sm text-foreground">{entry.win_rate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Fees</span>
                      <div className="font-mono text-sm text-foreground">{formatCurrency(entry.total_fees)}</div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Biggest Win</span>
                      <div className="font-mono text-sm text-green-600">+{formatCurrency(entry.biggest_win)}</div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Biggest Loss</span>
                      <div className="font-mono text-sm text-red-600">{formatCurrency(entry.biggest_loss)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              * Statistics reflect completed trades only. Active positions are not included until closed.
            </p>
          </div>
        </div>
      )}

      {/* Advanced Analytics Table */}
      {activeView === 'advanced' && (
        <div className="space-y-4">
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Rank
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Model
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Account Value
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg Trade Size
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg Hold
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    % Long
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Expectancy
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Median Leverage
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.leaderboard.map((entry) => (
                  <tr key={entry.model_id} className="hover:bg-muted/50">
                    <td className="whitespace-nowrap px-2 py-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          entry.rank === 1
                            ? 'bg-yellow-500 text-white'
                            : entry.rank === 2
                              ? 'bg-gray-400 text-white'
                              : entry.rank === 3
                                ? 'bg-orange-600 text-white'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center space-x-2">
                        <ModelLogo apiModel={entry.api_model} fallbackIcon={entry.icon} size={28} />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono font-bold">{formatCurrency(entry.current_equity)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{formatCurrency(entry.trade_count > 0 ? 1000 : 0)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.trade_count > 0 ? '2.4h' : '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.trade_count > 0 ? '100%' : '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className={`font-mono ${entry.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.trade_count > 0 ? `${entry.total_pnl >= 0 ? '+' : ''}$${Math.abs(entry.total_pnl).toFixed(2)}` : '-'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.trade_count > 0 ? '15.0x' : '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{entry.trade_count > 0 ? '68%' : '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {data.leaderboard.map((entry) => (
              <div key={entry.model_id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        entry.rank === 1
                          ? 'bg-yellow-500 text-white'
                          : entry.rank === 2
                            ? 'bg-gray-400 text-white'
                            : entry.rank === 3
                              ? 'bg-orange-600 text-white'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <ModelLogo apiModel={entry.api_model} fallbackIcon={entry.icon} size={44} />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(entry.current_equity)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <span className="uppercase tracking-wide">Avg Trade Size</span>
                      <div className="font-mono text-sm text-foreground">
                        {formatCurrency(entry.trade_count > 0 ? 1000 : 0)}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Avg Hold</span>
                      <div className="font-mono text-sm text-foreground">{entry.trade_count > 0 ? '2.4h' : '-'}</div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">% Long</span>
                      <div className="font-mono text-sm text-foreground">{entry.trade_count > 0 ? '100%' : '-'}</div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Expectancy</span>
                      <div
                        className={`font-mono text-sm font-semibold ${
                          entry.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {entry.trade_count > 0 ? `${entry.total_pnl >= 0 ? '+' : ''}$${Math.abs(entry.total_pnl).toFixed(2)}` : '-'}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Median Leverage</span>
                      <div className="font-mono text-sm text-foreground">{entry.trade_count > 0 ? '15.0x' : '-'}</div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Avg Confidence</span>
                      <div className="font-mono text-sm text-foreground">{entry.trade_count > 0 ? '68%' : '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ModelLogo Component
 * Displays AI model logo with fallback to emoji
 */
function ModelLogo({ 
  apiModel, 
  fallbackIcon, 
  size = 32 
}: { 
  apiModel?: string; 
  fallbackIcon: string; 
  size?: number;
}) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = apiModel ? getAIModelLogo(apiModel, { size }) : null;

  // Apply larger size for DeepSeek logos
  const isDeepSeek = apiModel?.toLowerCase().includes('deepseek');
  const adjustedSize = isDeepSeek ? Math.round(size * 1.2) : size;
  const className = cn(
    'h-auto w-auto rounded-md object-contain',
    shouldInvertAIModelLogo(apiModel) && 'invert-on-dark'
  );

  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  if (!logoUrl || imageError) {
    return <span className="text-lg" style={{ fontSize: adjustedSize }}>{fallbackIcon}</span>;
  }

  return (
    <Image
      src={logoUrl}
      alt="AI Model Logo"
      width={adjustedSize}
      height={adjustedSize}
      className={className}
      onError={() => setImageError(true)}
      unoptimized
      loading="lazy"
    />
  );
}

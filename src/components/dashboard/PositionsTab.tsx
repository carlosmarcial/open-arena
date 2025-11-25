/**
 * POSITIONS Tab
 * Shows current open positions with P&L calculations
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { Position, ExitPlan } from '@/types';
import { getCryptoLogo, getCryptoEmoji, getCryptoSymbolName, shouldInvertCryptoLogo, getAIModelLogo, getAIModelEmoji, shouldInvertAIModelLogo } from '@/lib/utils/logos';
import { ModelFilterDropdown } from '@/components/ui/ModelFilterDropdown';
import { ExitPlanPopover } from '@/components/ui/ExitPlanPopover';
import Image from 'next/image';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

interface PositionsData {
  positionsByModel: Record<string, {
    model: {
      id: string;
      name: string;
      icon: string;
      color: string;
      api_model: string;
    };
    positions: Position[];
    totalUnrealizedPnl: number;
    availableCash: number;
  }>;
  lastUpdated: string;
}

interface ModelOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  api_model: string;
}

const formatCurrencySafe = (value: number | null | undefined) =>
  value == null ? '—' : formatCurrency(value);

const POSITION_ROLLING_EPSILON = 1e-6;
const POSITIONS_REFRESH_INTERVAL_MS = 2000;

export function PositionsTab() {
  const [data, setData] = useState<PositionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [popoverState, setPopoverState] = useState<{
    isOpen: boolean;
    exitPlan: ExitPlan | null;
    symbol: string;
    side: 'LONG' | 'SHORT';
    anchorEl: HTMLElement | null;
  }>({ isOpen: false, exitPlan: null, symbol: '', side: 'LONG', anchorEl: null });
  const previousValuesRef = useRef<{
    notional: Map<string, number>;
    unrealized: Map<string, number>;
    totalUnrealized: Map<string, number>;
    availableCash: Map<string, number>;
  }>({
    notional: new Map(),
    unrealized: new Map(),
    totalUnrealized: new Map(),
    availableCash: new Map(),
  });

  useEffect(() => {
    fetchModels();
    fetchPositions();
  }, [selectedModel]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const refreshPositions = () => {
      if (document.visibilityState === 'visible') {
        fetchPositions({ showLoading: false });
      }
    };

    const intervalId = window.setInterval(
      refreshPositions,
      POSITIONS_REFRESH_INTERVAL_MS
    );

    document.addEventListener('visibilitychange', refreshPositions);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshPositions);
    };
  }, [selectedModel]);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      const filteredModels = data.models as ModelOption[] | undefined;
      if (filteredModels) {
        setModels(filteredModels.map((model) => applyModelUIOverrides(model)));
      }
    } catch (err) {
      console.error('Error fetching models:', err);
    }
  };

  const fetchPositions = async (options?: { showLoading?: boolean }) => {
    const shouldShowLoading = options?.showLoading ?? true;
    try {
      if (shouldShowLoading) {
        setLoading(true);
      }
      const url = selectedModel === 'all'
        ? '/api/positions'
        : `/api/positions?modelId=${selectedModel}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      const positionsByModel = data.positionsByModel || {};
      const normalizedPositionsByModel = Object.fromEntries(
        Object.entries(positionsByModel).map(([modelId, modelData]: [string, any]) => [
          modelId,
          {
            ...modelData,
            model: applyModelUIOverrides(modelData.model),
          },
        ])
      );
      setData({
        positionsByModel: normalizedPositionsByModel,
        lastUpdated: data.lastUpdated,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    const { notional, unrealized, totalUnrealized, availableCash } = previousValuesRef.current;
    const activePositionIds = new Set<string>();
    const activeModelIds = new Set<string>();

    Object.values(data.positionsByModel).forEach((modelData) => {
      activeModelIds.add(modelData.model.id);
      totalUnrealized.set(modelData.model.id, modelData.totalUnrealizedPnl);
      availableCash.set(modelData.model.id, modelData.availableCash);

      modelData.positions.forEach((position) => {
        activePositionIds.add(position.id);
        notional.set(position.id, position.notionalValue);
        unrealized.set(position.id, position.unrealizedPnl);
      });
    });

    for (const positionId of Array.from(notional.keys())) {
      if (!activePositionIds.has(positionId)) {
        notional.delete(positionId);
        unrealized.delete(positionId);
      }
    }

    for (const modelId of Array.from(totalUnrealized.keys())) {
      if (!activeModelIds.has(modelId)) {
        totalUnrealized.delete(modelId);
        availableCash.delete(modelId);
      }
    }
  }, [data]);

  const getPositionData = () => {
    if (!data) return [];
    if (selectedModel === 'all') {
      return Object.values(data.positionsByModel);
    }
    return data.positionsByModel[selectedModel] ? [data.positionsByModel[selectedModel]] : [];
  };

  const totalUnrealizedPnl = getPositionData().reduce((sum, model) => sum + model.totalUnrealizedPnl, 0);
  const totalOpenPositions = getPositionData().reduce((sum, model) => sum + model.positions.length, 0);

  const handleViewExitPlan = (position: Position, event: React.MouseEvent<HTMLButtonElement>) => {
    if (position.exitPlan) {
      setPopoverState({
        isOpen: true,
        exitPlan: position.exitPlan,
        symbol: position.symbol,
        side: position.side,
        anchorEl: event.currentTarget
      });
    }
  };

  const closePopover = () => {
    setPopoverState({ isOpen: false, exitPlan: null, symbol: '', side: 'LONG', anchorEl: null });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-48" />
                <div className="h-32 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading positions: {error}</p>
        <button
          onClick={() => fetchPositions()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const positionData = getPositionData();

  return (
    <div className="space-y-4">
      {/* Header with Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">FILTER:</span>
        <ModelFilterDropdown
          models={models}
          selectedModelId={selectedModel}
          onSelectModel={setSelectedModel}
        />
      </div>

      {/* Position Cards */}
      <div className="space-y-4">
        {positionData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No open positions found.</p>
            <p className="text-sm">AI models will start opening positions as they begin trading.</p>
          </div>
        ) : (
          positionData.map((modelData) => {
            const previousTotalUnrealized =
              previousValuesRef.current.totalUnrealized.get(modelData.model.id) ?? null;
            const previousAvailableCash =
              previousValuesRef.current.availableCash.get(modelData.model.id) ?? null;
            return (
              <div key={modelData.model.id} className="bg-card rounded-lg border overflow-hidden">
              {/* Model Header */}
              <div className="px-3 py-1.5 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ModelLogo apiModel={modelData.model.api_model} fallbackIcon={modelData.model.icon} size={16} />
                    <div className="max-w-[140px]">
                      <h3 className="text-xs font-bold uppercase tracking-wide leading-tight" style={{ color: modelData.model.color }}>
                        {modelData.model.name}
                      </h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                      Total Unrealized P&L:
                    </div>
                    <RollingNumber
                      value={modelData.totalUnrealizedPnl}
                      previousValue={previousTotalUnrealized}
                      formatter={formatCurrencySafe}
                      epsilon={POSITION_ROLLING_EPSILON}
                      className={cn(
                        'text-xs font-bold',
                        modelData.totalUnrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600',
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Positions Table */}
              {modelData.positions.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '19%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '21%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '21%' }} />
                      </colgroup>
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="pl-3 pr-1.5 py-1 text-left text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            Side
                          </th>
                          <th className="px-1.5 py-1 text-left text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            Coin
                          </th>
                          <th className="px-1.5 py-1 text-left text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            Lev.
                          </th>
                          <th className="pl-1.5 pr-1 py-1 text-left text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            Notional
                          </th>
                          <th className="px-1.5 py-1 text-left text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            Exit Plan
                          </th>
                          <th className="px-1.5 py-1 text-left text-[9px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">
                            Unreal<br />P&L
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {modelData.positions.map((position) => {
                          const previousNotional =
                            previousValuesRef.current.notional.get(position.id) ?? null;
                          const previousUnrealized =
                            previousValuesRef.current.unrealized.get(position.id) ?? null;

                          return (
                            <tr key={position.id} className="hover:bg-muted/50">
                            <td className="pl-3 pr-1.5 py-1">
                              <span
                                className={`text-[10px] font-bold ${
                                  position.side === 'LONG' ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {position.side}
                              </span>
                            </td>
                            <td className="px-1.5 py-1">
                              <div className="flex items-center space-x-1">
                                <CryptoLogo symbol={position.symbol} size={14} />
                                <span className="text-[10px] font-medium truncate">{getCryptoSymbolName(position.symbol)}</span>
                              </div>
                            </td>
                            <td className="px-1.5 py-1">
                              <span className="font-mono text-[10px]">{position.leverage}x</span>
                            </td>
                            <td className="pl-1.5 pr-1 py-1">
                              <span className="block truncate">
                                <RollingNumber
                                  value={position.notionalValue}
                                  previousValue={previousNotional}
                                  formatter={formatCurrencySafe}
                                  epsilon={POSITION_ROLLING_EPSILON}
                                  className="font-mono text-[10px]"
                                />
                              </span>
                            </td>
                            <td className="px-1.5 py-1">
                              <button 
                                onClick={(e) => handleViewExitPlan(position, e)}
                                disabled={!position.exitPlan}
                                className="rounded border border-transparent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary transition-colors hover:border-primary/30 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                VIEW
                              </button>
                            </td>
                            <td className="px-1.5 py-1">
                              <span className="block truncate">
                                <RollingNumber
                                  value={position.unrealizedPnl}
                                  previousValue={previousUnrealized}
                                  formatter={formatCurrencySafe}
                                  epsilon={POSITION_ROLLING_EPSILON}
                                  className={cn(
                                    'font-mono text-[10px] font-bold',
                                    position.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600',
                                  )}
                                />
                              </span>
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 px-4 pb-4 md:hidden">
                    {modelData.positions.map((position) => {
                      const previousNotional =
                        previousValuesRef.current.notional.get(position.id) ?? null;
                      const previousUnrealized =
                        previousValuesRef.current.unrealized.get(position.id) ?? null;

                      return (
                        <div
                          key={position.id}
                          className="rounded-lg border border-border bg-card/80 p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <CryptoLogo symbol={position.symbol} size={28} />
                              <div>
                                <div className="text-sm font-semibold text-foreground">
                                  {getCryptoSymbolName(position.symbol)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Leverage <span className="font-mono">{position.leverage}x</span>
                                </div>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                position.side === 'LONG'
                                  ? 'bg-green-500/10 text-green-600'
                                  : 'bg-red-500/10 text-red-600'
                              }`}
                            >
                              {position.side === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {position.side}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-muted-foreground">
                            <div>
                              <span className="uppercase tracking-wide">Notional</span>
                              <RollingNumber
                                value={position.notionalValue}
                                previousValue={previousNotional}
                                formatter={formatCurrencySafe}
                                epsilon={POSITION_ROLLING_EPSILON}
                                className="font-mono text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <span className="uppercase tracking-wide">Unrealized P&L</span>
                              <RollingNumber
                                value={position.unrealizedPnl}
                                previousValue={previousUnrealized}
                                formatter={formatCurrencySafe}
                                epsilon={POSITION_ROLLING_EPSILON}
                                className={cn(
                                  'font-mono text-sm font-semibold',
                                  position.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600',
                                )}
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col gap-2">
                            <button
                              onClick={(e) => handleViewExitPlan(position, e)}
                              disabled={!position.exitPlan}
                              className="w-full rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              View Exit Plan
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Available Cash */}
              <div className="px-3 py-1.5 bg-muted/30 border-t border-border">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Available Cash:</span>
                  <RollingNumber
                    value={modelData.availableCash}
                    previousValue={previousAvailableCash}
                    formatter={formatCurrencySafe}
                    epsilon={POSITION_ROLLING_EPSILON}
                    className="font-mono font-medium"
                  />
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground">
        Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
      </div>

      {/* Exit Plan Popover */}
      {popoverState.exitPlan && (
        <ExitPlanPopover
          isOpen={popoverState.isOpen}
          onClose={closePopover}
          exitPlan={popoverState.exitPlan}
          symbol={popoverState.symbol}
          side={popoverState.side}
          anchorEl={popoverState.anchorEl}
        />
      )}
    </div>
  );
}

/**
 * CryptoLogo Component
 * Displays cryptocurrency logo with fallback to emoji
 */
function CryptoLogo({ 
  symbol, 
  size = 24 
}: { 
  symbol: string; 
  size?: number;
}) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = getCryptoLogo(symbol, { size });
  const fallbackEmoji = getCryptoEmoji(symbol);
  
  const style = {
    width: `${size}px`,
    height: `${size}px`,
    maxWidth: `${size}px`,
    maxHeight: `${size}px`
  };

  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  if (!logoUrl || imageError) {
    return <span className="text-lg" style={{ fontSize: size }}>{fallbackEmoji}</span>;
  }

  return (
    <Image
      src={logoUrl}
      alt={`${getCryptoSymbolName(symbol)} logo`}
      width={size}
      height={size}
      className={cn(
        'rounded-full object-contain',
        shouldInvertCryptoLogo(symbol) && 'invert-on-dark'
      )}
      style={style}
      onError={() => setImageError(true)}
      unoptimized
      loading="lazy"
    />
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
    'rounded-md object-contain',
    shouldInvertAIModelLogo(apiModel) && 'invert-on-dark'
  );
  
  const style = {
    width: `${adjustedSize}px`,
    height: `${adjustedSize}px`,
    maxWidth: `${adjustedSize}px`,
    maxHeight: `${adjustedSize}px`
  };

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
      style={style}
      onError={() => setImageError(true)}
      unoptimized
      loading="lazy"
    />
  );
}

/**
 * COMPLETED TRADES Tab
 * Shows trade history with performance metrics
 */

'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Trade, Model } from '@/lib/supabase';
import { ModelFilterDropdown } from '@/components/ui/ModelFilterDropdown';
import {
  getAIModelLogo,
  getCryptoEmoji,
  getCryptoLogo,
  getCryptoSymbolName,
  shouldInvertAIModelLogo,
  shouldInvertCryptoLogo,
} from '@/lib/utils/logos';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

interface TradesData {
  trades: (Trade & { model: Model })[];
  lastUpdated: string;
}

interface ModelOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  api_model: string;
}

export function TradesTab() {
  const [data, setData] = useState<TradesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    fetchModels();
    fetchTrades();
  }, [selectedModel]);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      const filteredModels = data.models as ModelOption[];
      setModels(filteredModels.map((model) => applyModelUIOverrides(model)));
    } catch (err) {
      console.error('Error fetching models:', err);
    }
  };

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const url = selectedModel === 'all'
        ? '/api/trades'
        : `/api/trades?modelId=${selectedModel}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      const normalizedTrades = data.trades.map((trade: Trade & { model: Model }) => ({
        ...trade,
        model: applyModelUIOverrides(trade.model),
      }));
      setData({
        trades: normalizedTrades,
        lastUpdated: data.lastUpdated,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatHoldingTime = (ms: number | undefined) => {
    if (!ms) return '-';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}H ${minutes}M`;
    }
    return `${minutes}M`;
  };

  if (loading) {
    return (
      <div className="space-y-3 pb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card rounded border border-border p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-destructive mb-3">Failed to load trades</p>
        <button
          onClick={fetchTrades}
          className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-2 border-b border-border pb-3 mb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">Filter:</span>
            <ModelFilterDropdown
              models={models}
              selectedModelId={selectedModel}
              onSelectModel={setSelectedModel}
            />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Showing Last {data.trades.length} Trades
          </div>
        </div>
      </div>

      {/* Trade Cards */}
      <div className="space-y-2">
        {data.trades.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="mb-2 text-4xl">📊</div>
            <p className="text-sm font-medium">No completed trades yet</p>
            <p className="text-xs mt-1">Trades will appear here once AI models close positions</p>
          </div>
        ) : (
          data.trades.map((trade) => {
            const entryDate = new Date(trade.entry_time);
            const exitDate = trade.exit_time ? new Date(trade.exit_time) : entryDate;
            const modelLogo = getAIModelLogo(trade.model.api_model);
            const cryptoLogo = getCryptoLogo(trade.symbol);
            const cryptoEmoji = getCryptoEmoji(trade.symbol);
            const cryptoName = getCryptoSymbolName(trade.symbol);
            const isETH = trade.symbol.toUpperCase().includes('ETH');
            const exitPrice = trade.exit_price ?? trade.entry_price;
            const netPnl = trade.net_pnl ?? (exitPrice - trade.entry_price) * trade.quantity;
            const isDeepSeek = trade.model.api_model?.toLowerCase().includes('deepseek');

            return (
              <div
                key={trade.id}
                className="rounded border border-border bg-card px-4 py-3 transition-shadow hover:shadow-sm"
              >
                {/* Header: Model + Trade Summary */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {/* Model Logo */}
                    {modelLogo ? (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Image
                          src={modelLogo}
                          alt={trade.model.name}
                          width={isDeepSeek ? 20 : 18}
                          height={isDeepSeek ? 20 : 18}
                          className={cn(
                            isDeepSeek ? 'h-5 w-5' : 'h-[18px] w-[18px]',
                            'object-contain',
                            shouldInvertAIModelLogo(trade.model.api_model) && 'invert-on-dark'
                          )}
                          unoptimized
                        />
                      </div>
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm">
                        {trade.model.icon}
                      </span>
                    )}

                    {/* Trade Summary */}
                    <div className="min-w-0 leading-snug">
                      <div className="text-[13px] text-foreground">
                        <span className="font-semibold" style={{ color: trade.model.color }}>
                          {trade.model.name}
                        </span>{' '}
                        <span className="text-muted-foreground">completed a</span>{' '}
                        <span className={trade.side === 'LONG' ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
                          {trade.side.toLowerCase()}
                        </span>{' '}
                        <span className="text-muted-foreground">trade on</span>{' '}
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {cryptoLogo ? (
                            <Image
                              src={cryptoLogo}
                              alt={cryptoName}
                              width={isETH ? 11 : 14}
                              height={isETH ? 11 : 14}
                              className={cn(
                                isETH ? 'h-[11px] w-[11px]' : 'h-[14px] w-[14px]',
                                'object-contain inline-block',
                                shouldInvertCryptoLogo(trade.symbol) && 'invert-on-dark'
                              )}
                              unoptimized
                            />
                          ) : (
                            <span className="text-sm">{cryptoEmoji}</span>
                          )}
                          {cryptoName}!
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
                    {exitDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })},{' '}
                    {exitDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>

                {/* Trade Details */}
                <div className="space-y-1 text-[12px] leading-relaxed text-foreground font-mono">
                  <div>
                    <span className="text-muted-foreground">Price:</span>{' '}
                    <span className="font-semibold">{formatCurrency(trade.entry_price)}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-semibold">{formatCurrency(exitPrice)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantity:</span>{' '}
                    <span className="font-semibold">{trade.quantity.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Notional:</span>{' '}
                    <span className="font-semibold">{formatCurrency(trade.notional_value)}</span>
                    {trade.exit_price && (
                      <>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-semibold">{formatCurrency(trade.exit_price * trade.quantity)}</span>
                      </>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Holding time:</span>{' '}
                    <span className="font-semibold">{formatHoldingTime(trade.holding_time_ms)}</span>
                  </div>
                </div>

                {/* P&L - Prominent */}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="font-mono text-[13px]">
                    <span className="text-foreground font-semibold">NET P&L: </span>
                    <span className={cn(
                      'text-[16px] font-bold',
                      netPnl >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {netPnl >= 0 ? '' : '-'}{formatCurrency(Math.abs(netPnl))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Trade Feed Panel
 * Live feed of recent trades displayed on the right side
 */

'use client';

import { useState, useEffect } from 'react';
import { formatTimeAgo, formatCurrency } from '@/lib/utils';
import { Trade, Model } from '@/lib/supabase';
import { getCryptoLogo, getCryptoEmoji, getCryptoSymbolName } from '@/lib/utils/logos';
import Image from 'next/image';

interface TradeFeedData {
  trades: (Trade & { model: Model })[];
}

interface TradeWithModel extends Trade {
  model: Model;
}

export function TradeFeedPanel() {
  const [trades, setTrades] = useState<TradeWithModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('all');

  useEffect(() => {
    fetchTrades();
  }, [selectedModel]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const url = selectedModel === 'all'
        ? '/api/trades?limit=14'
        : `/api/trades?modelId=${selectedModel}&limit=14`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      setTrades(data.trades || []);
    } catch (err) {
      console.error('Error fetching trades:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculatePnL = (trade: TradeWithModel) => {
    if (trade.status === 'open' || !trade.exit_price) return null;
    
    const entryValue = trade.entry_price * trade.quantity;
    const exitValue = trade.exit_price * trade.quantity;
    const pnl = trade.side === 'LONG' 
      ? exitValue - entryValue 
      : entryValue - exitValue;
    
    return pnl - (trade.fees || 0);
  };

  const calculateHoldingTime = (trade: TradeWithModel) => {
    if (trade.status === 'open' || !trade.exit_time) return null;
    
    const entry = new Date(trade.entry_time);
    const exit = new Date(trade.exit_time);
    const diffMs = exit.getTime() - entry.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}H ${minutes}M`;
    return `${minutes}M`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Showing Last {trades.length} Trades
        </h3>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="text-xs px-2 py-1 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">ALL MODELS ▼</option>
        </select>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {trades.map((trade) => {
          const pnl = calculatePnL(trade);
          const holdingTime = calculateHoldingTime(trade);
          const isLong = trade.side === 'LONG';
          const isShort = trade.side === 'SHORT';

          return (
            <div
              key={trade.id}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-base">{trade.model.icon}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold" style={{ color: trade.model.color }}>
                        {trade.model.name}
                      </span>
                      <span className="text-xs text-muted-foreground">completed a</span>
                      <span className={`text-xs font-bold ${isLong ? 'text-green-600' : 'text-red-600'}`}>
                        {trade.side}
                      </span>
                      <span className="text-xs text-muted-foreground">trade on</span>
                    </div>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <CryptoLogo symbol={trade.symbol} size={16} />
                      <span className="text-xs font-medium">{getCryptoSymbolName(trade.symbol)}!</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {trade.exit_time ? formatTimeAgo(trade.exit_time) : 'Active'}
                </div>
              </div>

              {/* Trade Details */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Price:</span>
                  <span className="font-mono">
                    {formatCurrency(trade.entry_price)} → {trade.exit_price ? formatCurrency(trade.exit_price) : 'Open'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quantity:</span>
                  <span className="font-mono">{trade.quantity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Notional:</span>
                  <span className="font-mono">
                    {formatCurrency(trade.entry_price * trade.quantity)} → {trade.exit_price ? formatCurrency(trade.exit_price * trade.quantity) : 'Open'}
                  </span>
                </div>
                {holdingTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Holding time:</span>
                    <span className="font-mono">{holdingTime}</span>
                  </div>
                )}
              </div>

              {/* P&L */}
              {pnl !== null && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">NET P&L:</span>
                    <span className={`text-sm font-bold font-mono ${
                      pnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {trades.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No trades available yet
        </div>
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
  size = 16 
}: { 
  symbol: string; 
  size?: number;
}) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = getCryptoLogo(symbol, { size });
  const fallbackEmoji = getCryptoEmoji(symbol);

  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  if (!logoUrl || imageError) {
    return <span className="text-xs">{fallbackEmoji}</span>;
  }

  return (
    <Image
      src={logoUrl}
      alt={`${getCryptoSymbolName(symbol)} logo`}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setImageError(true)}
      unoptimized
      loading="lazy"
    />
  );
}

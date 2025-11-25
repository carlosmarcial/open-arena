// Core Types for Open Arena

export interface Model {
  id: string;
  name: string;
  icon: string;
  color: string;
  apiKey?: string;
  startingCapital: number;
  currentEquity: number;
  status: 'active' | 'paused' | 'stopped';
  createdAt: Date;
}

export interface Trade {
  id: string;
  modelId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  leverage: number;
  notionalValue: number;
  takeProfitPercent?: number | null;
  stopLossPercent?: number | null;
  maxHoldMinutes?: number | null;
  entryTime: Date;
  exitTime: Date | null;
  holdingTime: number | null; // in milliseconds
  netPnl: number | null;
  fees: number;
  status: 'open' | 'closed';
}

export interface ExitPlan {
  target?: number | null;
  stop?: number | null;
  invalidCondition: string;
}

export interface Position {
  id: string;
  modelId: string;
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  notionalValue: number;
  unrealizedPnl: number;
  takeProfitPercent?: number | null;
  stopLossPercent?: number | null;
  maxHoldMinutes?: number | null;
  exitPlan?: ExitPlan;
  lastUpdated: Date;
}

export interface ModelReasoning {
  id: string;
  modelId: string;
  tradeId: string | null;
  reasoningText: string;
  decision: string;
  confidence: number; // 0-100
  timestamp: Date;
}

export interface PerformanceSnapshot {
  id: string;
  modelId: string;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFees: number;
  tradeCount: number;
  timestamp: Date;
}

export interface LeaderboardEntry {
  rank: number;
  model: Model;
  totalPnl: number;
  pnlPercentage: number;
  fees: number;
  winRate: number;
  biggestWin: number;
  biggestLoss: number;
  sharpeRatio: number;
  tradeCount: number;
}

export interface AdvancedAnalytics extends LeaderboardEntry {
  avgTradeSize: number;
  medianTradeSize: number;
  avgHold: number; // in minutes
  medianHold: number; // in minutes
  percentLong: number;
  expectancy: number;
  medianLeverage: number;
  avgLeverage: number;
  avgConfidence: number;
  medianConfidence: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface Candlestick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: Date;
}

// Aster API Response Types
export interface AsterSymbol {
  symbol: string;
  pair: string;
  contractType: string;
  deliveryDate?: number;
  onboardDate: number;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quotePrecision: number;
}

export interface AsterOrderResponse {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: string;
  positionSide: string;
  stopPrice: string;
  workingType: string;
  priceProtect: boolean;
  origType: string;
  updateTime: number;
}

export interface AsterPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

export interface AsterBalance {
  accountAlias: string;
  asset: string;
  balance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

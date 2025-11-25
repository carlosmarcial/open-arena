import { createSignedParams, getHeaders } from './signature';
import type {
  AsterSymbol,
  AsterOrderResponse,
  AsterPosition,
  AsterBalance,
  MarketData,
  Candlestick,
  OrderBook,
} from '@/types';

export class AsterClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_ASTER_API_URL || 'https://fapi.asterdex.com';
  }

  /**
   * Make authenticated GET request
   */
  private async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const queryString = createSignedParams(params, this.apiSecret);
    const url = `${this.baseUrl}${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(this.apiKey),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Aster API Error: ${error.msg || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make authenticated POST request
   */
  private async post<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const queryString = createSignedParams(params, this.apiSecret);
    const url = `${this.baseUrl}${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(this.apiKey),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Aster API Error: ${error.msg || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make authenticated DELETE request
   */
  private async delete<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const queryString = createSignedParams(params, this.apiSecret);
    const url = `${this.baseUrl}${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(this.apiKey),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Aster API Error: ${error.msg || response.statusText}`);
    }

    return response.json();
  }

  // ========== Market Data Endpoints ==========

  /**
   * Test connectivity
   */
  async ping(): Promise<{}> {
    const response = await fetch(`${this.baseUrl}/fapi/v1/ping`);
    return response.json();
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<{ serverTime: number }> {
    const response = await fetch(`${this.baseUrl}/fapi/v1/time`);
    return response.json();
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(): Promise<{ symbols: AsterSymbol[] }> {
    const response = await fetch(`${this.baseUrl}/fapi/v1/exchangeInfo`);
    return response.json();
  }

  /**
   * Get 24hr ticker price change statistics
   */
  async get24hrTicker(symbol?: string): Promise<any> {
    const url = symbol
      ? `${this.baseUrl}/fapi/v1/ticker/24hr?symbol=${symbol}`
      : `${this.baseUrl}/fapi/v1/ticker/24hr`;
    const response = await fetch(url);
    return response.json();
  }

  /**
   * Get latest price for symbol(s)
   */
  async getPrice(symbol?: string): Promise<any> {
    const url = symbol
      ? `${this.baseUrl}/fapi/v1/ticker/price?symbol=${symbol}`
      : `${this.baseUrl}/fapi/v1/ticker/price`;
    const response = await fetch(url);
    return response.json();
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
    const response = await fetch(
      `${this.baseUrl}/fapi/v1/depth?symbol=${symbol}&limit=${limit}`
    );
    const data = await response.json();
    
    return {
      symbol,
      bids: data.bids.map(([price, quantity]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      asks: data.asks.map(([price, quantity]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Get candlestick data
   */
  async getCandlesticks(
    symbol: string,
    interval: string = '1h',
    limit: number = 100
  ): Promise<Candlestick[]> {
    const response = await fetch(
      `${this.baseUrl}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    const data = await response.json();
    
    return data.map((candle: any[]) => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  // ========== Account & Position Endpoints ==========

  /**
   * Get account balance
   */
  async getBalance(): Promise<AsterBalance[]> {
    return this.get<AsterBalance[]>('/fapi/v2/balance');
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    return this.get('/fapi/v4/account');
  }

  /**
   * Get current positions
   */
  async getPositions(symbol?: string): Promise<AsterPosition[]> {
    const params = symbol ? { symbol } : {};
    return this.get<AsterPosition[]>('/fapi/v2/positionRisk', params);
  }

  // ========== Order Endpoints ==========

  /**
   * Place a new order
   */
  async placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'TAKE_PROFIT';
    quantity: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    reduceOnly?: boolean;
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  }): Promise<AsterOrderResponse> {
    return this.post<AsterOrderResponse>('/fapi/v1/order', params);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<AsterOrderResponse> {
    return this.delete<AsterOrderResponse>('/fapi/v1/order', { symbol, orderId });
  }

  /**
   * Cancel all open orders
   */
  async cancelAllOrders(symbol: string): Promise<any> {
    return this.delete('/fapi/v1/allOpenOrders', { symbol });
  }

  /**
   * Get order status
   */
  async getOrder(symbol: string, orderId: number): Promise<AsterOrderResponse> {
    return this.get<AsterOrderResponse>('/fapi/v1/order', { symbol, orderId });
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<AsterOrderResponse[]> {
    const params = symbol ? { symbol } : {};
    return this.get<AsterOrderResponse[]>('/fapi/v1/openOrders', params);
  }

  /**
   * Get all orders (historical)
   */
  async getAllOrders(symbol: string, limit: number = 500): Promise<AsterOrderResponse[]> {
    return this.get<AsterOrderResponse[]>('/fapi/v1/allOrders', { symbol, limit });
  }

  // ========== Leverage & Margin Endpoints ==========

  /**
   * Change leverage
   */
  async changeLeverage(symbol: string, leverage: number): Promise<any> {
    return this.post('/fapi/v1/leverage', { symbol, leverage });
  }

  /**
   * Change margin type
   */
  async changeMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<any> {
    return this.post('/fapi/v1/marginType', { symbol, marginType });
  }

  /**
   * Get trade history
   */
  async getTradeHistory(symbol: string, limit: number = 500): Promise<any[]> {
    return this.get<any[]>('/fapi/v1/userTrades', { symbol, limit });
  }

  // ========== Derivatives Data (Public) ==========

  /**
   * Get premium index (includes mark price and last funding rate)
   * Compatible with Binance-style endpoint
   */
  async getPremiumIndex(symbol: string): Promise<{ symbol: string; markPrice?: string; lastFundingRate?: string }> {
    const url = `${this.baseUrl}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch premiumIndex for ${symbol}`);
    }
    return res.json();
  }

  /**
   * Get current open interest for a symbol
   */
  async getOpenInterest(symbol: string): Promise<{ openInterest: string }> {
    const url = `${this.baseUrl}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch openInterest for ${symbol}`);
    }
    return res.json();
  }

  /**
   * Get historical open interest to compute averages (if supported)
   * Falls back to latest-only if endpoint not available
   */
  async getOpenInterestHist(symbol: string, period: string = '5m', limit: number = 10): Promise<number[]> {
    try {
      const url = `${this.baseUrl}/futures/data/openInterestHist?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('openInterestHist not available');
      const data = await res.json();
      // Binance-style returns objects with sumOpenInterest
      return Array.isArray(data)
        ? data.map((d: any) => parseFloat(d.sumOpenInterest)).filter((n: number) => Number.isFinite(n))
        : [];
    } catch {
      // Graceful fallback
      const latest = await this.getOpenInterest(symbol);
      const v = parseFloat(latest.openInterest);
      return Number.isFinite(v) ? Array(limit).fill(v) : [];
    }
  }
}

// Singleton instance
let asterClient: AsterClient | null = null;

export function getAsterClient(): AsterClient {
  if (!asterClient) {
    const apiKey = process.env.ASTER_API_KEY;
    const apiSecret = process.env.ASTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Aster API credentials not configured');
    }

    asterClient = new AsterClient(apiKey, apiSecret);
  }

  return asterClient;
}

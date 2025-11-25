/**
 * Aster WebSocket Client
 * Handles real-time market data streams from wss://fstream.asterdex.com
 */

type StreamCallback = (data: any) => void;
type ErrorCallback = (error: Error) => void;

export class AsterWebSocket {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private subscriptions: Map<string, StreamCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private onError?: ErrorCallback;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_ASTER_WS_URL || 'wss://fstream.asterdex.com';
  }

  /**
   * Connect to WebSocket
   */
  connect(streams: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build URL with combined streams
        const streamPath = streams.length > 0
          ? `/stream?streams=${streams.join('/')}`
          : '/ws';

        this.ws = new WebSocket(`${this.baseUrl}${streamPath}`);

        this.ws.onopen = () => {
          console.log('✅ Aster WebSocket connected');
          this.reconnectAttempts = 0;
          this.startPing();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          if (this.onError) {
            this.onError(new Error('WebSocket connection error'));
          }
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          this.stopPing();
          this.attemptReconnect(streams);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any) {
    // Handle combined stream format
    if (data.stream && data.data) {
      const callbacks = this.subscriptions.get(data.stream);
      if (callbacks) {
        callbacks.forEach(cb => cb(data.data));
      }
    } else {
      // Single stream format - notify all subscribers
      this.subscriptions.forEach((callbacks) => {
        callbacks.forEach(cb => cb(data));
      });
    }
  }

  /**
   * Subscribe to a stream
   */
  subscribe(streamName: string, callback: StreamCallback) {
    const callbacks = this.subscriptions.get(streamName) || [];
    callbacks.push(callback);
    this.subscriptions.set(streamName, callbacks);

    // If already connected, send subscribe message
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe([streamName]);
    }
  }

  /**
   * Unsubscribe from a stream
   */
  unsubscribe(streamName: string, callback?: StreamCallback) {
    if (!callback) {
      // Remove all callbacks for this stream
      this.subscriptions.delete(streamName);
      this.sendUnsubscribe([streamName]);
    } else {
      // Remove specific callback
      const callbacks = this.subscriptions.get(streamName);
      if (callbacks) {
        const filtered = callbacks.filter(cb => cb !== callback);
        if (filtered.length === 0) {
          this.subscriptions.delete(streamName);
          this.sendUnsubscribe([streamName]);
        } else {
          this.subscriptions.set(streamName, filtered);
        }
      }
    }
  }

  /**
   * Send subscribe message
   */
  private sendSubscribe(streams: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      }));
    }
  }

  /**
   * Send unsubscribe message
   */
  private sendUnsubscribe(streams: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: streams,
        id: Date.now(),
      }));
    }
  }

  /**
   * Start ping interval (keep-alive)
   */
  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 180000); // 3 minutes (180 seconds)
  }

  /**
   * Stop ping interval
   */
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(streams: string[]) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(streams).catch(console.error);
    }, delay);
  }

  /**
   * Set error handler
   */
  setErrorHandler(handler: ErrorCallback) {
    this.onError = handler;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ========== Helper Functions for Common Streams ==========

/**
 * Subscribe to aggregate trade stream
 */
export function subscribeToTrades(
  ws: AsterWebSocket,
  symbol: string,
  callback: StreamCallback
) {
  const stream = `${symbol.toLowerCase()}@aggTrade`;
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to mark price stream (1s updates)
 */
export function subscribeToMarkPrice(
  ws: AsterWebSocket,
  symbol: string,
  callback: StreamCallback
) {
  const stream = `${symbol.toLowerCase()}@markPrice@1s`;
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to all market mark prices
 */
export function subscribeToAllMarkPrices(
  ws: AsterWebSocket,
  callback: StreamCallback
) {
  const stream = '!markPrice@arr@1s';
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to order book depth (100ms updates)
 */
export function subscribeToOrderBook(
  ws: AsterWebSocket,
  symbol: string,
  levels: 5 | 10 | 20 = 20,
  callback: StreamCallback
) {
  const stream = `${symbol.toLowerCase()}@depth${levels}@100ms`;
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to kline/candlestick stream
 */
export function subscribeToKlines(
  ws: AsterWebSocket,
  symbol: string,
  interval: string = '1m',
  callback: StreamCallback
) {
  const stream = `${symbol.toLowerCase()}@kline_${interval}`;
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to 24hr ticker
 */
export function subscribeToTicker(
  ws: AsterWebSocket,
  symbol: string,
  callback: StreamCallback
) {
  const stream = `${symbol.toLowerCase()}@ticker`;
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to all market tickers
 */
export function subscribeToAllTickers(
  ws: AsterWebSocket,
  callback: StreamCallback
) {
  const stream = '!ticker@arr';
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

/**
 * Subscribe to book ticker (best bid/ask)
 */
export function subscribeToBookTicker(
  ws: AsterWebSocket,
  symbol: string,
  callback: StreamCallback
) {
  const stream = `${symbol.toLowerCase()}@bookTicker`;
  ws.subscribe(stream, callback);
  return () => ws.unsubscribe(stream, callback);
}

// Singleton instance
let wsInstance: AsterWebSocket | null = null;

export function getAsterWebSocket(): AsterWebSocket {
  if (!wsInstance) {
    wsInstance = new AsterWebSocket();
  }
  return wsInstance;
}

/**
 * Symbol Precision Helper for Aster DEX
 * Rounds quantities to the correct decimal places per symbol
 */

// Aster DEX precision rules (most common perpetual futures)
export const SYMBOL_PRECISION: Record<string, number> = {
  'BTCUSDT': 3,    // BTC: 0.001 minimum
  'ETHUSDT': 2,    // ETH: 0.01 minimum  
  'SOLUSDT': 1,    // SOL: 0.1 minimum
  'BNBUSDT': 2,    // BNB: 0.01 minimum
  'DOGEUSDT': 0,   // DOGE: 1 minimum (integer)
  'SUIUSDT': 1,    // SUI: 0.1 minimum
};

/**
 * Rounds a quantity to the correct precision for a given symbol
 * Enforces minimum quantity based on precision (e.g., 0.001 for 3 decimals)
 */
export function roundQuantity(symbol: string, quantity: number): number {
  const precision = SYMBOL_PRECISION[symbol] ?? 3; // Default to 3 decimals
  const rounded = parseFloat(quantity.toFixed(precision));
  
  // Enforce minimum quantity based on precision
  const minQuantity = Math.pow(10, -precision); // e.g., 0.001 for precision=3
  
  if (rounded < minQuantity) {
    return minQuantity; // Return minimum instead of 0
  }
  
  return rounded;
}

/**
 * Calculates the minimum quantity for a symbol based on min notional
 */
export function getMinQuantity(symbol: string, price: number, minNotional: number = 5): number {
  const minQty = minNotional / price;
  return roundQuantity(symbol, minQty);
}

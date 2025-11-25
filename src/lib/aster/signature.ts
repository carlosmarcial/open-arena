import crypto from 'crypto';

/**
 * Generate HMAC SHA256 signature for Aster API requests
 * Based on Aster's authentication requirements
 */
export function generateSignature(
  queryString: string,
  apiSecret: string
): string {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

/**
 * Create query string with timestamp and signature
 */
export function createSignedParams(
  params: Record<string, string | number | boolean>,
  apiSecret: string
): string {
  // Add timestamp
  const timestamp = Date.now();
  const allParams: Record<string, string | number | boolean> = {
    ...params,
    timestamp,
  };

  // Sort and create query string
  const queryString = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  // Generate signature
  const signature = generateSignature(queryString, apiSecret);

  // Return final query string with signature
  return `${queryString}&signature=${signature}`;
}

/**
 * Generate headers for Aster API requests
 */
export function getHeaders(apiKey: string): Record<string, string> {
  return {
    'X-MBX-APIKEY': apiKey,
    'Content-Type': 'application/json',
  };
}

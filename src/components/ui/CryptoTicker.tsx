/**
 * Crypto Price Ticker
 * Displays live cryptocurrency prices in the header
 */

'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getCryptoEmoji, getCryptoLogo, shouldInvertCryptoLogo } from '@/lib/utils/logos';
import { RollingNumber } from './RollingNumber';

const TRACKED_ASSETS = [
  { symbol: 'BTC', pair: 'BTCUSDT' },
  { symbol: 'ETH', pair: 'ETHUSDT' },
  { symbol: 'SOL', pair: 'SOLUSDT' },
  { symbol: 'BNB', pair: 'BNBUSDT' },
  { symbol: 'DOGE', pair: 'DOGEUSDT' },
  { symbol: 'SUI', pair: 'SUIUSDT' },
] as const;

type AssetSymbol = (typeof TRACKED_ASSETS)[number]['symbol'];

interface CryptoPrice {
  symbol: AssetSymbol;
  price: number | null;
  previousPrice: number | null;
}

const ASTER_BASE_URL =
  process.env.NEXT_PUBLIC_ASTER_API_URL ?? 'https://fapi.asterdex.com';

const REFRESH_INTERVAL_MS = 2000; // 2 seconds - synced with dashboard
const PRICE_EPSILON = 1e-8;

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatPrice(price: number | null): string {
  if (price == null) {
    return '—';
  }

  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }

  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type FetchResult = {
  symbol: AssetSymbol;
  price: number | null;
};

export function CryptoTicker() {
  const [prices, setPrices] = useState<CryptoPrice[]>(
    TRACKED_ASSETS.map((asset) => ({
      symbol: asset.symbol,
      price: null,
      previousPrice: null,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const fetchPrices = async () => {
      try {
        const fetchedResults: FetchResult[] = await Promise.all(
          TRACKED_ASSETS.map(async (asset) => {
            try {
              const response = await fetch(
                `${ASTER_BASE_URL}/fapi/v1/ticker/price?symbol=${asset.pair}`,
                { cache: 'no-store' },
              );

              if (!response.ok) {
                throw new Error(
                  `Failed to fetch ${asset.symbol} price (${response.status})`,
                );
              }

              const data = await response.json();
              const resolvedPrice =
                parsePrice((data as { price?: unknown }).price) ??
                parsePrice((data as { lastPrice?: unknown }).lastPrice);

              return { symbol: asset.symbol, price: resolvedPrice };
            } catch (innerError) {
              console.error(`Failed to fetch ${asset.symbol} price`, innerError);
              return { symbol: asset.symbol, price: null };
            }
          }),
        );

        if (!isMounted) {
          return;
        }

        setPrices((previous) =>
          TRACKED_ASSETS.map((asset) => {
            const prevEntry =
              previous.find((item) => item.symbol === asset.symbol) ?? null;
            const fetchedEntry =
              fetchedResults.find((item) => item.symbol === asset.symbol) ?? null;

            if (!fetchedEntry || fetchedEntry.price == null) {
              return (
                prevEntry ?? {
                  symbol: asset.symbol,
                  price: null,
                  previousPrice: null,
                }
              );
            }

            const hasChanged =
              prevEntry?.price == null
                ? true
                : Math.abs(fetchedEntry.price - prevEntry.price) > PRICE_EPSILON;

            if (!hasChanged && prevEntry) {
              // Sync previousPrice to current price to prevent false animations
              return {
                ...prevEntry,
                previousPrice: prevEntry.price,
              };
            }

            return {
              symbol: asset.symbol,
              price: fetchedEntry.price,
              previousPrice:
                prevEntry?.price ?? prevEntry?.previousPrice ?? null,
            };
          }),
        );

        setError(null);
      } catch (err) {
        console.error('Failed to load Aster prices', err);
        if (!isMounted) {
          return;
        }
        setError('Live prices temporarily unavailable');
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(fetchPrices, REFRESH_INTERVAL_MS);
        }
      }
    };

    fetchPrices();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <>
      {error && (
        <span className="sr-only" role="status" aria-live="polite">
          {error}
        </span>
      )}
      <div className="hidden items-stretch overflow-x-hidden text-muted-foreground md:flex">
        {prices.map((crypto, index) => (
          <div
            key={crypto.symbol}
            className="relative flex flex-col items-center px-4 whitespace-nowrap"
          >
            <div className="flex items-center justify-center space-x-2 text-[11px] font-semibold uppercase tracking-wide">
              <TickerLogo symbol={crypto.symbol} />
              <span>{crypto.symbol}</span>
            </div>
            <div className="mt-1 font-mono text-sm font-semibold text-foreground">
              <RollingNumber
                value={crypto.price}
                previousValue={crypto.previousPrice}
                formatter={formatPrice}
                epsilon={PRICE_EPSILON}
              />
            </div>
            {/* Vertical divider - shorter and semi-transparent */}
            {index !== prices.length - 1 && (
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-px bg-border"
                style={{ height: '70%', opacity: 0.65 }}
              />
            )}
          </div>
        ))}
      </div>
      <div
        className="grid w-full grid-cols-6 items-stretch text-muted-foreground md:hidden overflow-x-hidden gap-x-1 pl-2 pr-2"
        style={{
          paddingLeft: 'max(env(safe-area-inset-left), 0.5rem)',
          paddingRight: 'max(env(safe-area-inset-right), 0.25rem)',
        }}
      >
        {prices.map((crypto) => (
          <div
            key={crypto.symbol}
            className="flex flex-col items-center justify-center gap-0.5 px-0 py-1.5 text-center min-w-0"
          >
            <div className="flex items-center justify-center gap-0.5 text-[8px] font-semibold uppercase tracking-wide">
              <TickerLogo symbol={crypto.symbol} />
              <span>{crypto.symbol}</span>
            </div>
            <div className="font-mono text-[9px] font-semibold text-foreground">
              <RollingNumber
                value={crypto.price}
                previousValue={crypto.previousPrice}
                formatter={formatPrice}
                epsilon={PRICE_EPSILON}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TickerLogo({ symbol }: { symbol: string }) {
  const [imageError, setImageError] = useState(false);
  const logo = getCryptoLogo(symbol);
  const fallback = getCryptoEmoji(symbol);
  const invert = shouldInvertCryptoLogo(symbol);

  useEffect(() => {
    setImageError(false);
  }, [logo, symbol]);

  if (!logo || imageError) {
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <span className="text-sm">{fallback}</span>
      </span>
    );
  }

  const needsScale = symbol === 'ETH' || symbol === 'SUI';
  const className = `${needsScale ? 'h-4 w-4 scale-[0.7] object-contain' : 'h-4 w-4 object-contain'}${
    invert ? ' invert-on-dark' : ''
  }`;

  if (needsScale) {
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <Image
          src={logo}
          alt={`${symbol} logo`}
          width={16}
          height={16}
          className={className}
          onError={() => setImageError(true)}
          unoptimized
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <Image
      src={logo}
      alt={`${symbol} logo`}
      width={16}
      height={16}
      className={className}
      onError={() => setImageError(true)}
      unoptimized
      loading="lazy"
    />
  );
}

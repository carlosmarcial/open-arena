/**
 * AnimatedNumber Wrapper
 * Provides convenient format presets on top of the shared RollingNumber component.
 */

'use client';

import { RollingNumber } from './RollingNumber';
import { formatCurrency } from '@/lib/utils';

type AnimatedNumberFormat = 'currency' | 'percentage';

interface AnimatedNumberProps {
  value: number | null | undefined;
  previousValue?: number | null | undefined;
  format?: AnimatedNumberFormat;
  epsilon?: number;
}

const formatCurrencySafe = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return formatCurrency(value);
};

const formatPercentageSafe = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  const numeric = Number(value);
  const sign = Number.isNaN(numeric) ? '' : numeric >= 0 ? '+' : '';
  return `${sign}${numeric.toFixed(2)}%`;
};

const FORMATTERS: Record<AnimatedNumberFormat, (value: number | null | undefined) => string> = {
  currency: formatCurrencySafe,
  percentage: formatPercentageSafe,
};

const DEFAULT_EPSILON = 1e-6;

export function AnimatedNumber({
  value,
  previousValue,
  format = 'currency',
  epsilon = DEFAULT_EPSILON,
}: AnimatedNumberProps) {
  const formatter = FORMATTERS[format] ?? formatCurrencySafe;

  return (
    <RollingNumber
      value={value}
      previousValue={previousValue}
      formatter={formatter}
      epsilon={epsilon}
    />
  );
}

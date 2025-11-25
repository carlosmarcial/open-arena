'use client';

import { type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import styles from './RollingNumber.module.css';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Formatter = (value: number | null) => string;

export interface RollingNumberProps {
  value: number | null | undefined;
  previousValue?: number | null | undefined;
  formatter?: Formatter;
  epsilon?: number;
  cascadeDelayMs?: number;
  durationMs?: number;
  className?: string;
  style?: CSSProperties;
}

const isDigit = (char: string | undefined): char is string =>
  !!char && /\d/.test(char);

const defaultFormatter: Formatter = (value) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return String(value);
};

export function RollingNumber({
  value,
  previousValue,
  formatter = defaultFormatter,
  epsilon = 1e-8,
  cascadeDelayMs = 50,
  durationMs = 800,
  className,
  style,
}: RollingNumberProps) {
  const formattedRaw = formatter(value ?? null);
  const formatted = formattedRaw && formattedRaw.length > 0 ? formattedRaw : '—';
  const previousFormatted =
    previousValue === undefined ? undefined : formatter(previousValue ?? null);

  const shouldAnimate =
    previousFormatted !== undefined &&
    value != null &&
    previousValue != null &&
    typeof value === 'number' &&
    typeof previousValue === 'number' &&
    Number.isFinite(value) &&
    Number.isFinite(previousValue) &&
    Math.abs(value - previousValue) > epsilon;

  return (
    <span className={cn(styles.price, className)} style={style}>
      {formatted.split('').map((char, idx) => {
        if (!isDigit(char)) {
          const staticClass =
            char === '.' || char === ',' ? styles.separator : styles.prefix;

          return (
            <span key={`${char}-${idx}`} className={staticClass}>
              {char}
            </span>
          );
        }

        const previousChar = previousFormatted?.[idx];
        const currentDigit = parseInt(char, 10);
        const previousDigit = isDigit(previousChar)
          ? parseInt(previousChar, 10)
          : currentDigit;
        const hasChanged = shouldAnimate && currentDigit !== previousDigit;
        const delay = hasChanged ? idx * cascadeDelayMs : 0;

        return (
          <span key={`digit-${idx}`} className={styles.digitSlot}>
            <span
              className={styles.digitColumn}
              style={{
                transform: `translateY(-${currentDigit * 10}%)`,
                transitionDelay: `${delay}ms`,
                transitionDuration: hasChanged ? `${durationMs}ms` : '0ms',
              }}
            >
              {DIGITS.map((digit) => (
                <span key={digit} className={styles.digit}>
                  {digit}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

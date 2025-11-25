/**
 * Utilities for interpreting Aster position payloads.
 */

export function inferAsterPositionSide(position: {
  positionSide?: string | null;
  positionAmt?: string | number | null;
}): 'LONG' | 'SHORT' {
  const explicitSide = (position.positionSide ?? '').toUpperCase();
  if (explicitSide === 'LONG' || explicitSide === 'SHORT') {
    return explicitSide;
  }

  const amtRaw =
    typeof position.positionAmt === 'number'
      ? position.positionAmt
      : typeof position.positionAmt === 'string'
        ? parseFloat(position.positionAmt)
        : NaN;

  if (!Number.isFinite(amtRaw)) {
    return 'LONG';
  }

  // In one-way mode, positive amounts represent longs; negatives represent shorts.
  return amtRaw >= 0 ? 'LONG' : 'SHORT';
}

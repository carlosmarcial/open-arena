/**
 * Equity Curve Chart
 * Multi-line chart showing model performance over time using Visx
 */

'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveLinear } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { GridRows, GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { cn } from '@/lib/utils';
import { shouldInvertAIModelLogo } from '@/lib/utils/logos';
import { RollingNumber } from '../ui/RollingNumber';

export interface DataPoint {
  timestamp: Date;
  value: number;
}

export interface ModelSeries {
  modelId: string;
  modelName: string;
  logo: string | null;
  fallbackIcon: string;
  color: string;
  data: DataPoint[];
  currentValue: number;
  apiModel?: string;
  positionDirection?: 'LONG' | 'SHORT' | 'FLAT';  // Trading position direction
  positionCount?: number;  // Number of open positions
}

interface EquityCurveChartProps {
  data: ModelSeries[];
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  valueMode?: 'currency' | 'percentage';
  hoveredModelId?: string | null;
  onHoveredModelChange?: (modelId: string | null) => void;
}

type ChartSeries = ModelSeries & {
  displayData: DataPoint[];
  displayCurrentValue: number;
  displayBaseline: number | null;
};

const getLatestBadgeValue = (series: ChartSeries): number | null => {
  const lastPoint = series.displayData[series.displayData.length - 1];
  if (lastPoint && Number.isFinite(lastPoint.value)) {
    return lastPoint.value;
  }

  if (Number.isFinite(series.displayCurrentValue)) {
    return series.displayCurrentValue;
  }

  return null;
};

const BADGE_EPSILON = 1e-6;


export function EquityCurveChart({
  data,
  width,
  height,
  margin = { top: 30, right: 120, bottom: 40, left: 80 },
  valueMode = 'currency',
  hoveredModelId: hoveredModelIdProp,
  onHoveredModelChange,
}: EquityCurveChartProps) {
  const isCompact = width < 768;
  const chartMargin = isCompact ? { top: 30, right: 48, bottom: 40, left: 60 } : margin;
  const [internalHoveredModelId, setInternalHoveredModelId] = useState<string | null>(null);
  const isHoverControlled = hoveredModelIdProp !== undefined;
  const hoveredModelId = isHoverControlled ? (hoveredModelIdProp ?? null) : internalHoveredModelId;
  const setHoveredModelId = useCallback((next: string | null) => {
    if (!isHoverControlled) {
      setInternalHoveredModelId(next);
    }
    onHoveredModelChange?.(next);
  }, [isHoverControlled, onHoveredModelChange]);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const previousBadgeValuesRef = useRef<Map<string, number | null>>(new Map());
  const [userDomain, setUserDomain] = useState<{ min: number; max: number } | null>(null);
  const [userHasZoomed, setUserHasZoomed] = useState(false);
  const [userTimeDomain, setUserTimeDomain] = useState<{ start: number; end: number } | null>(null);
  const [userHasPanned, setUserHasPanned] = useState(false);
  const axisDragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startDomain: { min: number; max: number };
    startRange: number;
    anchorValue: number;
    anchorRatio: number;
  } | null>(null);
  const timePanStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTimeDomain: { start: number; end: number };
    startValueDomain: { min: number; max: number };
  } | null>(null);

  // Debug + testing toggles
  const ENABLE_STATIC_CROSSHAIR = false; // set to true to show a static vertical line for isolation testing
  const DEBUG = process.env.NODE_ENV !== 'production';
  const HOVER_TOLERANCE_PX = isCompact ? 14 : 18; // how close the cursor must be to a line to "select" it
  if (DEBUG) {
    // Unique build marker to verify recompilation in the browser console
    console.info('[EquityCurveChart] build timestamp:', new Date().toISOString());
  }

  const chartSeries = useMemo<ChartSeries[]>(() => {
    return data.map((series) => {
      const baseline = series.data[0]?.value ?? null;

      if (valueMode === 'percentage') {
        if (!baseline || baseline === 0) {
          return {
            ...series,
            displayData: series.data.map((point) => ({
              timestamp: new Date(point.timestamp),
              value: 0,
            })),
            displayCurrentValue: 0,
            displayBaseline: 0,
          };
        }

        const displayData = series.data.map((point) => ({
          timestamp: new Date(point.timestamp),
          value: ((point.value - baseline) / baseline) * 100,
        }));

        const displayCurrentValue = ((series.currentValue - baseline) / baseline) * 100;

        return {
          ...series,
          displayData,
          displayCurrentValue,
          displayBaseline: 0,
        };
      }

      // Create new Date objects to ensure clean data references
      return {
        ...series,
        displayData: series.data.map((point) => ({
          timestamp: new Date(point.timestamp),
          value: point.value,
        })),
        displayCurrentValue: series.currentValue,
        displayBaseline: baseline,
      };
    });
  }, [data, valueMode]);

  // Bounds
  const innerWidth = width - chartMargin.left - chartMargin.right;
  const innerHeight = height - chartMargin.top - chartMargin.bottom;

  // Slight horizontal offset to visually center chart within container
  const graphOffsetX = isCompact ? 16 : 24;

  // Accessors
  const getDate = (d: DataPoint) => d.timestamp;
  const getValue = (d: DataPoint) => d.value;

  // Linear interpolate a value for an arbitrary timestamp along a series (assumes time-ascending data)
  const getInterpolatedValueAt = useCallback((seriesData: DataPoint[], at: Date): number | null => {
    const n = seriesData.length;
    if (n === 0) return null;
    const atMs = at.getTime();
    const first = seriesData[0];
    const last = seriesData[n - 1];
    const t0 = getDate(first).getTime();
    const tN = getDate(last).getTime();
    if (atMs <= t0) return getValue(first);
    if (atMs >= tN) return getValue(last);

    // Binary search for right neighbor index hi such that t[hi-1] <= at < t[hi]
    let lo = 0;
    let hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      const tMid = getDate(seriesData[mid]).getTime();
      if (tMid <= atMs) lo = mid; else hi = mid;
    }
    const p1 = seriesData[lo];
    const p2 = seriesData[hi];
    const t1 = getDate(p1).getTime();
    const t2 = getDate(p2).getTime();
    const v1 = getValue(p1);
    const v2 = getValue(p2);
    const span = Math.max(1, t2 - t1);
    const ratio = (atMs - t1) / span;
    return v1 + (v2 - v1) * ratio;
  }, []);

  

  // Estimate badge widths to reserve minimal right-side space
  const priceFontSize = isCompact ? 8 : 10;
  const pricePadX = isCompact ? 4 : 8;
  const logoDiameter = isCompact ? 28 : 36; // h-7 (28px) / h-9 (36px)
  const gapBetween = isCompact ? 4 : 6; // gap-1 (4px) / gap-1.5 (6px)
  const canvasCtx = useMemo(() => {
    if (typeof document === 'undefined') return null as CanvasRenderingContext2D | null;
    const c = document.createElement('canvas');
    return c.getContext('2d');
  }, []);

  const estimatedBadgeWidths = useMemo(() => {
    const measure = (text: string) => {
      if (!canvasCtx) return text.length * (priceFontSize * 0.6);
      canvasCtx.font = `600 ${priceFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      return canvasCtx.measureText(text).width;
    };
    return chartSeries.map((series) => {
      const v = series.displayCurrentValue ?? 0;
      const text = valueMode === 'currency'
        ? `$${Number(v).toLocaleString()}`
        : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
      const textW = measure(text);
      const priceBadgeW = Math.ceil(textW) + pricePadX * 2;
      const totalW = logoDiameter + gapBetween + priceBadgeW;
      return { modelId: series.modelId, totalW };
    });
  }, [chartSeries, valueMode, isCompact, canvasCtx, priceFontSize, pricePadX, logoDiameter, gapBetween]);

  const maxBadgeWidth = useMemo(() => {
    const widths = estimatedBadgeWidths.map(b => b.totalW);
    return widths.length ? Math.max(...widths) : (isCompact ? 90 : 130);
  }, [estimatedBadgeWidths, isCompact]);

  // Scales
  const rightPad = Math.round(maxBadgeWidth + (isCompact ? 6 : 8));
  const defaultTimeDomain = useMemo(() => {
    const allTimes = chartSeries.flatMap(series => series.displayData.map((point) => getDate(point).getTime()));
    if (!allTimes.length) {
      const now = Date.now();
      return { start: now, end: now + 1 };
    }

    let minTime = Math.min(...allTimes);
    let maxTime = Math.max(...allTimes);

    if (minTime === maxTime) {
      maxTime = minTime + 60_000;
    }

    return { start: minTime, end: maxTime };
  }, [chartSeries]);

  const defaultDomain = useMemo(() => {
    const allValues = chartSeries.flatMap(series => series.displayData.map(getValue));
    if (allValues.length === 0) {
      return { min: 0, max: 1 };
    }

    const RECENT_FRACTION = 0.35;
    const MIN_RECENT_POINTS = 5;
    const recentValues = chartSeries.flatMap((series) => {
      const { displayData } = series;
      if (!displayData.length) return [];
      const takeCount = Math.max(
        MIN_RECENT_POINTS,
        Math.ceil(displayData.length * RECENT_FRACTION),
      );
      return displayData.slice(-takeCount).map(getValue);
    });

    const targetValues = recentValues.length > 0 ? recentValues : allValues;
    let minValue = Math.min(...targetValues);
    let maxValue = Math.max(...targetValues);
    const rawMinValue = minValue;
    const rawMaxValue = maxValue;

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return { min: 0, max: 1 };
    }

    const MIN_PADDING = valueMode === 'currency' ? 1.5 : 0.5;
    const PADDING_FRACTION = valueMode === 'currency' ? 0.2 : 0.15;

    const range = maxValue - minValue;
    const padding = range === 0
      ? Math.max(MIN_PADDING, Math.abs(maxValue || minValue) * 0.02 || MIN_PADDING)
      : Math.max(MIN_PADDING, range * PADDING_FRACTION);

    let domainMin = minValue - padding;
    let domainMax = maxValue + padding;

    if (valueMode === 'currency') {
      const FOCUS_MIN = 59;
      const FOCUS_MAX = 61;
      const FOCUS_TOLERANCE = 0.05;

      if (
        rawMinValue >= FOCUS_MIN - FOCUS_TOLERANCE &&
        rawMaxValue <= FOCUS_MAX + FOCUS_TOLERANCE
      ) {
        domainMin = FOCUS_MIN;
        domainMax = FOCUS_MAX;
      } else {
        domainMin = Math.min(domainMin, FOCUS_MIN);
        domainMax = Math.max(domainMax, FOCUS_MAX);
      }
    }

    if (!(domainMax > domainMin)) {
      const fallbackPadding = valueMode === 'currency' ? 1 : 0.1;
      domainMin -= fallbackPadding;
      domainMax += fallbackPadding;
    }

    return { min: domainMin, max: domainMax };
  }, [chartSeries, valueMode]);

  const { min: defaultMin, max: defaultMax } = defaultDomain;
  const defaultRange = Math.max(1e-6, defaultMax - defaultMin);
  const { start: defaultTimeStart, end: defaultTimeEnd } = defaultTimeDomain;
  const defaultTimeRange = Math.max(1, defaultTimeEnd - defaultTimeStart);

  useEffect(() => {
    if (!userHasZoomed) {
      setUserDomain((prev) => {
        if (prev && Math.abs(prev.min - defaultMin) < 1e-6 && Math.abs(prev.max - defaultMax) < 1e-6) {
          return prev;
        }
        return { min: defaultMin, max: defaultMax };
      });
    }
  }, [defaultMin, defaultMax, userHasZoomed]);

  useEffect(() => {
    if (!userHasPanned) {
      setUserTimeDomain((prev) => {
        if (prev && Math.abs(prev.start - defaultTimeStart) < 1 && Math.abs(prev.end - defaultTimeEnd) < 1) {
          return prev;
        }
        return { start: defaultTimeStart, end: defaultTimeEnd };
      });
    }
  }, [defaultTimeStart, defaultTimeEnd, userHasPanned]);

  const activeDomain = userDomain ?? defaultDomain;
  const domainMin = activeDomain.min;
  const domainMax = activeDomain.max;
  const axisOverlayHeight = Math.max(0, innerHeight);
  const axisInteractionWidth = Math.max(48, chartMargin.left + graphOffsetX);
  const activeTimeDomain = userTimeDomain ?? defaultTimeDomain;
  const chartWidth = Math.max(0, innerWidth - rightPad);

  const dateScale = useMemo(() => {
    return scaleTime({
      domain: [new Date(activeTimeDomain.start), new Date(activeTimeDomain.end)],
      range: [0, chartWidth],
    });
  }, [activeTimeDomain.end, activeTimeDomain.start, chartWidth]);

  const valueScale = useMemo(() => {
    return scaleLinear({
      domain: [domainMin, domainMax],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [domainMin, domainMax, innerHeight]);

  const baselineValue = chartSeries[0]?.displayBaseline ?? null;
  
  // Desired x-axis tick density (kept in sync for axis and grid)
  const xNumTicks = useMemo(() => {
    return Math.max(3, Math.min(8, Math.floor(Math.max(chartWidth, 1) / 140)));
  }, [chartWidth]);
  
  // Compute on-chart positions for badges (at the tip of each series line)
  const badgePositions = useMemo(() => {
    const positions = chartSeries.map((series) => {
      const last = series.displayData[series.displayData.length - 1] ?? null;
      if (!last) {
        console.log(`No data for ${series.modelName}`);
        return { modelId: series.modelId, x: 0, y: 0 };
      }
      
      const date = getDate(last);
      const value = getValue(last);
      
      // These are the scaled coordinates within the Group
      const scaledX = dateScale(date) ?? 0;
      const scaledY = valueScale(value) ?? 0;
      
      // Convert to absolute screen coordinates
      const absoluteX = chartMargin.left + graphOffsetX + scaledX;
      const absoluteY = chartMargin.top + scaledY;
      
      return { modelId: series.modelId, x: absoluteX, y: absoluteY };
    });
    return positions;
  }, [chartSeries, dateScale, valueScale, chartMargin, graphOffsetX]);

  const badgeStackRanks = useMemo(() => {
    const entries = chartSeries.map((series, index) => ({
      modelId: series.modelId,
      value: getLatestBadgeValue(series),
      index,
    }));

    entries.sort((a, b) => {
      const valueA = a.value ?? Number.NEGATIVE_INFINITY;
      const valueB = b.value ?? Number.NEGATIVE_INFINITY;
      if (valueA === valueB) {
        return a.index - b.index;
      }
      return valueB - valueA;
    });

    const rankMap = new Map<string, number>();
    entries.forEach((entry, rank) => {
      rankMap.set(entry.modelId, rank);
    });

    return rankMap;
  }, [chartSeries]);
  
  useEffect(() => {
    const map = previousBadgeValuesRef.current;
    const currentIds = new Set<string>();

    chartSeries.forEach((series) => {
      currentIds.add(series.modelId);
      map.set(series.modelId, getLatestBadgeValue(series));
    });

    for (const key of Array.from(map.keys())) {
      if (!currentIds.has(key)) {
        map.delete(key);
      }
    }
  }, [chartSeries]);

  const handleAxisPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    if (axisOverlayHeight <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.height) {
      return;
    }

    const startDomain = userDomain ?? { min: defaultMin, max: defaultMax };
    const startRange = Math.max(1e-6, startDomain.max - startDomain.min);

    const relativeY = event.clientY - rect.top;
    const clampedY = Math.max(0, Math.min(rect.height, relativeY));
    const anchorValue = valueScale.invert(clampedY);
    if (!Number.isFinite(anchorValue)) {
      return;
    }

    const anchorRatio = startRange === 0
      ? 0.5
      : Math.min(1, Math.max(0, (anchorValue - startDomain.min) / startRange));

    axisDragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startDomain,
      startRange,
      anchorValue,
      anchorRatio,
    };

    setUserHasZoomed(true);
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, [axisOverlayHeight, defaultMin, defaultMax, userDomain, valueScale]);

  const handleAxisPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = axisDragStateRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const deltaY = event.clientY - drag.startY;
    if (!Number.isFinite(deltaY)) {
      return;
    }

    const SENSITIVITY = 0.003;
    const zoomFactor = Math.exp(-deltaY * SENSITIVITY);

    const minRangeBase = Math.max(defaultRange * 0.02, valueMode === 'currency' ? 0.25 : 0.05);
    const maxRangeBase = Math.max(defaultRange * 8, drag.startRange * 4);

    let nextRange = drag.startRange / zoomFactor;
    if (!Number.isFinite(nextRange)) {
      return;
    }

    const minRange = Math.max(1e-6, minRangeBase);
    const maxRange = Math.max(minRange + 1e-6, maxRangeBase);
    nextRange = Math.max(minRange, Math.min(maxRange, nextRange));

    const anchorRatio = Number.isFinite(drag.anchorRatio) ? drag.anchorRatio : 0.5;
    const anchorValue = Number.isFinite(drag.anchorValue)
      ? drag.anchorValue
      : (drag.startDomain.min + drag.startDomain.max) / 2;

    const nextMin = anchorValue - anchorRatio * nextRange;
    const nextMax = nextMin + nextRange;

    setUserDomain({ min: nextMin, max: nextMax });
    event.preventDefault();
  }, [defaultRange, valueMode]);

  const handleAxisPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = axisDragStateRef.current;
    if (drag && event.pointerId === drag.pointerId) {
      axisDragStateRef.current = null;
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleAxisDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    axisDragStateRef.current = null;
    setUserDomain({ min: defaultMin, max: defaultMax });
    setUserHasZoomed(false);
  }, [defaultMin, defaultMax]);

  const handleChartPointerDown = useCallback((event: ReactPointerEvent<SVGRectElement>) => {
    const isRightButton = event.button === 2;
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!isRightButton && !hasModifier) {
      return;
    }
    if (chartWidth <= 0 || innerHeight <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    const startValueDomain = userDomain ?? { min: defaultMin, max: defaultMax };

    timePanStateRef.current = {
      pointerId: event.pointerId,
      startX,
      startY,
      startTimeDomain: { start: activeTimeDomain.start, end: activeTimeDomain.end },
      startValueDomain,
    };

    setUserHasPanned(true);
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, [activeTimeDomain.end, activeTimeDomain.start, chartWidth, innerHeight, userDomain, defaultMin, defaultMax]);

  const handleChartPointerMove = useCallback((event: ReactPointerEvent<SVGRectElement>) => {
    const pan = timePanStateRef.current;
    if (!pan || event.pointerId !== pan.pointerId) {
      return;
    }
    if (chartWidth <= 0 || innerHeight <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const deltaXPixels = currentX - pan.startX;
    const timeRange = Math.max(1, pan.startTimeDomain.end - pan.startTimeDomain.start);
    const deltaMs = (deltaXPixels / chartWidth) * timeRange;

    let nextTimeStart = pan.startTimeDomain.start - deltaMs;
    let nextTimeEnd = pan.startTimeDomain.end - deltaMs;

    const allowedTimePadding = Math.max(defaultTimeRange * 0.5, 60_000);
    const minTimeBound = defaultTimeStart - allowedTimePadding;
    const maxTimeBound = defaultTimeEnd + allowedTimePadding;

    if (nextTimeStart < minTimeBound) {
      const adjustment = minTimeBound - nextTimeStart;
      nextTimeStart += adjustment;
      nextTimeEnd += adjustment;
    }
    if (nextTimeEnd > maxTimeBound) {
      const adjustment = nextTimeEnd - maxTimeBound;
      nextTimeStart -= adjustment;
      nextTimeEnd -= adjustment;
    }

    const currentY = event.clientY - rect.top;
    const deltaYPixels = currentY - pan.startY;
    const valueRange = Math.max(1e-6, pan.startValueDomain.max - pan.startValueDomain.min);
    const deltaValue = (deltaYPixels / innerHeight) * valueRange;

    let nextValueMin = pan.startValueDomain.min + deltaValue;
    let nextValueMax = pan.startValueDomain.max + deltaValue;

    const allowedValuePadding = Math.max(defaultRange * 0.5, valueMode === 'currency' ? 5 : 1);
    const minValueBound = defaultMin - allowedValuePadding;
    const maxValueBound = defaultMax + allowedValuePadding;

    if (nextValueMin < minValueBound) {
      const adjustment = minValueBound - nextValueMin;
      nextValueMin += adjustment;
      nextValueMax += adjustment;
    }
    if (nextValueMax > maxValueBound) {
      const adjustment = nextValueMax - maxValueBound;
      nextValueMin -= adjustment;
      nextValueMax -= adjustment;
    }

    setUserTimeDomain({ start: nextTimeStart, end: nextTimeEnd });
    setUserDomain({ min: nextValueMin, max: nextValueMax });
    setUserHasZoomed(true);
    event.preventDefault();
  }, [chartWidth, innerHeight, defaultTimeEnd, defaultTimeRange, defaultTimeStart, defaultRange, defaultMin, defaultMax, valueMode]);

  const handleChartPointerEnd = useCallback((event: ReactPointerEvent<SVGRectElement>) => {
    const pan = timePanStateRef.current;
    if (pan && event.pointerId === pan.pointerId) {
      timePanStateRef.current = null;
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleChartDoubleClick = useCallback((event: ReactMouseEvent<SVGRectElement>) => {
    event.preventDefault();
    timePanStateRef.current = null;
    setUserTimeDomain({ start: defaultTimeStart, end: defaultTimeEnd });
    setUserHasPanned(false);
    setUserDomain({ min: defaultMin, max: defaultMax });
    setUserHasZoomed(false);
  }, [defaultMax, defaultMin, defaultTimeEnd, defaultTimeStart]);

  const handleChartContextMenu = useCallback((event: ReactMouseEvent<SVGRectElement>) => {
    event.preventDefault();
  }, []);

  const formatAxisValue = useMemo(() => {
    if (valueMode !== 'currency') {
      return (value: number) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(0)}%`;
    }

    const ticks = typeof valueScale.ticks === 'function' ? valueScale.ticks() : [];
    let minStep = Number.POSITIVE_INFINITY;

    for (let i = 1; i < ticks.length; i++) {
      const diff = Math.abs(ticks[i] - ticks[i - 1]);
      if (Number.isFinite(diff) && diff > 0) {
        minStep = Math.min(minStep, diff);
      }
    }

    if (!Number.isFinite(minStep) || minStep === Number.POSITIVE_INFINITY) {
      const span = Math.abs(domainMax - domainMin);
      minStep = Number.isFinite(span) && span > 0 ? span : 1;
    }

    const precision = minStep > 0
      ? Math.max(0, Math.min(4, Math.ceil(-Math.log10(minStep) + 1e-8)))
      : 0;

    return (value: number) =>
      `$${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })}`;
  }, [valueMode, valueScale, domainMax, domainMin]);

  // X-axis tick formatter: "Oct 22 17:48"
  const formatXAxisTick = (d: Date | number) => {
    const date = d instanceof Date ? d : new Date(d);
    // Use en-US to mirror Alpha Arena styling
    const parts = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
    }).format(date);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    return `${parts} ${time}`;
  };
  const formatBadgeValue = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }

    if (valueMode === 'currency') {
      return `$${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
  };

  // Handle mouse move for crosshair
  const handleMouseMove = (event: ReactMouseEvent<SVGRectElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    // Coordinates relative to the overlay rect (i.e., group-local)
    const xLocal = event.clientX - rect.left;
    const yLocal = event.clientY - rect.top;
    // Convert to absolute coordinates within the overall chart container
    const xAbs = chartMargin.left + graphOffsetX + xLocal;
    const yAbs = chartMargin.top + yLocal;
    setMousePosition({ x: xAbs, y: yAbs });

    // Determine which series is closest to the cursor at this x position
    const hoveredDate = dateScale.invert(Math.max(0, Math.min(xLocal, chartWidth)));
    let nearest: { id: string; dist: number } | null = null;

    for (const series of chartSeries) {
      if (!series.displayData.length) continue;
      // Compute the y on the line at the hovered x using linear interpolation
      const interpolated = getInterpolatedValueAt(series.displayData, hoveredDate);
      if (interpolated == null || Number.isNaN(interpolated)) continue;
      const yScaled = valueScale(interpolated);
      const dist = Math.abs(yScaled - yLocal);
      if (!nearest || dist < nearest.dist) {
        nearest = { id: series.modelId, dist };
      }
    }

    const nextHover = nearest && nearest.dist <= HOVER_TOLERANCE_PX ? nearest.id : null;
    if (nextHover !== hoveredModelId) setHoveredModelId(nextHover);

    if (process.env.NODE_ENV !== 'production') {
      // Sample logs to avoid spamming
      if ((Math.floor(xLocal) % 80) === 0) {
        console.debug('[EquityCurveChart] mouse', { xLocal, yLocal, xAbs, yAbs, hovered: nextHover });
      }
    }
  };

  const handleMouseLeave = () => {
    setMousePosition(null);
    setHoveredModelId(null);
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[EquityCurveChart] mouse leave');
    }
  };

  // Get values at mouse position for crosshair labels
  const crosshairValues = useMemo(() => {
  if (!mousePosition) return null;

  const xPos = mousePosition.x - chartMargin.left - graphOffsetX;
  const hoveredDate = dateScale.invert(Math.max(0, Math.min(xPos, chartWidth)));

    const values = chartSeries.map(series => {
    if (series.displayData.length === 0) return null;
  const baseline = false; // No baseline series

      // Use linear interpolation to match the curveLinear used by LinePath
  const interpolatedValue = getInterpolatedValueAt(series.displayData, hoveredDate);
  if (interpolatedValue == null || Number.isNaN(interpolatedValue)) return null;

  // Use EXACT same calculation as LinePath: y={(d) => valueScale(getValue(d)) ?? 0}
      const yCoord = valueScale(interpolatedValue);

  return {
  modelId: series.modelId,
  modelName: series.modelName,
  logo: series.logo,
  fallbackIcon: series.fallbackIcon,
    color: baseline ? 'hsl(var(--muted-foreground))' : series.color,
        value: interpolatedValue,
    y: yCoord ?? 0,
      };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

    return values;
  }, [mousePosition, chartSeries, dateScale, valueScale, chartMargin.left, graphOffsetX, chartWidth, getInterpolatedValueAt]);


  if (width < 10) return null;

  return (
    <div className="relative">
      <svg width={width} height={height} style={{ transition: 'none', animation: 'none' }}>
        <LinearGradient id="area-gradient" from="hsl(var(--primary))" to="hsl(var(--primary))" toOpacity={0.1} />
        <Group
          left={chartMargin.left + graphOffsetX}
          top={chartMargin.top}
          style={{ transition: 'none !important', animation: 'none !important' } as React.CSSProperties}>
          {/* Grid */}
          <GridRows
            scale={valueScale}
            width={chartWidth}
            stroke="hsl(var(--border) / 0.35)"
            strokeWidth={1}
            pointerEvents="none"
          />
          <GridColumns
            scale={dateScale}
            height={innerHeight}
            numTicks={xNumTicks}
            stroke="hsl(var(--border) / 0.35)"
            strokeWidth={1}
            pointerEvents="none"
          />

          {/* Baseline */}
          {baselineValue !== null && (
            <line
              x1={0}
              x2={chartWidth}
              y1={valueScale(baselineValue)}
              y2={valueScale(baselineValue)}
              stroke="hsl(var(--border) / 0.5)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}

          {/* Starting Capital Reference Line ($60) - only show in currency mode */}
          {valueMode === 'currency' && (
            <line
              x1={0}
              x2={chartWidth}
              y1={valueScale(60)}
              y2={valueScale(60)}
              stroke="hsl(var(--muted-foreground) / 0.3)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}

          {/* Lines for each model */}
          {chartSeries.map((series) => {
            const isHovered = hoveredModelId === series.modelId;
            const isOtherHovered = hoveredModelId && hoveredModelId !== series.modelId;
            const baseline = false; // No baseline series
            const strokeColor = baseline ? 'hsl(var(--muted-foreground))' : series.color;
            const strokeOpacity = isOtherHovered ? 0.2 : (baseline ? (isHovered ? 1 : 0.7) : 1);
            const width = isHovered ? 3 : (baseline ? 2 : 2.2);

            // Create a data signature based on actual data values to remount when data changes
            // Removed Date.now() to prevent unnecessary remounting on every render
            const dataSignature = series.displayData
              .slice(-5) // Use last 5 points for efficiency
              .map(d => `${d.timestamp.getTime()}_${d.value.toFixed(2)}`)
              .join('|');
            const uniqueKey = `line-${series.modelId}-${dataSignature}`;

            // Create fresh data array to force new object references
            const freshData = series.displayData.map(d => ({
              ...d,
              timestamp: new Date(d.timestamp.getTime())
            }));

            return (
              <LinePath
                key={uniqueKey}
                data={freshData}
                x={(d) => dateScale(getDate(d)) ?? 0}
                y={(d) => valueScale(getValue(d)) ?? 0}
                stroke={strokeColor}
                strokeWidth={width}
                strokeOpacity={strokeOpacity}
                curve={curveLinear}
                shapeRendering="geometricPrecision"
                style={{
                  transition: 'none !important',
                  animation: 'none !important',
                  transform: 'none !important',
                  willChange: 'auto'
                } as React.CSSProperties}
              />
            );
          })}

          {/* Axes */}
          <AxisBottom
            top={innerHeight}
            scale={dateScale}
            stroke="hsl(var(--border) / 0.6)"
            tickStroke="hsl(var(--border) / 0.6)"
            tickFormat={(v) => formatXAxisTick(v as Date | number)}
            numTicks={xNumTicks}
            tickLabelProps={() => ({
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
              textAnchor: 'middle',
              dy: '0.5em',
            })}
          />
          <AxisLeft
            scale={valueScale}
            stroke="hsl(var(--border) / 0.6)"
            tickStroke="hsl(var(--border) / 0.6)"
            tickFormat={(value) => formatAxisValue(value as number)}
            tickLabelProps={() => ({
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
              textAnchor: 'end',
            })}
          />

          {/* Crosshair */}
          {(mousePosition || ENABLE_STATIC_CROSSHAIR) && (
            <>
              {/* Vertical line */}
              {(() => {
                const xGroup = mousePosition
                  ? (mousePosition.x - chartMargin.left - graphOffsetX)
                  : Math.max(0, Math.min(chartWidth, Math.floor(chartWidth / 2)));
                return (
                  <line
                    x1={xGroup}
                    x2={xGroup}
                    y1={0}
                    y2={innerHeight}
                    stroke={"hsl(var(--foreground) / 0.6)"}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    pointerEvents="none"
                  />
                );
              })()}
              
              {/* Value indicators on the line (only when mouse is active) */}
              {mousePosition && (crosshairValues?.filter(cv => !hoveredModelId || cv.modelId === hoveredModelId) ?? []).map((cv) => {
                const isHovered = hoveredModelId === cv.modelId;
                const isOtherHovered = hoveredModelId && hoveredModelId !== cv.modelId;
                
                return (
                  <g key={cv.modelId}>
                    <circle
                      cx={mousePosition.x - chartMargin.left - graphOffsetX}
                      cy={cv.y}
                      r={isHovered ? 6 : 4}
                      fill={cv.color}
                      fillOpacity={isOtherHovered ? 0.3 : 1}
                      stroke="#000000"
                      strokeWidth={2}
                      pointerEvents="none"
                      style={{ transition: 'r 0.15s ease, fill-opacity 0.15s ease' }}
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* Invisible overlay for mouse tracking - must be last to be on top */}
          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={innerHeight}
            fill="transparent"
            onPointerDown={handleChartPointerDown}
            onPointerMove={handleChartPointerMove}
            onPointerUp={handleChartPointerEnd}
            onPointerCancel={handleChartPointerEnd}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleChartDoubleClick}
            onContextMenu={handleChartContextMenu}
            style={{ cursor: 'crosshair' }}
          />

        </Group>
      </svg>

      {axisOverlayHeight > 0 && (
        <div
          className="absolute z-30 cursor-ns-resize select-none"
          style={{
            left: 0,
            top: chartMargin.top,
            width: axisInteractionWidth,
            height: axisOverlayHeight,
          }}
          onPointerDown={handleAxisPointerDown}
          onPointerMove={handleAxisPointerMove}
          onPointerUp={handleAxisPointerEnd}
          onPointerCancel={handleAxisPointerEnd}
          onDoubleClick={handleAxisDoubleClick}
        />
      )}

      {/* Crosshair price labels */}
      {mousePosition && crosshairValues && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {(crosshairValues.filter(cv => !hoveredModelId || cv.modelId === hoveredModelId)).map((cv) => {
            const isHovered = hoveredModelId === cv.modelId;
            const isOtherHovered = hoveredModelId && hoveredModelId !== cv.modelId;
            const yPos = chartMargin.top + cv.y;
            
            return (
              <div
                key={`label-${cv.modelId}`}
                className={cn(
                  "absolute -translate-y-1/2 transition-opacity duration-150",
                  isOtherHovered && "opacity-30"
                )}
                style={{
                  left: mousePosition.x + 10,
                  top: yPos,
                }}
              >
                <div
                  className="px-2 py-1 rounded text-[10px] font-mono font-semibold whitespace-nowrap backdrop-blur-md border border-border/40"
                  style={{
                    backgroundColor: 'hsl(var(--card) / 0.9)',
                    color: cv.color,
                  }}
                >
                  {formatBadgeValue(cv.value)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Model badges - positioned at the line tips */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {chartSeries.map((series, idx) => {
            const normalizedName = series.modelName.toLowerCase();
            const normalizedApiModel = series.apiModel?.toLowerCase();
            const baseline = false; // No baseline series
            const isDeepSeek = normalizedName.includes('deepseek') || normalizedApiModel?.includes('deepseek');
            const isQwen = normalizedName.includes('qwen') || normalizedApiModel?.includes('qwen');
            const emphasize = isDeepSeek || isQwen;
            // ETH baseline gets smaller logo
            const logoSize = baseline ? (isCompact ? 10 : 14) : (isCompact ? (emphasize ? 18 : 14) : (emphasize ? 26 : 20));
            const logoClass = cn(
              baseline ? (isCompact ? 'h-2.5 w-2.5 object-contain' : 'h-3.5 w-3.5 object-contain') : (isCompact ? (emphasize ? 'h-[18px] w-[18px] object-contain' : 'h-3.5 w-3.5 object-contain') : (emphasize ? 'h-6 w-6 object-contain' : 'h-5 w-5 object-contain')),
              shouldInvertAIModelLogo(series.apiModel) && 'invert-on-dark',
              baseline && 'grayscale'
            );
            const pos = badgePositions[idx];
            const circleDiameter = isCompact ? 28 : 36;
            const halfCircle = circleDiameter / 2;
            const latestBadgeValue = getLatestBadgeValue(series);
            const previousBadgeValue = previousBadgeValuesRef.current.get(series.modelId) ?? null;
            const stackRank = badgeStackRanks.get(series.modelId) ?? idx;
            const baseZIndex = 10 + (chartSeries.length - stackRank);
            
            // Position the badge so the center of the logo circle aligns with the line tip
            // pos.x, pos.y is the line tip position
            // We want the circle center to be at pos.x, pos.y
            // So we offset by -halfCircle in both directions
            const left = (pos?.x ?? 0) - halfCircle;
            const top = (pos?.y ?? 0) - halfCircle;
            const isHovered = hoveredModelId === series.modelId;
            const isOtherHovered = hoveredModelId && hoveredModelId !== series.modelId;
            
            return (
              <div
                key={series.modelId}
                className={cn(
                  "absolute flex items-center gap-1.5 pointer-events-auto cursor-pointer transition-all duration-150"
                )}
                style={{ 
                  left, 
                  top,
                  zIndex: isHovered ? 50 : baseZIndex,
                }}
                onMouseEnter={() => setHoveredModelId(series.modelId)}
                onMouseLeave={() => setHoveredModelId(null)}
              >
                <span className={cn(
                  "flex items-center justify-center rounded-full border border-border/60 bg-card/50 backdrop-blur-sm shadow-sm transition-shadow duration-150",
                  isCompact ? "h-7 w-7" : "h-9 w-9",
                  isHovered && "shadow-lg ring-2 ring-offset-1 ring-offset-background"
                )} style={isHovered ? ({ "--tw-ring-color": (baseline ? 'hsl(var(--muted-foreground))' : series.color) } as CSSProperties) : undefined}>
                  {series.logo ? (
                    <Image
                      src={series.logo}
                      alt={`${series.modelName} logo`}
                      width={logoSize}
                      height={logoSize}
                      className={logoClass}
                      unoptimized
                    />
                  ) : (
                    <span className={isCompact ? "text-xs" : "text-base"}>{series.fallbackIcon}</span>
                  )}
                </span>
                <RollingNumber
                  value={latestBadgeValue}
                  previousValue={previousBadgeValue}
                  formatter={formatBadgeValue}
                  epsilon={BADGE_EPSILON}
                  className={cn(
                    "rounded-full border border-border/60 bg-card/50 backdrop-blur-sm font-mono font-medium shadow-sm transition-shadow duration-150",
                    isCompact ? "px-1 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]",
                    isHovered && "shadow-lg"
                  )}
                  style={{ color: (baseline ? 'hsl(var(--muted-foreground))' : series.color) }}
                />
                {/* Position direction indicator */}
                {series.positionDirection && series.positionDirection !== 'FLAT' && (
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full border border-border/60 bg-card/50 backdrop-blur-sm font-bold shadow-sm transition-all duration-150",
                      isCompact ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs",
                      isHovered && "shadow-lg ring-1 ring-offset-1 ring-offset-background"
                    )}
                    style={{
                      color: series.positionDirection === 'LONG' ? '#10b981' : '#ef4444',
                      ...(isHovered ? { "--tw-ring-color": series.positionDirection === 'LONG' ? '#10b981' : '#ef4444' } : {})
                    } as CSSProperties}
                    title={`${series.positionCount || 0} ${series.positionDirection} position${(series.positionCount || 0) !== 1 ? 's' : ''}`}
                  >
                    {series.positionDirection === 'LONG' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

    </div>
  );
}

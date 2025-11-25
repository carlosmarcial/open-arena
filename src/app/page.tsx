/**
 * Open Arena Dashboard
 * Main dashboard page matching Alpha Arena design
 * 
 * TODO:
 * - [x] Switch to light mode theme
 * - [x] Reorganize header layout (logo + menu on top, ticker below)
 * - [x] Apply modern thin scrollbars with no track
 * - [ ] Match Alpha Arena color scheme and styling
 * - [ ] Fine-tune spacing and borders
 * - [x] Removed mobile leaderboard bars
 */

'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LeaderboardTab } from '@/components/dashboard/LeaderboardTab';
import { ModelChatTab } from '@/components/dashboard/ModelChatTab';
import { PositionsTab } from '@/components/dashboard/PositionsTab';
import { TradesTab } from '@/components/dashboard/TradesTab';
import { EquityCurveChart, ModelSeries } from '@/components/charts/EquityCurveChart';
import { CryptoTicker } from '@/components/ui/CryptoTicker';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MobileModal } from '@/components/ui/MobileModal';
import WaitlistModal from '@/components/ui/WaitlistModal';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { getAIModelLogo, shouldInvertAIModelLogo } from '@/lib/utils/logos';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';
import { useTheme } from '@/lib/theme';
import { WalletDropdown } from '@/components/ui/WalletDropdown';

type ChartTabType = 'all' | '72h';
type RightPanelTabType = 'trades' | 'modelchat' | 'positions' | 'readme';

type HighlightedModel = {
  name: string;
  logo: string | null;
  fallbackIcon: string;
  value: number;
  change: number;
  apiModel?: string;
};

type ModelSummary = {
  id: string;
  name: string;
  logo: string | null;
  fallbackIcon: string;
  value: number;
  color: string;
  apiModel?: string;
};

type SnapshotMap = Record<string, { timestamp: string; equity: number }[]>;

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const [activeChartTab, setActiveChartTab] = useState<ChartTabType>('all');
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTabType>('trades');
  const [viewMode, setViewMode] = useState<'$' | '%'>('$');
  const [chartData, setChartData] = useState<ModelSeries[]>([]);
  const [highestModel, setHighestModel] = useState<HighlightedModel | null>(null);
  const [lowestModel, setLowestModel] = useState<HighlightedModel | null>(null);
  const [modelSummaries, setModelSummaries] = useState<ModelSummary[]>([]);
  const [previousModelValues, setPreviousModelValues] = useState<Record<string, number>>({});
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 800, height: 500 });
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileModalContent, setMobileModalContent] = useState<RightPanelTabType>('trades');
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number }>({ days: 0, hours: 0 });

  // Competition window
  const TRADING_START_DATE = new Date('2025-10-23T20:15:00Z');
  const TRADING_END_DATE = new Date('2025-11-21T20:15:00Z'); // Extended to 29 days total

  // Wallet data for all AI models
  const wallets = [
    {
      id: 'claude',
      name: 'Claude Sonnet 4.5',
      address: '0x4678aD6f43A580e579187b82BeCB969D920dCc17',
      color: '#f97316',
      apiModel: 'anthropic/claude-3.5-sonnet',
    },
    {
      id: 'gpt',
      name: 'GPT 5',
      address: '0x0c913da22c3239Df4cBcbB953424c5162cbcBe64',
      color: '#10b981',
      apiModel: 'openai/gpt-4o',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek Chat V3.1',
      address: '0x11a361b5cE357FddA30A0d0879E3b7650e87dd4c',
      color: '#3b82f6',
      apiModel: 'deepseek/deepseek-chat',
    },
    {
      id: 'grok',
      name: 'Grok 4',
      address: '0xcb167033ca49F62fD9528C73A8893d637Ec039F7',
      color: '#06b6d4',
      apiModel: 'xai/grok-2-1212',
    },
    {
      id: 'mistral',
      name: 'Mistral Medium 3.1',
      address: '0x1B0faDD802D4FaABC4a5ee26b85bdAd9dDd68475',
      color: '#0ea5e9',
      apiModel: 'mistralai/mistral-medium-3.1',
    },
    {
      id: 'qwen',
      name: 'Qwen3 Max',
      address: '0x5c8aAfA0C3A1A9289Cf9c9DCE091652E4930174B',
      color: '#8b5cf6',
      apiModel: 'alibaba/qwen2.5-72b-instruct',
    },
  ];

  // Countdown timer effect
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const timeLeft = TRADING_END_DATE.getTime() - now.getTime();

      if (timeLeft > 0) {
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setCountdown({ days, hours });
      } else {
        setCountdown({ days: 0, hours: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Unified fetch to ensure chart badges and bottom cards use the SAME data snapshot
  const fetchDashboard = async () => {
    try {
      const fetchStartTime = Date.now();

      // Fetch leaderboard ONCE and reuse for chart + cards
      const leaderboardResponse = await fetch('/api/leaderboard');
      if (!leaderboardResponse.ok) throw new Error('Failed to fetch leaderboard');
      const leaderboardPayload = await leaderboardResponse.json();
      const rawLeaderboard = leaderboardPayload.leaderboard || [];
      const filtered = rawLeaderboard.filter((entry: any) => entry.api_model !== 'btc-hodl');
      const normalizedLeaderboard = filtered.map((entry: any) => applyModelUIOverrides(entry));

      // Debug: Log current equity values to track changes
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Dashboard Update:', {
          timestamp: new Date().toLocaleTimeString(),
          fetchTime: `${Date.now() - fetchStartTime}ms`,
          equities: normalizedLeaderboard.map((e: any) => ({
            model: e.name,
            equity: e.current_equity?.toFixed(2),
            pnl: e.pnl_percentage?.toFixed(2) + '%'
          }))
        });
      }

      // Fetch snapshots once
      const snapshotsResponse = await fetch('/api/snapshots');
      const snapshotsPayload = snapshotsResponse.ok ? await snapshotsResponse.json() : null;
      const snapshots = (snapshotsPayload?.snapshots ?? {}) as SnapshotMap;

      // Fetch positions to show direction indicators
      const positionsResponse = await fetch('/api/positions');
      const positionsPayload = positionsResponse.ok ? await positionsResponse.json() : null;
      const positions = positionsPayload?.positions || [];

      // Group positions by model to determine direction
      const positionsByModel = new Map<string, { direction: 'LONG' | 'SHORT' | 'FLAT', count: number }>();
      positions.forEach((pos: any) => {
        const existing = positionsByModel.get(pos.model_id);
        if (!existing) {
          positionsByModel.set(pos.model_id, { direction: pos.side, count: 1 });
        } else {
          // If mixed positions, show the most recent
          existing.count++;
          existing.direction = pos.side; // Latest position takes precedence
        }
      });

      // Build chart series from the same leaderboard payload
      const fallbackStartMs = TRADING_START_DATE.getTime();
      const snapshotTimestamps: number[] = [];
      Object.values(snapshots).forEach((modelSnapshots) => {
        if (Array.isArray(modelSnapshots)) {
          modelSnapshots.forEach((snap) => {
            const ts = new Date(snap.timestamp).getTime();
            if (!Number.isNaN(ts)) snapshotTimestamps.push(ts);
          });
        }
      });
      const earliestSnapshotMs = snapshotTimestamps.length ? Math.min(...snapshotTimestamps) : null;
      const tradingStartMs = earliestSnapshotMs != null ? Math.min(fallbackStartMs, earliestSnapshotMs) : fallbackStartMs;
      const tradingStartDate = new Date(tradingStartMs);

      const colorOverrides: Record<string, string> = {
        'Claude Sonnet 4.5': '#f97316',
        'GPT 5': '#10b981',
        'Mistral Medium 3.1': '#0ea5e9',
        'Grok 4': '#06b6d4',
        'DeepSeek Chat V3.1': '#3b82f6',
        'Qwen3 Max': '#8b5cf6',
      };

      const now = new Date();

      const series: ModelSeries[] = normalizedLeaderboard.map((entry: any) => {
        const logo = getAIModelLogo(entry.api_model);
        const rawEquity = Number(entry.current_equity);
        
        // Sanity check: Equity should be between $10 and $150 for normal trading
        // If outside this range, likely a data fetch race condition - use previous value
        const currentValue = (rawEquity >= 10 && rawEquity <= 150) 
          ? rawEquity 
          : (previousModelValues[entry.model_id] || 50);
        
        const startingCapital = Number(entry.starting_capital) || 60.09;

        const modelSnapshots = snapshots[entry.model_id] || [];
        let data: { timestamp: Date; value: number }[];

        if (modelSnapshots.length > 0) {
          data = modelSnapshots
            .map((snap: any) => ({ timestamp: new Date(snap.timestamp), value: Number(snap.equity) }))
            .filter((p) => !Number.isNaN(p.timestamp.getTime()) && Number.isFinite(p.value))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          // Prepare an anchor point at starting capital, but do NOT insert yet
          // We will insert it AFTER window removal/sanitization so it is never filtered out
          const firstSnapshot = data[0];
          const startingAnchor = firstSnapshot
            ? { timestamp: new Date(firstSnapshot.timestamp.getTime() - 60000), value: startingCapital }
            : null;

          // Phase 2 (Approach A): Identify and remove entire volatile windows, then bridge
          const volatileWindows = findVolatileWindows(data, {
            jumpThreshold: 12,     // > $12 jumps
            windowMs: 60 * 60 * 1000, // within 1 hour
            minJumps: 2,           // at least 2 occurrences in window (more aggressive)
            bufferMs: 5 * 60 * 1000,
            maxJumpGapMs: 20 * 60 * 1000,
          });

          if (volatileWindows.length && process.env.NODE_ENV === 'development') {
            console.log(`🧹 Removing ${volatileWindows.length} volatile window(s) for ${entry.name}`);
          }

          if (volatileWindows.length) {
            data = removeWindowsAndInterpolate(data, volatileWindows);
          }

          // Follow-up: light sanitization to remove residual spikes, allowing long-gap bridges
          data = sanitizeSeries(data, {
            windowSize: 15,           // Larger window for better median calculation
            maxDeviationPct: 0.20,    // 20% deviation threshold
            maxAbsoluteJump: 12,      // Filter jumps larger than $12
            maxJumpEnforceIfGapMs: 15 * 60 * 1000, // only enforce for close-in-time points
          });

          // Prepend starting capital anchor so line always starts at $60.09
          // Use fixed value (60.09) for all models to ensure consistency
          if (data.length > 0) {
            const firstSnap = data[0];
            const startTime = new Date(firstSnap.timestamp.getTime() - 60000); // 1 min before first data
            data.unshift({ timestamp: startTime, value: 60.09 }); // Fixed starting capital
          }

          // ALWAYS append a terminal point at "now" with current value
          const last = data[data.length - 1];
          const lastTime = last ? last.timestamp.getTime() : 0;
          const needAppend = !last || lastTime < now.getTime() || Math.abs(last.value - currentValue) > 1e-9;
          if (needAppend) {
            const appendedTime = last && now.getTime() <= lastTime ? new Date(lastTime + 1000) : now;
            data.push({ timestamp: appendedTime, value: currentValue });
          }
        } else {
          // If no snapshots, create a line from starting capital to current value
          data = [
            { timestamp: tradingStartDate, value: startingCapital },
            { timestamp: now, value: currentValue },
          ];
        }

        data = sortAndDedupSeries(data);
        // Note: sanitizeSeries already called above with relaxed parameters

        // Apply additional smoothing to eliminate remaining noise
        // This uses a rolling median to smooth out erratic movements
        data = applySmoothingFilter(data, { windowSize: 5 });

        const maxPoints = 5000; // Increased to ensure all real data is included

        // If we already have real snapshot data, use it directly without densification
        // Densification can cause recent data to be cut off when hitting the maxPoints limit
        let densifiedData: { timestamp: Date; value: number }[];
        if (data.length <= maxPoints) {
          // Use real data directly - no need to interpolate
          densifiedData = data;
        } else {
          // Too many points - prioritize recent data by taking last N points
          densifiedData = data.slice(-maxPoints);
        }

        densifiedData = ensureTerminalPoint(densifiedData, { timestamp: now, value: currentValue }, maxPoints);

        // Get position direction for this model
        const positionInfo = positionsByModel.get(entry.model_id);

        return {
          modelId: entry.model_id,
          modelName: entry.name,
          logo,
          fallbackIcon: entry.icon,
          color: colorOverrides[entry.name] || entry.color || '#3b82f6',
          data: densifiedData,
          currentValue,
          apiModel: entry.api_model,
          positionDirection: positionInfo?.direction || 'FLAT',
          positionCount: positionInfo?.count || 0,
        };
      });

      setChartData(series);

      // Highest/Lowest (from the SAME leaderboard payload)
      const sorted = [...normalizedLeaderboard].sort((a: any, b: any) => Number(b.current_equity) - Number(a.current_equity));
      if (sorted.length) {
        const top = sorted[0];
        const bottom = sorted[sorted.length - 1];
        setHighestModel({
          name: top.name,
          logo: getAIModelLogo(top.api_model),
          fallbackIcon: top.icon ?? '🌊',
          value: Number(top.current_equity) || 0,
          change: Number(top.pnl_percentage) || 0,
          apiModel: top.api_model,
        });
        setLowestModel({
          name: bottom.name,
          logo: getAIModelLogo(bottom.api_model),
          fallbackIcon: bottom.icon ?? '🌊',
          value: Number(bottom.current_equity) || 0,
          change: Number(bottom.pnl_percentage) || 0,
          apiModel: bottom.api_model,
        });
      }

      // Bottom cards from the SAME leaderboard payload
      const colorOverridesCards: Record<string, string> = {
        'Claude Sonnet 4.5': '#f97316',
        'GPT 5': '#10b981',
        'Mistral Medium 3.1': '#0ea5e9',
        'Grok 4': '#06b6d4',
        'DeepSeek Chat V3.1': '#3b82f6',
        'Qwen3 Max': '#8b5cf6',
      };
      const allModels = normalizedLeaderboard.map((model: any) => ({
        id: model.model_id,
        name: model.name,
        logo: getAIModelLogo(model.api_model),
        fallbackIcon: model.icon,
        value: model.current_equity,
        color: colorOverridesCards[model.name] || model.color || '#3b82f6',
        apiModel: model.api_model,
      }));
      setModelSummaries(allModels);

      // Update previous values for animation
      const newPreviousValues: Record<string, number> = {};
      allModels.forEach((model: ModelSummary) => {
        newPreviousValues[model.id] = previousModelValues[model.id] ?? model.value;
      });
      setPreviousModelValues(newPreviousValues);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDashboard();
  }, []);

  // Auto-refresh for live trading (every 10 seconds to reduce API load)
  // Since cron updates DB every 2 minutes, 10-second refresh provides smooth updates
  // without overwhelming the API or causing data inconsistencies
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard();
      }
    }, 10000);
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const { width, height: containerHeight } = chartContainerRef.current.getBoundingClientRect();
        
        // Chart now has dedicated space, no need for complex padding calculations
        // Use container dimensions directly with some margin
        const chartMargin = 40; // Small margin for visual breathing room
        const availableHeight = containerHeight > chartMargin ? containerHeight - chartMargin : containerHeight;

        setChartDimensions({
          width,
          height: Math.max(320, Math.round(availableHeight)),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const densifySeries = (
    points: { timestamp: Date; value: number }[],
    options?: { intervalMs?: number; maxInsertionsPerGap?: number; maxTotalPoints?: number }
  ): { timestamp: Date; value: number }[] => {
    const intervalMs = options?.intervalMs ?? 5 * 60 * 1000; // 5 minutes
    const maxInsertionsPerGap = options?.maxInsertionsPerGap ?? 24;
    const maxTotalPoints = options?.maxTotalPoints ?? 3000; // Increased to show all historical data

    if (points.length < 2) {
      return points;
    }

    const densified: { timestamp: Date; value: number }[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const prev = densified[densified.length - 1];
      const curr = points[i];
      const gapMs = curr.timestamp.getTime() - prev.timestamp.getTime();

      if (gapMs > intervalMs) {
        const rawInsertions = Math.floor(gapMs / intervalMs) - 1;
        const insertions = Math.min(maxInsertionsPerGap, Math.max(0, rawInsertions));

        for (let step = 1; step <= insertions; step++) {
          const ratio = step / (insertions + 1);
          const interpolatedTime = prev.timestamp.getTime() + gapMs * ratio;
          const interpolatedValue = prev.value + (curr.value - prev.value) * ratio;
          densified.push({
            timestamp: new Date(interpolatedTime),
            value: interpolatedValue,
          });

          if (densified.length >= maxTotalPoints - 1) {
            break;
          }
        }
      }

      densified.push(curr);

      if (densified.length >= maxTotalPoints) {
        break;
      }
    }

    return densified;
  };

  // Ensure the final point matches the latest leaderboard equity so badges and cards agree
  const ensureTerminalPoint = (
    points: { timestamp: Date; value: number }[],
    terminal: { timestamp: Date; value: number },
    maxTotalPoints: number
  ): { timestamp: Date; value: number }[] => {
    const arr = points.length ? [...points] : [terminal];
    const last = arr[arr.length - 1];
    const needAppend =
      !last ||
      last.timestamp.getTime() !== terminal.timestamp.getTime() ||
      Math.abs(last.value - terminal.value) > 1e-9;

    if (needAppend) {
      arr.push(terminal);
    }

    // Trim from the start if we exceed the cap, but always keep the terminal point
    const excess = Math.max(0, arr.length - maxTotalPoints);
    if (excess > 0) arr.splice(0, excess);
    return arr;
  };

  // Identify volatile time windows based on clusters of large jumps
  type TimeWindow = { start: Date; end: Date };

  const findVolatileWindows = (
    points: { timestamp: Date; value: number }[],
    opts?: { jumpThreshold?: number; windowMs?: number; minJumps?: number; bufferMs?: number; maxJumpGapMs?: number }
  ): TimeWindow[] => {
    if (points.length < 3) return [];

    const jumpThreshold = opts?.jumpThreshold ?? 12; // dollars
    const windowMs = opts?.windowMs ?? 60 * 60 * 1000; // 1 hour
    const minJumps = opts?.minJumps ?? 3; // at least 3 big jumps in window
    const bufferMs = opts?.bufferMs ?? 5 * 60 * 1000; // extend each side by 5 minutes
    const maxJumpGapMs = opts?.maxJumpGapMs ?? 20 * 60 * 1000; // only count jumps that occur within <=20 min gap

    // Collect timestamps (ms) where a big jump occurs
    const bigJumpTimes: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dt = curr.timestamp.getTime() - prev.timestamp.getTime();
      const dv = Math.abs(curr.value - prev.value);
      if (dt >= 0 && dt <= maxJumpGapMs && dv >= jumpThreshold) {
        bigJumpTimes.push(curr.timestamp.getTime());
      }
    }

    if (bigJumpTimes.length < minJumps) return [];

    // Two-pointer sliding window over bigJumpTimes to find clusters
    const windows: TimeWindow[] = [];
    let s = 0;
    for (let e = 0; e < bigJumpTimes.length; e++) {
      while (s <= e && bigJumpTimes[e] - bigJumpTimes[s] > windowMs) s++;
      if (e - s + 1 >= minJumps) {
        const start = new Date(bigJumpTimes[s] - bufferMs);
        const end = new Date(bigJumpTimes[e] + bufferMs);
        windows.push({ start, end });
      }
    }

    if (!windows.length) return [];

    // Merge overlapping windows
    windows.sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged: TimeWindow[] = [];
    for (const w of windows) {
      if (!merged.length) {
        merged.push({ ...w });
        continue;
      }
      const last = merged[merged.length - 1];
      if (w.start.getTime() <= last.end.getTime()) {
        // overlap — extend end
        last.end = new Date(Math.max(last.end.getTime(), w.end.getTime()));
      } else {
        merged.push({ ...w });
      }
    }
    return merged;
  };

  // Remove points inside windows; bridge gaps linearly by keeping boundary points
  const removeWindowsAndInterpolate = (
    points: { timestamp: Date; value: number }[],
    windows: TimeWindow[]
  ): { timestamp: Date; value: number }[] => {
    if (!windows.length) return points;

    const byTime = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const result: { timestamp: Date; value: number }[] = [];
    let i = 0;

    for (const w of windows) {
      // push points strictly before the window
      while (i < byTime.length && byTime[i].timestamp.getTime() < w.start.getTime()) {
        result.push(byTime[i]);
        i++;
      }
      // skip points within the window
      while (i < byTime.length && byTime[i].timestamp.getTime() <= w.end.getTime()) {
        i++;
      }
      // Do not insert synthetic points — leaving prev and next will create a straight line bridge
      // (If there is no next, nothing to connect.)
    }

    // push the remainder
    while (i < byTime.length) {
      result.push(byTime[i]);
      i++;
    }

    return result;
  };

  // Remove obviously erroneous outlier points using a median-based approach
  // This handles both quick reversions and persistent oscillations
  const sanitizeSeries = (
    points: { timestamp: Date; value: number }[],
    opts?: { windowSize?: number; maxDeviationPct?: number; maxAbsoluteJump?: number; maxJumpEnforceIfGapMs?: number }
  ): { timestamp: Date; value: number }[] => {
    if (points.length <= 3) return points;

    const windowSize = opts?.windowSize ?? 11; // Use 11 points for median calculation
    const maxDeviationPct = opts?.maxDeviationPct ?? 0.12; // 12% deviation from median
    const maxAbsoluteJump = opts?.maxAbsoluteJump ?? 15; // Maximum allowed jump in dollars
    const maxJumpEnforceIfGapMs = opts?.maxJumpEnforceIfGapMs ?? 15 * 60 * 1000; // only enforce abs jump if gap <= 15min

    // Helper to calculate median
    const median = (values: number[]): number => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    const sanitized: { timestamp: Date; value: number }[] = [];

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const currVal = Number(curr.value);

      if (!Number.isFinite(currVal)) continue;

      // For first few points, always include them
      if (i < 3) {
        sanitized.push(curr);
        continue;
      }

      // CRITICAL: Check for large absolute jumps from previous kept point
      // Gate by time gap to allow bridges over removed windows
      if (sanitized.length > 0) {
        const prev = sanitized[sanitized.length - 1];
        const prevVal = prev.value;
        const absoluteJump = Math.abs(currVal - prevVal);
        const gapMs = curr.timestamp.getTime() - prev.timestamp.getTime();

        const shouldEnforceAbsJump = Number.isFinite(maxAbsoluteJump) && gapMs <= maxJumpEnforceIfGapMs;

        if (shouldEnforceAbsJump && absoluteJump > (maxAbsoluteJump ?? Number.POSITIVE_INFINITY)) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🚫 Filtered large jump: $${prevVal.toFixed(2)} → $${currVal.toFixed(2)} (Δ$${absoluteJump.toFixed(2)} in ${Math.round(gapMs/60000)}m)`);
          }
          continue; // Skip this outlier
        }

        // ADDITIONAL: Detect oscillating patterns (A → B → A pattern)
        if (sanitized.length >= 2) {
          const prevPrevVal = sanitized[sanitized.length - 2].value;
          const jumpToPrevPrev = Math.abs(currVal - prevPrevVal);

          if (jumpToPrevPrev < absoluteJump / 3 && absoluteJump > (maxAbsoluteJump * 0.6)) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🚫 Filtered oscillation: $${prevPrevVal.toFixed(2)} → $${prevVal.toFixed(2)} → $${currVal.toFixed(2)}`);
            }
            continue; // Skip this oscillation point
          }
        }
      }

      // Calculate median of surrounding window
      const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
      const windowEnd = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);
      const windowValues = points
        .slice(windowStart, windowEnd)
        .map(p => Number(p.value))
        .filter(v => Number.isFinite(v));

      if (windowValues.length === 0) {
        sanitized.push(curr);
        continue;
      }

      const medianValue = median(windowValues);
      const deviation = Math.abs(currVal - medianValue);
      const deviationPct = medianValue > 0 ? deviation / medianValue : 0;

      // If this point deviates too much from the median, skip it
      if (deviationPct > maxDeviationPct && deviation > 5) {
        if (process.env.NODE_ENV === 'development' && Math.random() < 0.05) {
          console.log(`🚫 Filtered outlier: value=${currVal.toFixed(2)}, median=${medianValue.toFixed(2)}, deviation=${(deviationPct * 100).toFixed(1)}%`);
        }
        continue;
      }

      sanitized.push(curr);
    }

    return sanitized;
  };

  const sortAndDedupSeries = (
    points: { timestamp: Date; value: number }[]
  ): { timestamp: Date; value: number }[] => {
    if (points.length <= 1) return points;

    const sorted = [...points].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const deduped: { timestamp: Date; value: number }[] = [];
    for (const point of sorted) {
      const last = deduped[deduped.length - 1];
      if (!last || point.timestamp.getTime() !== last.timestamp.getTime()) {
        deduped.push(point);
      } else {
        deduped[deduped.length - 1] = point;
      }
    }

    return deduped;
  };

  // Apply rolling median filter to smooth out remaining noise and erratic movements
  const applySmoothingFilter = (
    points: { timestamp: Date; value: number }[],
    opts?: { windowSize?: number }
  ): { timestamp: Date; value: number }[] => {
    if (points.length < 3) return points;

    const windowSize = opts?.windowSize ?? 5;

    const median = (values: number[]): number => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    const smoothed: { timestamp: Date; value: number }[] = [];

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];

      // For edge points (first/last few), keep original values
      if (i < 2 || i >= points.length - 2) {
        smoothed.push(curr);
        continue;
      }

      // Calculate rolling median
      const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
      const windowEnd = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);
      const windowValues = points
        .slice(windowStart, windowEnd)
        .map(p => p.value)
        .filter(v => Number.isFinite(v));

      if (windowValues.length === 0) {
        smoothed.push(curr);
        continue;
      }

      const smoothedValue = median(windowValues);

      smoothed.push({
        timestamp: curr.timestamp,
        value: smoothedValue,
      });
    }

    return smoothed;
  };

  // REDRAW early period: replace chaotic segments with clean interpolated line
  // Uses current_equity as the reliable anchor point instead of looking at snapshots
  const redrawEarlyPeriod = (
    points: { timestamp: Date; value: number }[],
    opts?: { earlyHours?: number; numSamples?: number; startFrom?: Date; targetValue?: number }
  ): { timestamp: Date; value: number }[] => {
    const n = points.length;
    if (n < 3) return points;

    const startFrom = opts?.startFrom ?? points[0].timestamp;
    const earlyHours = Math.max(0.5, opts?.earlyHours ?? 48); // Extended to 48h
    const numSamples = Math.max(3, opts?.numSamples ?? 96); // More samples for smoother 48h
    const targetValue = opts?.targetValue; // Use current_equity as anchor

    const startMs = startFrom.getTime();
    const earlyEndMs = startMs + earlyHours * 60 * 60 * 1000;

    // Separate early and later periods
    const early: { timestamp: Date; value: number }[] = [];
    const later: { timestamp: Date; value: number }[] = [];
    for (const p of points) {
      (p.timestamp.getTime() <= earlyEndMs ? early : later).push(p);
    }

    if (early.length === 0) {
      return points;
    }

    // Use provided targetValue (current_equity) if available, otherwise find stable point
    let anchorValue: number;
    if (targetValue !== undefined && Number.isFinite(targetValue)) {
      anchorValue = targetValue;
    } else if (later.length > 0) {
      // Use first clean point after early period
      const cleanPoints = later.slice(0, Math.min(10, later.length));
      const cleanValues = cleanPoints.map(p => p.value).sort((a, b) => a - b);
      anchorValue = cleanValues[Math.floor(cleanValues.length / 2)];
    } else {
      // Fallback: use last early point
      anchorValue = early[early.length - 1].value;
    }

    const anchorTime = new Date(earlyEndMs);
    const startValue = early[0].value;

    // REDRAW: Create clean linear interpolation from start to anchor
    const redrawn: { timestamp: Date; value: number }[] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const ratio = i / (numSamples - 1);
      const t = startMs + ratio * (anchorTime.getTime() - startMs);
      const v = startValue + ratio * (anchorValue - startValue);
      redrawn.push({ timestamp: new Date(t), value: v });
    }

    // Combine redrawn early period with later points
    return [...redrawn, ...later];
  };


  const chartTabs = [
    { id: 'all' as ChartTabType, label: 'ALL' },
    { id: '72h' as ChartTabType, label: '72H' },
  ];

  const rightPanelTabs = [
    { id: 'trades' as RightPanelTabType, label: 'COMPLETED TRADES' },
    { id: 'modelchat' as RightPanelTabType, label: 'MODELCHAT' },
    { id: 'positions' as RightPanelTabType, label: 'POSITIONS' },
    { id: 'readme' as RightPanelTabType, label: 'ABOUT' },
  ];

  const getViewModeButtonClasses = (isActive: boolean) => {
    // Default to light theme if resolvedTheme is null (loading state)
    const isDark = resolvedTheme === 'dark';

    if (isActive) {
      return isDark
        ? 'bg-[#1a1d23] text-foreground'
        : 'bg-[#f6f4ef] text-black';
    } else {
      return isDark
        ? 'bg-[#23272f] text-muted-foreground hover:bg-[#1e2229]'
        : 'bg-muted/30 text-muted-foreground hover:bg-[#faf9f7]';
    }
  };

  const isDeepSeekModel = (apiModel?: string, name?: string) => {
    const normalized = apiModel?.toLowerCase();
    if (normalized && normalized.includes('deepseek')) {
      return true;
    }
    return name ? name.toLowerCase().includes('deepseek') : false;
  };

  const isQwenModel = (apiModel?: string, name?: string) => {
    const normalized = apiModel?.toLowerCase();
    if (normalized && (normalized.includes('qwen') || normalized.includes('alibaba'))) {
      return true;
    }
    return name ? name.toLowerCase().includes('qwen') : false;
  };

  const isLargerLogoModel = (apiModel?: string, name?: string) => {
    return isDeepSeekModel(apiModel, name) || isQwenModel(apiModel, name);
  };

  const getHighlightLogoConfig = (model: HighlightedModel | null) => {
    if (!model || !model.logo) {
      return null;
    }

    const deepSeek = isDeepSeekModel(model.apiModel, model.name);
    const size = deepSeek ? 24 : 20;

    return {
      size,
      className: cn(
        deepSeek ? 'h-6 w-6' : 'h-5 w-5',
        shouldInvertAIModelLogo(model.apiModel) && 'invert-on-dark'
      ),
    };
  };

  const highestLogoConfig = getHighlightLogoConfig(highestModel);
  const lowestLogoConfig = getHighlightLogoConfig(lowestModel);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top Navigation Bar */}
      <nav className="border-b border-border bg-card/90 pl-2 pr-3 md:pl-4 md:pr-6 lg:pl-8 lg:pr-10">
        <div className="flex h-12 sm:h-14 md:h-16 items-center justify-between gap-2 relative">
          {/* Left: Logo */}
          <div className="shrink-0">
            {/* Hide ASCII logo on small/medium screens, show simpler text */}
            <div className="md:hidden text-xs sm:text-sm font-bold tracking-wider text-foreground">
              OPEN ARENA
            </div>
            <div className="hidden md:block lg:hidden text-[10px] font-bold tracking-widest text-foreground">
              OPEN ARENA
            </div>
            <div className="hidden lg:block font-mono text-foreground select-none text-[4px] xl:text-[5px] font-bold whitespace-pre" style={{ lineHeight: '0.8', fontFamily: 'Courier New, monospace' }}>
{` ██████  ██████  ███████ ███    ██      █████  ██████  ███████ ███    ██  █████
██    ██ ██   ██ ██      ████   ██     ██   ██ ██   ██ ██      ████   ██ ██   ██
██    ██ ██████  █████   ██ ██  ██     ███████ ██████  █████   ██ ██  ██ ███████
██    ██ ██      ██      ██  ██ ██     ██   ██ ██   ██ ██      ██  ██ ██ ██   ██
 ██████  ██      ███████ ██   ████     ██   ██ ██   ██ ███████ ██   ████ ██   ██`}
            </div>
          </div>

          {/* Center: Wallet Dropdown + Timer */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 z-10">
            <WalletDropdown wallets={wallets} />
            <div className="flex items-center space-x-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Competition Ends In:</span>
              <span className="font-mono font-bold text-foreground whitespace-nowrap">
                {countdown.days}d {countdown.hours}h
              </span>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-3 shrink-0">
          <button
              onClick={() => setWaitlistModalOpen(true)}
              className="hidden lg:inline-block text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer rounded px-3 py-1"
            >
              Join the Waitlist ↗
            </button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Ticker + Stats Row */}
      <div className="overflow-x-auto border-b border-border light-surface-muted backdrop-blur">
        <div className="pl-3 pr-2 md:px-4 py-1.5 md:py-2.5 flex items-center justify-between gap-4 w-full">
          <CryptoTicker />
          
          
          <div className="hidden lg:flex items-center space-x-4 xl:space-x-6 text-[10px] xl:text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
            {highestModel && (
              <div className="relative flex items-center space-x-1.5 xl:space-x-2 pr-4 xl:pr-6">
                <span className="text-muted-foreground">Highest:</span>
                <span className="flex h-5 w-5 items-center justify-center shrink-0">
                  {highestModel.logo ? (
                    <Image
                      src={highestModel.logo}
                      alt={`${highestModel.name} logo`}
                      width={highestLogoConfig?.size ?? 20}
                      height={highestLogoConfig?.size ?? 20}
                      className={highestLogoConfig?.className ?? 'h-5 w-5'}
                      unoptimized
                    />
                  ) : (
                    <span className="text-sm">{highestModel.fallbackIcon}</span>
                  )}
                </span>
                <span className="font-semibold text-foreground truncate max-w-[120px] xl:max-w-none">{highestModel.name}</span>
                <span className="font-mono font-bold text-foreground whitespace-nowrap">{formatCurrency(highestModel.value)}</span>
                <span className="text-green-500 whitespace-nowrap">{formatPercentage(highestModel.change)}</span>
                {/* Vertical divider - shorter for single-line layout */}
                <div 
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-px bg-border"
                  style={{ height: '50%', opacity: 0.65 }}
                />
              </div>
            )}
            {lowestModel && (
              <div className="flex items-center space-x-1.5 xl:space-x-2">
                <span className="text-muted-foreground">Lowest:</span>
                <span className="flex h-5 w-5 items-center justify-center shrink-0">
                  {lowestModel.logo ? (
                    <Image
                      src={lowestModel.logo}
                      alt={`${lowestModel.name} logo`}
                      width={lowestLogoConfig?.size ?? 20}
                      height={lowestLogoConfig?.size ?? 20}
                      className={lowestLogoConfig?.className ?? 'h-5 w-5'}
                      unoptimized
                    />
                  ) : (
                    <span className="text-sm">{lowestModel.fallbackIcon}</span>
                  )}
                </span>
                <span className="font-semibold text-foreground truncate max-w-[120px] xl:max-w-none">{lowestModel.name}</span>
                <span className="font-mono font-bold text-foreground whitespace-nowrap">{formatCurrency(lowestModel.value)}</span>
                <span className="text-red-500 whitespace-nowrap">{formatPercentage(lowestModel.change)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Mobile: Full-width chart + tabs */}
        {/* Desktop: Split panel layout */}
        
        {/* Left Panel - Chart Area */}
        <div className="flex-1 flex flex-col lg:border-r border-border light-surface shadow-sm lg:overflow-hidden overflow-y-auto min-h-0 min-w-0">
          {/* Chart Controls - Fixed Height Section */}
          <div className="shrink-0 h-11 md:h-10 lg:h-9 flex items-center justify-center px-2 md:px-4 lg:px-6 pt-2">
            <div className="relative flex flex-row items-center gap-2 md:gap-4 w-full">
              {/* Left: $ / % Toggle */}
              <div className="inline-flex overflow-hidden rounded border border-border/70 bg-card shadow-sm">
                <button
                  onClick={() => setViewMode('$')}
                  className={cn(
                    'px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-semibold tracking-wide cursor-pointer transition-colors',
                    viewMode === '$'
                      ? getViewModeButtonClasses(true)
                      : getViewModeButtonClasses(false)
                  )}
                >
                  $
                </button>
                <button
                  onClick={() => setViewMode('%')}
                  className={cn(
                    'px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-semibold tracking-wide cursor-pointer transition-colors',
                    viewMode === '%'
                      ? getViewModeButtonClasses(true)
                      : getViewModeButtonClasses(false)
                  )}
                >
                  %
                </button>
              </div>

              {/* Center: Title */}
              <h2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[11px] md:text-xs font-bold uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground pointer-events-none">
                Total Account Value
              </h2>
            </div>
          </div>

          {/* Chart Content - Fixed height on mobile, flex on desktop */}
          <div className="h-[450px] lg:h-auto lg:flex-1 overflow-hidden min-h-0 py-2 md:py-4" ref={chartContainerRef}>
            {chartData.length > 0 && (
              <div className="h-full flex items-center justify-center">
                <EquityCurveChart
                  data={chartData}
                  width={chartDimensions.width}
                  height={chartDimensions.height}
                  valueMode={viewMode === '$' ? 'currency' : 'percentage'}
                  hoveredModelId={hoveredModelId}
                  onHoveredModelChange={setHoveredModelId}
                />
              </div>
            )}
          </div>

          {/* Mobile: Button Grid for Detailed Views - directly after chart */}
          <div className="lg:hidden shrink-0 border-t border-border bg-background px-4 py-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 text-center">DETAILED VIEW</h3>

            {/* Mobile: Wallet Dropdown and Countdown */}
            <div className="flex flex-col items-center space-y-3 mb-6">
            <WalletDropdown wallets={wallets} />
            <div className="flex items-center space-x-2 text-[10px] uppercase tracking-wide text-muted-foreground lg:hidden">
            <span>Competition Ends In:</span>
            <span className="font-mono font-bold text-foreground whitespace-nowrap">
            {countdown.days}d {countdown.hours}h
            </span>
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {rightPanelTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setMobileModalContent(tab.id);
                    setMobileModalOpen(true);
                  }}
                  className="flex items-center justify-between border border-border bg-card hover:bg-muted/50 active:bg-muted px-4 py-4 rounded-md transition-colors"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-foreground text-left leading-tight">
                    {tab.label.replace(' ', '\n')}
                  </span>
                  <span className="text-muted-foreground text-lg">›</span>
                </button>
              ))}
            </div>
          </div>
          
          
          {/* Desktop: Model Summary Cards */}
          <div className="hidden lg:block shrink-0 border-t border-border light-surface-beige px-3 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {modelSummaries.map((model) => (
                <motion.div
                key={model.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.2 }
                }}
                className="cursor-pointer rounded-md border border-border bg-card px-2 pt-2 pb-1 shadow-sm transition-shadow hover:shadow min-w-0 h-14 flex items-center justify-center"
                onMouseEnter={() => setHoveredModelId(model.id)}
                onMouseLeave={() => setHoveredModelId(null)}
                onFocus={() => setHoveredModelId(model.id)}
                onBlur={() => setHoveredModelId(null)}
                tabIndex={0}
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                      {model.logo ? (
                        <Image
                          src={model.logo}
                          alt={`${model.name} logo`}
                          width={isDeepSeekModel(model.apiModel, model.name) ? 32 : (isQwenModel(model.apiModel, model.name) ? 28 : 20)}
                          height={isDeepSeekModel(model.apiModel, model.name) ? 32 : (isQwenModel(model.apiModel, model.name) ? 28 : 20)}
                          className={cn(
                            isDeepSeekModel(model.apiModel, model.name) ? 'h-8 w-8' : (isQwenModel(model.apiModel, model.name) ? 'h-7 w-7' : 'h-5 w-5'),
                            shouldInvertAIModelLogo(model.apiModel) && 'invert-on-dark'
                          )}
                          unoptimized
                        />
                      ) : (
                        <span className="text-sm">{model.fallbackIcon}</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-semibold leading-tight uppercase tracking-wide truncate" style={{ color: model.color }} title={model.name}>
                        {model.name}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-foreground truncate">
                      <AnimatedNumber
                          value={model.value}
                          previousValue={previousModelValues[model.id]}
                          format="currency"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Tabbed Content */}
        <div className="hidden lg:flex h-full w-full flex-col overflow-hidden border-t lg:border-t-0 lg:border-l border-border bg-card lg:w-[320px] lg:max-w-[320px] xl:w-[380px] xl:max-w-[380px] 2xl:w-[450px] 2xl:max-w-[450px] shrink-0" data-mobile-tabs>
          {/* Right Panel Tabs */}
          <div className="dashboard-tabs" role="tablist" aria-label="Secondary dashboard views">
            {rightPanelTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeRightTab === tab.id}
                onClick={() => setActiveRightTab(tab.id)}
                className={cn('dashboard-tab-button', activeRightTab === tab.id && 'is-active')}
                title={tab.label}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Panel Content */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/60 px-2 pt-4">
            {activeRightTab === 'trades' && <TradesTab />}
            {activeRightTab === 'modelchat' && <ModelChatTab />}
            {activeRightTab === 'positions' && <PositionsTab />}
            {activeRightTab === 'readme' && (
              <div className="max-w-none px-2 pb-6 text-[13px] leading-relaxed text-foreground">
                <h2 className="text-xl font-bold mb-6 tracking-tight">About Open Arena</h2>
                
                <h3 className="text-base font-bold mb-3 tracking-tight">Why Markets Matter</h3>
                <p className="mb-6 text-justify">
                  The best benchmarks aren&apos;t puzzles to solve: they&apos;re worlds to navigate. 
                  Markets demand real-time decisions under uncertainty, with consequences. They&apos;re adversarial, dynamic, and unforgiving. 
                  Every trade is a prediction with skin in the game. If we want to understand how well AI can reason, adapt, and compete, we need to watch it trade.
                </p>

                <hr className="my-6 border-border" />

                <h3 className="text-base font-bold mb-3 tracking-tight">The Experiment</h3>
                <p className="mb-4 text-justify">
                  Open Arena is inspired by <a href="https://nof1.ai/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline">Alpha Arena</a>, the pioneering benchmark that first had the brilliance to pit AI models against real markets with real money. 
                  When I discovered it, I was transfixed. I spent way too much time watching the AIs trade, which is probably why I made <strong>dark mode the default</strong> in Open Arena (easier on the eyes at 3am). 
                  This is probably one of the most important differentiators between both platforms for now ;)
                </p>
                <p className="mb-4 text-justify">
                  But as a struggling indie developer with exactly zero funding, I had to get creative with the budget.
                </p>
                <p className="mb-4 text-justify">
                  This is the first AI trading arena built on <a href="https://www.asterdex.com/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline">Aster</a>, a next-gen decentralized perp exchange with deep liquidity, cross-chain support, and an API that doesn&apos;t make me want to throw my laptop out the window. 
                  Each model gets <strong>$50 USDT</strong> to trade crypto perpetuals. 
                  For unified LLM access, we&apos;re using <a href="https://openrouter.ai/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline">OpenRouter</a>, which lets you hit any major model through a single, OpenAI-compatible interface.
                </p>
                <p className="mb-4 text-justify">
                  Since Aster also offers synthetic stock trading, we could eventually test these same AI models trading stocks alongside crypto. 
                  We could even get them trading on Polymarket. 
                  The possibilities are endless.
                </p>
                <p className="mb-3 text-justify">
                  Six competitors trade 24/7, fully autonomous, all reasoning and trades public:
                </p>
                <ul className="mb-6 ml-5 space-y-2 list-none">
                  <li className="flex items-center gap-2">
                    <Image src="/logos/anthropic-1.svg" alt="Claude" width={16} height={16} className="shrink-0" unoptimized />
                    <span><strong>Claude 4.5 Sonnet</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Image src="/logos/deepseek-2.svg" alt="DeepSeek" width={22} height={22} className="shrink-0 h-[22px] w-[22px]" unoptimized />
                    <span><strong>DeepSeek V3.1 Chat</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Image src="/logos/Mistral.svg" alt="Mistral" width={16} height={16} className="shrink-0" unoptimized />
                    <span><strong>Mistral Medium 3.1</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Image src="/logos/openai-2.svg" alt="OpenAI" width={16} height={16} className="shrink-0" unoptimized />
                    <span><strong>GPT 5</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Image src="/logos/grok-1.svg" alt="Grok" width={16} height={16} className="shrink-0" unoptimized />
                    <span><strong>Grok 4</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Image src="/logos/qwen_logo.svg" alt="Qwen" width={20} height={20} className="shrink-0 h-5 w-5" unoptimized />
                    <span><strong>Qwen 3 Max</strong></span>
                  </li>
                  
                </ul>

                <hr className="my-6 border-border" />

                <h3 className="text-base font-bold mb-3 tracking-tight">The Single Instance Problem</h3>
                <p className="mb-4 text-justify">
                  Let&apos;s address the elephant in the room: running just one instance of each model is almost guaranteed to produce more noise than signal.
                </p>
                <p className="mb-4 text-justify">
                  A single trader over a short timeframe could get lucky or unlucky, and it would tell us almost nothing about actual skill. 
                  You&apos;d be measuring which coin flip landed heads more often, not which AI is genuinely better at trading.
                </p>
                <p className="mb-4 text-justify">
                  That&apos;s why if funding arrives (or someone hires me to keep building this), the immediate plan is to launch <strong>many instances simultaneously</strong>: dozens 
                  or hundreds of agents running in parallel across different market conditions. Same prompts, same starting capital, different random seeds and entry points. 
                  Extract signal from noise through volume and statistical aggregation. See which strategies actually hold up when you can&apos;t cherry-pick the lucky runs.
                </p>
                <p className="mb-6 text-justify">
                  If no funding or opportunity arises and I&apos;m still just a guy refreshing his inbox? This becomes <strong>fully open-source</strong>. 
                  Bring your own Aster API keys, bring your own OpenRouter credits, fork the repo, and run your own experiments. 
                  Want to launch 100 instances? Do it. Want to test different prompting strategies? Go wild. 
                  Let a thousand experiments bloom.
                </p>

                <hr className="my-6 border-border" />
                <p className="text-justify">
                <strong>Built in 5 days</strong> by <a href="https://x.com/carlosmarcialt" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline font-semibold">Carlos Marcial</a>, an
                indie hacker, artist, and designer based in Lisbon, Portugal. Follow along as I build in public, push boundaries, and occasionally remember to eat.
                </p>
                <p className="mt-4 text-justify">
                  Let&apos;s see what happens. 🚀
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Modal for Tab Content */}
      <MobileModal
        isOpen={mobileModalOpen}
        onClose={() => setMobileModalOpen(false)}
        title={rightPanelTabs.find(t => t.id === mobileModalContent)?.label || ''}
      >
        {mobileModalContent === 'trades' && <TradesTab />}
        {mobileModalContent === 'modelchat' && <ModelChatTab />}
        {mobileModalContent === 'positions' && <PositionsTab />}
        {mobileModalContent === 'readme' && (
          <div className="max-w-none px-2 pb-6 text-[13px] leading-relaxed text-foreground">
            <h2 className="text-xl font-bold mb-6 tracking-tight">About Open Arena</h2>
            
            <h3 className="text-base font-bold mb-3 tracking-tight">Why Markets Matter</h3>
            <p className="mb-6 text-justify">
              The best benchmarks aren&apos;t puzzles to solve: they&apos;re worlds to navigate. 
              Markets demand real-time decisions under uncertainty, with consequences. They&apos;re adversarial, dynamic, and unforgiving. 
              Every trade is a prediction with skin in the game. If we want to understand how well AI can reason, adapt, and compete, we need to watch it trade.
            </p>

            <hr className="my-6 border-border" />

            <h3 className="text-base font-bold mb-3 tracking-tight">The Experiment</h3>
            <p className="mb-4 text-justify">
              Open Arena is inspired by <a href="https://nof1.ai/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline">Alpha Arena</a>, the pioneering benchmark that first had the brilliance to pit AI models against real markets with real money. 
              When I discovered it, I was transfixed. I spent way too much time watching the AIs trade, which is probably why I made <strong>dark mode the default</strong> in Open Arena (easier on the eyes at 3am). 
              This is probably one of the most important differentiators between both platforms for now ;)
            </p>
            <p className="mb-4 text-justify">
              But as a struggling indie developer with exactly zero funding, I had to get creative with the budget.
            </p>
            <p className="mb-4 text-justify">
              This is the first AI trading arena built on <a href="https://www.asterdex.com/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline">Aster</a>, a next-gen decentralized perp exchange with deep liquidity, cross-chain support, and an API that doesn&apos;t make me want to throw my laptop out the window. 
              Each model gets <strong>$50 USDT</strong> to trade crypto perpetuals. 
              For unified LLM access, we&apos;re using <a href="https://openrouter.ai/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline">OpenRouter</a>, which lets you hit any major model through a single, OpenAI-compatible interface.
            </p>
            <p className="mb-6 text-justify">
            Six competitors trade 24/7, fully autonomous, all reasoning and trades public.
            </p>
          </div>
        )}
      </MobileModal>

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={waitlistModalOpen}
        onClose={() => setWaitlistModalOpen(false)}
      />
    </div>
  );
}

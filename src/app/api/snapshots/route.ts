/**
 * GET /api/snapshots
 * Returns performance snapshots for all models to build equity curves
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Detect volatile windows on the server (query-level pre-filter)
function findVolatileWindows(points: { timestamp: Date; value: number }[], opts?: {
  jumpThreshold?: number; // dollars
  windowMs?: number;      // time window for clustering
  minJumps?: number;      // minimum count inside window
  bufferMs?: number;      // extend window edges
  maxJumpGapMs?: number;  // only count jumps if gap <= this
}): { start: Date; end: Date }[] {
  if (points.length < 3) return [];
  const jumpThreshold = opts?.jumpThreshold ?? 12;
  const windowMs = opts?.windowMs ?? 60 * 60 * 1000;
  const minJumps = opts?.minJumps ?? 2;
  const bufferMs = opts?.bufferMs ?? 5 * 60 * 1000;
  const maxJumpGapMs = opts?.maxJumpGapMs ?? 20 * 60 * 1000;

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
  const windows: { start: Date; end: Date }[] = [];
  let s = 0;
  for (let e = 0; e < bigJumpTimes.length; e++) {
    while (s <= e && bigJumpTimes[e] - bigJumpTimes[s] > windowMs) s++;
    if (e - s + 1 >= minJumps) {
      windows.push({ start: new Date(bigJumpTimes[s] - bufferMs), end: new Date(bigJumpTimes[e] + bufferMs) });
    }
  }
  if (!windows.length) return [];
  windows.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: { start: Date; end: Date }[] = [];
  for (const w of windows) {
    if (!merged.length) { merged.push({ ...w }); continue; }
    const last = merged[merged.length - 1];
    if (w.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), w.end.getTime()));
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

function removeWindows(points: { timestamp: Date; value: number }[], windows: { start: Date; end: Date }[]) {
  if (!windows.length) return points;
  const byTime = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const result: { timestamp: Date; value: number }[] = [];
  let i = 0;
  for (const w of windows) {
    while (i < byTime.length && byTime[i].timestamp.getTime() < w.start.getTime()) { result.push(byTime[i]); i++; }
    while (i < byTime.length && byTime[i].timestamp.getTime() <= w.end.getTime()) { i++; }
  }
  while (i < byTime.length) { result.push(byTime[i]); i++; }
  return result;
}

export async function GET() {
  try {
    // Fetch all performance snapshots, grouped by model
    const { data: snapshots, error } = await supabase
      .from('performance_snapshots')
      .select('model_id, equity, timestamp')
      .order('timestamp', { ascending: true })
      .limit(20000);

    if (error) {
      console.error('Error fetching performance snapshots:', error);
      return NextResponse.json(
        { error: 'Failed to fetch performance snapshots' },
        { status: 500 }
      );
    }

    // Group + pre-filter by model
    const groupedByModel: Record<string, { timestamp: string; equity: number }[]> = {};

    const byModel: Record<string, { timestamp: Date; value: number }[]> = {};
    (snapshots || []).forEach((s: any) => {
      const modelId = s.model_id;
      if (!byModel[modelId]) byModel[modelId] = [];
      const ts = new Date(s.timestamp);
      const val = Number(s.equity);
      if (Number.isFinite(ts.getTime()) && Number.isFinite(val)) {
        byModel[modelId].push({ timestamp: ts, value: val });
      }
    });

    for (const [modelId, arr] of Object.entries(byModel)) {
      const sorted = arr.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const windows = findVolatileWindows(sorted, {
        jumpThreshold: 12,
        windowMs: 60 * 60 * 1000,
        minJumps: 2,
        bufferMs: 5 * 60 * 1000,
        maxJumpGapMs: 20 * 60 * 1000,
      });
      const cleaned = removeWindows(sorted, windows);
      groupedByModel[modelId] = cleaned.map(p => ({ timestamp: p.timestamp.toISOString(), equity: p.value }));
    }

    return NextResponse.json({
      snapshots: groupedByModel,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in snapshots API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

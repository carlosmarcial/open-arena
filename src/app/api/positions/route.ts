/**
 * GET /api/positions
 * Returns current open positions with P&L calculations
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Color override map - ensures correct brand colors
const COLOR_OVERRIDES: Record<string, string> = {
  'Claude Sonnet 4.5': '#f97316',       // Orange
  'GPT 5': '#10b981',                   // Emerald green
  'Mistral Medium 3.1': '#0ea5e9',          // Ocean blue
  'Grok 4': '#06b6d4',                  // Cyan
  'DeepSeek Chat V3.1': '#3b82f6',      // Blue
  'Qwen3 Max': '#8b5cf6',               // Purple
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    let query = supabase
      .from('positions')
      .select(`
        *,
        models (
          id,
          name,
          icon,
          color,
          api_model,
          current_equity,
          starting_capital
        )
      `)
      .order('last_updated', { ascending: false });

    // Filter by model if specified
    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    const { data: positions, error } = await query;

    if (error) {
      console.error('Error fetching positions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch positions data' },
        { status: 500 }
      );
    }

    // Group positions by model for easier frontend consumption
    const positionsByModel = positions?.reduce((acc, position: any) => {
      const model = position.models;
      const modelId = model.id;

      if (!acc[modelId]) {
        // Calculate available cash (equity - current positions value)
        // Current positions value = entry notional + unrealized P&L
        const currentPositionsValue = positions
          .filter((p: any) => p.model_id === modelId)
          .reduce((sum: number, p: any) => sum + p.notional_value + (parseFloat(p.unrealized_pnl) || 0), 0);

        acc[modelId] = {
          model: {
            id: model.id,
            name: model.name,
            icon: model.icon,
            color: COLOR_OVERRIDES[model.name] || model.color,
            api_model: model.api_model,
          },
          positions: [],
          totalUnrealizedPnl: 0,
          availableCash: parseFloat(model.current_equity) - currentPositionsValue,
        };
      }

      // Build exit plan from stored per-position parameters (if provided by the model)
      const entryPrice = parseFloat(position.entry_price);
      const rawTp = position.take_profit_percent;
      const rawSl = position.stop_loss_percent;

      const tp = typeof rawTp === 'number' ? rawTp : (typeof rawTp === 'string' ? parseFloat(rawTp) : undefined);
      const sl = typeof rawSl === 'number' ? rawSl : (typeof rawSl === 'string' ? parseFloat(rawSl) : undefined);

      const hasTp = typeof tp === 'number' && Number.isFinite(tp);
      const hasSl = typeof sl === 'number' && Number.isFinite(sl);

      let computedExitPlan: { target?: number | null; stop?: number | null; invalidCondition: string } | undefined;

      if (hasTp || hasSl) {
        const isLong = position.side === 'LONG';
        const target = hasTp
          ? (isLong ? entryPrice * (1 + (tp as number)) : entryPrice * (1 - (tp as number)))
          : null;
        const stop = hasSl
          ? (isLong ? entryPrice * (1 - (sl as number)) : entryPrice * (1 + (sl as number)))
          : null;

        const parts: string[] = [];
        if (hasTp) {
          const pct = ((tp as number) * 100).toFixed(1);
          parts.push(`${isLong ? '+' : '-'}${pct}% profit`);
        }
        if (hasSl) {
          const pct = ((sl as number) * 100).toFixed(1);
          parts.push(`${isLong ? '-' : '+'}${pct}% loss`);
        }

        computedExitPlan = {
          target,
          stop,
          invalidCondition: `Position will auto-close at ${parts.join(' or ')} from entry price of $${entryPrice.toFixed(4)}`,
        };
      }

      const positionObj: any = {
        id: position.id,
        modelId: position.model_id,
        tradeId: position.trade_id,
        symbol: position.symbol,
        side: position.side,
        entryPrice: position.entry_price,
        currentPrice: position.current_price,
        quantity: position.quantity,
        leverage: position.leverage,
        notionalValue: position.notional_value,
        unrealizedPnl: position.unrealized_pnl,
        lastUpdated: new Date(position.last_updated),
      };

      if (computedExitPlan) {
        (positionObj as any).exitPlan = computedExitPlan;
      }

      acc[modelId].positions.push(positionObj);

      acc[modelId].totalUnrealizedPnl += position.unrealized_pnl;

      return acc;
    }, {} as Record<string, any>);

    // Flatten positions for chart direction indicators
    const flatPositions: any[] = [];
    Object.values(positionsByModel || {}).forEach((modelData: any) => {
      modelData.positions.forEach((pos: any) => {
        flatPositions.push({
          model_id: pos.modelId,
          side: pos.side,
          symbol: pos.symbol,
        });
      });
    });

    return NextResponse.json({
      positionsByModel: positionsByModel || {},
      positions: flatPositions, // Add flat array for chart compatibility
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in positions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

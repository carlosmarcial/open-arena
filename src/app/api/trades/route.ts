/**
 * GET /api/trades
 * Returns completed trades with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, Trade, Model } from '@/lib/supabase';

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
    const status = searchParams.get('status') || 'closed'; // Default to closed trades
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('trades')
      .select(`
        *,
        models (
          name,
          icon,
          color,
          api_model
        )
      `)
      .eq('status', status)
      .order('entry_time', { ascending: false })
      .limit(limit);

    // Filter by model if specified
    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    const { data: trades, error } = await query;

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trades data' },
        { status: 500 }
      );
    }

    // Transform the data to include model info and apply color overrides
    const transformedTrades = trades?.map((trade: any) => ({
      ...trade,
      model: {
        ...trade.models,
        color: COLOR_OVERRIDES[trade.models?.name] || trade.models?.color
      },
      models: undefined, // Remove the nested models object
    }));

    return NextResponse.json({
      trades: transformedTrades as (Trade & { model: Model })[],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in trades API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

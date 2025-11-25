/**
* GET /api/leaderboard
* Returns the current leaderboard with rankings and stats
*/

import { NextResponse } from 'next/server';
import { supabase, LeaderboardEntry } from '@/lib/supabase';
import { AsterClient } from '@/lib/aster/client';
import { getAsterCredentials } from '@/lib/aster/credentials';
import { applyModelUIOverrides } from '@/lib/utils/modelOverrides';

// Color override map - ensures correct brand colors
const COLOR_OVERRIDES: Record<string, string> = {
  'Claude Sonnet 4.5': '#f97316',       // Orange
  'GPT 5': '#10b981',                   // Emerald green
  'Mistral Medium 3.1': '#0ea5e9',          // Ocean blue
  'Grok 4': '#06b6d4',                  // Cyan
  'DeepSeek Chat V3.1': '#3b82f6',      // Blue
  'Qwen3 Max': '#8b5cf6',               // Purple
};

// Function to get real-time balance from Aster DEX
async function getRealBalance(modelName: string): Promise<number> {
  try {
    const credentials = getAsterCredentials(modelName);
    const client = new AsterClient(credentials.apiKey, credentials.apiSecret);
    const balances = await client.getBalance();
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    if (!usdtBalance) {
      return 0;
    }

    const toNumber = (value?: string) => {
      if (typeof value !== 'string') {
        return 0;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const walletBalance = toNumber(usdtBalance.balance);
    const crossWalletBalance = toNumber(usdtBalance.crossWalletBalance);
    const unrealizedPnl = toNumber(usdtBalance.crossUnPnl);
    const maxWithdraw = toNumber(usdtBalance.maxWithdrawAmount);
    const available = toNumber(usdtBalance.availableBalance);

    const hasMeaningfulValue = (value: number) => Number.isFinite(value) && Math.abs(value) > 0.0001;

    const baseEquityCandidates = [walletBalance, crossWalletBalance, maxWithdraw, available];
    const baseEquity = baseEquityCandidates.find(hasMeaningfulValue) ?? 0;
    const equityWithUnrealized = baseEquity + (hasMeaningfulValue(unrealizedPnl) ? unrealizedPnl : 0);

    if (hasMeaningfulValue(equityWithUnrealized)) {
      return equityWithUnrealized;
    }

    return 0;
  } catch (error) {
    console.warn(`Failed to get real balance for ${modelName}:`, error);
    return 0; // Fallback to 0 if API fails
  }
}

export async function GET() {
  try {
    // Calculate leaderboard directly from models table (since materialized view may be stale)
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('id, name, icon, color, api_model, current_equity, starting_capital')
      .order('current_equity', { ascending: false });

    if (modelsError) {
      console.error('Error fetching models:', modelsError);
      return NextResponse.json(
        { error: 'Failed to fetch models data' },
        { status: 500 }
      );
    }

    // Create leaderboard data from models
    const leaderboard = (models || []).map((model, index) => {
      const normalizedModel = applyModelUIOverrides(model);
      const name = normalizedModel.name ?? model.name;
      const color = COLOR_OVERRIDES[name] || normalizedModel.color || model.color;
      const currentEquity = Number(normalizedModel.current_equity ?? model.current_equity ?? 0);
      const startingCapital = Number(normalizedModel.starting_capital ?? model.starting_capital ?? 0);
      const totalPnl = currentEquity - startingCapital;
      const pnlPercentage =
        startingCapital !== 0
          ? Math.round(((totalPnl / startingCapital) * 100) * 100) / 100
          : 0;

      return {
        model_id: normalizedModel.id ?? model.id,
        rank: index + 1,
        name,
        icon: normalizedModel.icon ?? model.icon,
        color,
        api_model: normalizedModel.api_model ?? model.api_model,
        current_equity: currentEquity,
        total_pnl: totalPnl,
        pnl_percentage: pnlPercentage,
        total_fees: 0, // Will be calculated from trades when they exist
        trade_count: 0,
        win_rate: 0,
        biggest_win: 0,
        biggest_loss: 0,
        sharpe_ratio: 0,
        starting_capital: startingCapital,
      };
    });

    // Use database equity (updated by cron every 2 minutes) instead of live API calls
    // This prevents rate limiting, API failures, and inconsistent chart data
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      color: COLOR_OVERRIDES[entry.name] || entry.color
    }));

    const winningModel = rankedLeaderboard[0] || null;

    return NextResponse.json({
      leaderboard: rankedLeaderboard as LeaderboardEntry[],
      winningModel,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in leaderboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

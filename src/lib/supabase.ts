/**
 * Supabase Client Configuration
 * Server-side client for API routes
 */

import { createClient } from '@supabase/supabase-js';

// These environment variables are used server-side only
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create public client (for read-only operations, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create admin client (for cron jobs and server operations, bypasses RLS)
// CRITICAL: Service role key is required for cron jobs to bypass RLS
export const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          // Force service role authorization
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
      },
    })
  : supabase; // Fallback to public client if no service role key (will fail for writes)

// Database types for type safety
export interface Model {
  id: string;
  name: string;
  icon: string;
  color: string;
  api_provider: string;
  api_model: string;
  starting_capital: number;
  current_equity: number;
  status: 'active' | 'paused' | 'stopped';
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  model_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  leverage: number;
  notional_value: number;
  entry_time: string;
  exit_time?: string;
  holding_time_ms?: number;
  net_pnl?: number;
  fees: number;
  status: 'open' | 'closed';
  aster_order_id?: number;
  aster_position_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  model_id: string;
  trade_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  current_price: number;
  quantity: number;
  leverage: number;
  notional_value: number;
  unrealized_pnl: number;
  last_updated: string;
  created_at: string;
}

export interface ModelReasoning {
  id: string;
  model_id: string;
  trade_id?: string;
  reasoning_text: string;
  decision: string;
  confidence: number;
  market_snapshot?: any;
  timestamp: string;
}

export interface PerformanceSnapshot {
  id: string;
  model_id: string;
  equity: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_fees: number;
  trade_count: number;
  win_rate?: number;
  sharpe_ratio?: number;
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  model_id: string;
  name: string;
  icon: string;
  color: string;
  api_model: string;
  current_equity: number;
  starting_capital: number;
  total_pnl: number;
  pnl_percentage: number;
  trade_count: number;
  total_fees: number;
  biggest_win: number;
  biggest_loss: number;
  win_rate: number;
}

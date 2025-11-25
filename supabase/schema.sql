-- ============================================
-- Open Arena - Complete Database Schema
-- ============================================
-- This is the single source of truth for the database schema.
-- Run this file in Supabase SQL Editor to set up a fresh database.
--
-- ============================================
-- CONFIGURATION: Starting Capital
-- ============================================
-- To change the starting capital for all models, update these locations:
--   1. Line ~35: DEFAULT value in models table (starting_capital and current_equity)
--   2. Line ~485: VALUES in the seed data INSERT statement
--
-- Current Setting: 60.09 USDT per model
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================
-- TABLES
-- ============================================

-- Models Table
-- Stores AI trading models competing in Open Arena

CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  api_provider TEXT NOT NULL,
  api_model TEXT NOT NULL,
  -- ⚠️ STARTING CAPITAL: Change these defaults when adjusting capital per model
  starting_capital NUMERIC NOT NULL DEFAULT 60.09,  -- Starting capital in USDT
  current_equity NUMERIC NOT NULL DEFAULT 60.09,    -- Should match starting_capital for new models
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT models_status_check CHECK (status IN ('active', 'paused', 'stopped'))
);

COMMENT ON TABLE models IS 'AI trading models competing in Aster Arena (includes BTC benchmark)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_name ON models(name);

-- ============================================

-- Trades Table
-- Stores all trades (open and closed) for each model

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  quantity NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  notional_value NUMERIC NOT NULL,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMP WITH TIME ZONE,
  holding_time_ms BIGINT,
  net_pnl NUMERIC,
  fees NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  aster_order_id BIGINT,
  aster_position_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  take_profit_percent NUMERIC,
  stop_loss_percent NUMERIC,
  max_hold_minutes INTEGER,

  CONSTRAINT trades_side_check CHECK (side IN ('LONG', 'SHORT')),
  CONSTRAINT trades_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT trades_leverage_check CHECK (leverage > 0 AND leverage <= 20)
);

COMMENT ON TABLE trades IS 'All trades (open and closed) executed by models';
COMMENT ON COLUMN trades.aster_order_id IS 'Order ID from Aster DEX API for tracking real orders';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_model_id ON trades(model_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_model_status ON trades(model_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_aster_order_id ON trades(aster_order_id);

-- ============================================

-- Positions Table
-- Stores current open positions for each model

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  leverage INTEGER NOT NULL,
  notional_value NUMERIC NOT NULL,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  take_profit_percent NUMERIC,
  stop_loss_percent NUMERIC,
  max_hold_minutes INTEGER,

  CONSTRAINT positions_side_check CHECK (side IN ('LONG', 'SHORT')),
  CONSTRAINT positions_unique_trade UNIQUE (trade_id)
);

COMMENT ON TABLE positions IS 'Current open positions for each model';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_positions_model_id ON positions(model_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_model_symbol ON positions(model_id, symbol);

-- ============================================

-- Model Reasoning Table
-- Stores the AI's thought process and decision-making

CREATE TABLE IF NOT EXISTS model_reasoning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  reasoning_text TEXT NOT NULL,
  decision TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50,
  market_snapshot JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT reasoning_confidence_check CHECK (confidence >= 0 AND confidence <= 100)
);

COMMENT ON TABLE model_reasoning IS 'AI model reasoning and decision logs';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reasoning_model_id ON model_reasoning(model_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_timestamp ON model_reasoning(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reasoning_trade_id ON model_reasoning(trade_id);

-- ============================================

-- Performance Snapshots Table
-- Periodic snapshots of model performance for equity curves

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  equity NUMERIC NOT NULL,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  total_fees NUMERIC NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC,
  sharpe_ratio NUMERIC,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT performance_equity_positive CHECK (equity >= 0)
);

COMMENT ON TABLE performance_snapshots IS 'Periodic performance snapshots for equity curves';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_model_id ON performance_snapshots(model_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON performance_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_model_timestamp ON performance_snapshots(model_id, timestamp DESC);

-- ============================================

-- Waitlist Table
-- Stores waitlist signups

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  referral_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trades table
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================

-- Function to calculate unrealized P&L
CREATE OR REPLACE FUNCTION calculate_unrealized_pnl(
  p_side TEXT,
  p_entry_price NUMERIC,
  p_current_price NUMERIC,
  p_quantity NUMERIC,
  p_leverage INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
  price_diff NUMERIC;
  pnl NUMERIC;
BEGIN
  IF p_side = 'LONG' THEN
    price_diff := p_current_price - p_entry_price;
  ELSE
    price_diff := p_entry_price - p_current_price;
  END IF;

  pnl := price_diff * p_quantity;

  RETURN pnl;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================

-- Function: Get Model Statistics
CREATE OR REPLACE FUNCTION get_model_statistics(p_model_id UUID)
RETURNS TABLE (
  total_trades BIGINT,
  open_trades BIGINT,
  closed_trades BIGINT,
  total_pnl NUMERIC,
  total_fees NUMERIC,
  win_rate NUMERIC,
  avg_trade_size NUMERIC,
  median_leverage NUMERIC,
  avg_holding_time_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_trades,
    COUNT(CASE WHEN status = 'open' THEN 1 END)::BIGINT AS open_trades,
    COUNT(CASE WHEN status = 'closed' THEN 1 END)::BIGINT AS closed_trades,
    COALESCE(SUM(CASE WHEN status = 'closed' THEN net_pnl ELSE 0 END), 0) AS total_pnl,
    COALESCE(SUM(fees), 0) AS total_fees,
    CASE
      WHEN COUNT(CASE WHEN status = 'closed' THEN 1 END) > 0 THEN
        (COUNT(CASE WHEN status = 'closed' AND net_pnl > 0 THEN 1 END)::NUMERIC /
         COUNT(CASE WHEN status = 'closed' THEN 1 END)::NUMERIC * 100)
      ELSE 0
    END AS win_rate,
    COALESCE(AVG(CASE WHEN status = 'closed' THEN notional_value END), 0) AS avg_trade_size,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY leverage) AS median_leverage,
    COALESCE(AVG(CASE WHEN status = 'closed' THEN holding_time_ms END) / 60000, 0) AS avg_holding_time_minutes
  FROM trades
  WHERE model_id = p_model_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================

-- Function: Update Model Equity
CREATE OR REPLACE FUNCTION update_model_equity(p_model_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_starting_capital NUMERIC;
  v_realized_pnl NUMERIC;
  v_unrealized_pnl NUMERIC;
  v_total_fees NUMERIC;
  v_new_equity NUMERIC;
BEGIN
  SELECT starting_capital INTO v_starting_capital
  FROM models
  WHERE id = p_model_id;

  SELECT COALESCE(SUM(net_pnl), 0) INTO v_realized_pnl
  FROM trades
  WHERE model_id = p_model_id AND status = 'closed';

  SELECT COALESCE(SUM(unrealized_pnl), 0) INTO v_unrealized_pnl
  FROM positions
  WHERE model_id = p_model_id;

  SELECT COALESCE(SUM(fees), 0) INTO v_total_fees
  FROM trades
  WHERE model_id = p_model_id;

  v_new_equity := v_starting_capital + v_realized_pnl + v_unrealized_pnl - v_total_fees;

  UPDATE models
  SET
    current_equity = v_new_equity,
    updated_at = NOW()
  WHERE id = p_model_id;

  RETURN v_new_equity;
END;
$$ LANGUAGE plpgsql;

-- ============================================

-- Function: Create Performance Snapshot
CREATE OR REPLACE FUNCTION create_performance_snapshot(p_model_id UUID)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_equity NUMERIC;
  v_realized_pnl NUMERIC;
  v_unrealized_pnl NUMERIC;
  v_total_fees NUMERIC;
  v_trade_count INTEGER;
BEGIN
  v_equity := update_model_equity(p_model_id);

  SELECT
    COALESCE(SUM(net_pnl), 0),
    COALESCE(SUM(fees), 0),
    COUNT(*)::INTEGER
  INTO v_realized_pnl, v_total_fees, v_trade_count
  FROM trades
  WHERE model_id = p_model_id AND status = 'closed';

  SELECT COALESCE(SUM(unrealized_pnl), 0) INTO v_unrealized_pnl
  FROM positions
  WHERE model_id = p_model_id;

  INSERT INTO performance_snapshots (
    model_id,
    equity,
    realized_pnl,
    unrealized_pnl,
    total_fees,
    trade_count
  ) VALUES (
    p_model_id,
    v_equity,
    v_realized_pnl,
    v_unrealized_pnl,
    v_total_fees,
    v_trade_count
  )
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================

-- Function to notify on new waitlist signup
CREATE OR REPLACE FUNCTION notify_waitlist_signup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'waitlist_signup',
    json_build_object(
      'email', NEW.email,
      'name', NEW.name,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for waitlist signups
DROP TRIGGER IF EXISTS on_waitlist_signup ON waitlist;
CREATE TRIGGER on_waitlist_signup
  AFTER INSERT ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_signup();

-- ============================================
-- MATERIALIZED VIEW: Leaderboard
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS leaderboard CASCADE;

CREATE MATERIALIZED VIEW leaderboard AS
WITH model_stats AS (
  SELECT
    m.id AS model_id,
    m.name,
    m.icon,
    m.color,
    m.api_model,
    m.current_equity,
    m.starting_capital,
    (m.current_equity - m.starting_capital) AS total_pnl,
    ((m.current_equity - m.starting_capital) / m.starting_capital * 100) AS pnl_percentage,
    COUNT(CASE WHEN t.status = 'closed' THEN 1 END) AS trade_count,
    COALESCE(SUM(CASE WHEN t.status = 'closed' THEN t.fees ELSE 0 END), 0) AS total_fees,
    COALESCE(MAX(CASE WHEN t.status = 'closed' THEN t.net_pnl END), 0) AS biggest_win,
    COALESCE(MIN(CASE WHEN t.status = 'closed' THEN t.net_pnl END), 0) AS biggest_loss,
    CASE
      WHEN COUNT(CASE WHEN t.status = 'closed' THEN 1 END) > 0 THEN
        (COUNT(CASE WHEN t.status = 'closed' AND t.net_pnl > 0 THEN 1 END)::NUMERIC /
         COUNT(CASE WHEN t.status = 'closed' THEN 1 END)::NUMERIC * 100)
      ELSE 0
    END AS win_rate
  FROM models m
  LEFT JOIN trades t ON m.id = t.model_id
  WHERE m.status = 'active'
  GROUP BY m.id, m.name, m.icon, m.color, m.api_model, m.current_equity, m.starting_capital
)
SELECT
  ROW_NUMBER() OVER (ORDER BY current_equity DESC) AS rank,
  *
FROM model_stats;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_leaderboard_model_id ON leaderboard(model_id);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank);

COMMENT ON MATERIALIZED VIEW leaderboard IS 'Pre-calculated leaderboard rankings';

-- Function to refresh leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS) - DISABLED
-- ============================================
-- RLS is disabled on all tables for simpler service role access

ALTER TABLE models DISABLE ROW LEVEL SECURITY;
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE model_reasoning DISABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist DISABLE ROW LEVEL SECURITY;

-- ============================================
-- PERMISSIONS
-- ============================================

-- Grant all privileges to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant specific permissions on each table
GRANT SELECT, INSERT, UPDATE, DELETE ON models TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON trades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON positions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON model_reasoning TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON waitlist TO service_role;

-- Grant read access to anon role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON leaderboard TO anon;
GRANT SELECT ON leaderboard TO service_role;

-- ============================================
-- SEED DATA: AI Models
-- ============================================
-- ⚠️ STARTING CAPITAL: Update the last two values (starting_capital, current_equity)
-- for each model when changing the capital allocation.
-- Format: (name, icon, color, api_provider, api_model, starting_capital, current_equity)

INSERT INTO models (name, icon, color, api_provider, api_model, starting_capital, current_equity) VALUES
  ('Claude Sonnet 4.5', '🌟', '#f97316', 'anthropic', 'anthropic/claude-sonnet-4.5', 60.09, 60.09),
  ('GPT 5', '🌀', '#10b981', 'openai', 'openai/gpt-5', 60.09, 60.09),
  ('Mistral Medium 3.1', '🌊', '#0ea5e9', 'mistral', 'mistralai/mistral-medium-3.1', 60.09, 60.09),
  ('DeepSeek Chat V3.1', '🦜', '#3b82f6', 'deepseek', 'deepseek/deepseek-chat-v3.1', 60.09, 60.09),
  ('Grok 4', '⚡', '#06b6d4', 'x-ai', 'x-ai/grok-4', 60.09, 60.09),
  ('Qwen3 Max', '🔷', '#8b5cf6', 'qwen', 'qwen/qwen3-max', 60.09, 60.09)
ON CONFLICT (name)
DO UPDATE SET
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  api_provider = EXCLUDED.api_provider,
  api_model = EXCLUDED.api_model;

-- ============================================
-- END OF SCHEMA
-- ============================================

# Supabase Database Schema

This folder contains the SQL schema for the Open Arena database.

## 📁 Schema File

**schema.sql** - Complete database schema including:
- AI models table
- Trades table (open/closed positions)
- Positions table (current open positions)
- Model reasoning logs
- Performance snapshots
- Waitlist table
- Leaderboard materialized view
- Helper functions

## 💰 Configuring Starting Capital

The starting capital for each model is set in **two places** within `schema.sql`:

### 1. Table Defaults (Line ~38-40)

```sql
-- ⚠️ STARTING CAPITAL: Change these defaults when adjusting capital per model
starting_capital NUMERIC NOT NULL DEFAULT 60.09,  -- Starting capital in USDT
current_equity NUMERIC NOT NULL DEFAULT 60.09,    -- Should match starting_capital for new models
```

### 2. Seed Data (Line ~492-498)

```sql
INSERT INTO models (name, icon, color, api_provider, api_model, starting_capital, current_equity) VALUES
  ('Claude Sonnet 4.5', '🌟', '#f97316', 'anthropic', 'anthropic/claude-sonnet-4.5', 60.09, 60.09),
  -- ... other models with the same capital values
```

**To change starting capital:**
1. Search for `60.09` in `schema.sql`
2. Replace all occurrences with your desired amount
3. Re-run the schema (or update existing rows manually)

## 🚀 How to Apply the Schema

### Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `schema.sql`
4. Run the query

### Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the schema
supabase db push
```

## 📊 Database Schema

### Tables

#### `models`
Stores AI trading models
- `id` (UUID, PK)
- `name` (TEXT) - e.g., "Claude Sonnet 4.5"
- `icon` (TEXT) - Emoji
- `color` (TEXT) - Brand color
- `api_provider` (TEXT) - "anthropic", "openai", etc.
- `api_model` (TEXT) - Model identifier
- `starting_capital` (NUMERIC) - Initial capital in USDT
- `current_equity` (NUMERIC) - Updated in real-time
- `status` (TEXT) - "active", "paused", "stopped"

#### `trades`
All trades (open and closed)
- `id` (UUID, PK)
- `model_id` (UUID, FK)
- `symbol` (TEXT) - e.g., "ETHUSDT"
- `side` (TEXT) - "LONG" or "SHORT"
- `entry_price`, `exit_price` (NUMERIC)
- `quantity`, `leverage` (NUMERIC, INTEGER)
- `notional_value` (NUMERIC)
- `entry_time`, `exit_time` (TIMESTAMP)
- `net_pnl`, `fees` (NUMERIC)
- `status` (TEXT) - "open" or "closed"
- `take_profit_percent`, `stop_loss_percent`, `max_hold_minutes` - Risk parameters

#### `positions`
Current open positions (real-time)
- `id` (UUID, PK)
- `model_id` (UUID, FK)
- `trade_id` (UUID, FK)
- `symbol`, `side` (TEXT)
- `entry_price`, `current_price` (NUMERIC)
- `unrealized_pnl` (NUMERIC)
- `take_profit_percent`, `stop_loss_percent`, `max_hold_minutes` - Risk parameters

#### `model_reasoning`
AI thought process logs
- `id` (UUID, PK)
- `model_id` (UUID, FK)
- `trade_id` (UUID, FK, nullable)
- `reasoning_text` (TEXT) - Full AI reasoning
- `decision` (TEXT) - Trade decision
- `confidence` (INTEGER) - 0-100
- `market_snapshot` (JSONB) - Market context

#### `performance_snapshots`
Performance history for equity curves
- `id` (UUID, PK)
- `model_id` (UUID, FK)
- `equity`, `realized_pnl`, `unrealized_pnl` (NUMERIC)
- `total_fees`, `trade_count` (NUMERIC, INTEGER)
- `win_rate`, `sharpe_ratio` (NUMERIC)
- `timestamp` (TIMESTAMP)

#### `waitlist`
Email signups for waitlist
- `id` (UUID, PK)
- `email` (TEXT, UNIQUE)
- `name` (TEXT, nullable)
- `referral_source` (TEXT, nullable)
- `created_at` (TIMESTAMP)

### Materialized View

#### `leaderboard`
Pre-calculated rankings (refresh periodically)
- `rank`, `model_id`, `name`, `icon`, `color`
- `current_equity`, `total_pnl`, `pnl_percentage`
- `trade_count`, `total_fees`
- `biggest_win`, `biggest_loss`, `win_rate`

### Functions

#### `get_model_statistics(model_id)`
Returns comprehensive stats for a model

#### `update_model_equity(model_id)`
Recalculates and updates model equity

#### `create_performance_snapshot(model_id)`
Creates a new performance snapshot

#### `refresh_leaderboard()`
Refreshes the leaderboard materialized view

#### `notify_waitlist_signup()`
Trigger function that sends pg_notify on new waitlist signups

## 🔐 Security

Row Level Security (RLS) is **disabled** on all tables for simpler service role access. The `service_role` has full access, and `anon` has read-only access.

## 📝 Seed Data

The schema automatically inserts 6 AI models:
- Claude Sonnet 4.5 🌟
- GPT 5 🌀
- Mistral Medium 3.1 🌊
- DeepSeek Chat V3.1 🦜
- Grok 4 ⚡
- Qwen3 Max 🔷

Each starts with the configured starting capital (default: 60.09 USDT).

## 🔄 Useful Commands

Refresh the leaderboard:
```sql
SELECT refresh_leaderboard();
```

Update a model's equity:
```sql
SELECT update_model_equity('model-uuid-here');
```

Create a performance snapshot:
```sql
SELECT create_performance_snapshot('model-uuid-here');
```

Reset all models to starting capital:
```sql
UPDATE models SET current_equity = starting_capital;
```

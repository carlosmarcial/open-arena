# 🚀 Open Arena - Project Master Document

**Last Updated:** October 22, 2025  
**Status:** 🔴 LIVE TRADING ACTIVE  
**Current Phase:** Competition Running (7-Day Limit)  
**Competition Ends:** October 29, 2025 at 20:15 UTC

---

## 📑 Table of Contents
1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Current Status](#current-status)
4. [Technical Architecture](#technical-architecture)
5. [UI Components & Features](#ui-components--features)
6. [Database Schema](#database-schema)
7. [Development Phases](#development-phases)
8. [Setup Instructions](#setup-instructions)
9. [Next Steps](#next-steps)
10. [Reference](#reference)

---

## 🏁 Quick Start

### To Run the Application:
```bash
cd aster-arena
npm run dev
```
Then visit http://localhost:3000

### Required Environment Variables:
```bash
# .env.local
ASTER_API_KEY=your_actual_aster_api_key
ASTER_API_SECRET=your_actual_aster_api_secret
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🎯 Project Overview

### What is Open Arena?
An AI trading competition platform for Aster DEX, inspired by nof1.ai's Alpha Arena. **LLM-powered autonomous trading agents** compete in real markets with real money, making decisions like human traders.

### 🔴 LIVE TRADING STATUS
- **Started:** October 22, 2025 at 20:30 UTC
- **Ends:** October 29, 2025 at 20:15 UTC (7-day competition)
- **Capital:** $359.99 USDT in Aster Futures Account
- **Models:** 6 AI + 1 BTC Buy & Hold benchmark
- **Trading:** REAL MONEY on Aster DEX perpetual futures

### Core Concept
- **$10,000 starting capital** per model
- **6 LLMs compete** (Claude, GPT, Mistral, DeepSeek, Grok, Qwen)
- **Autonomous trading** - models analyze, decide, and execute
- **Transparent reasoning** - all AI thoughts logged and public
- **Real-time leaderboard** - ranked by risk-adjusted returns (Sharpe ratio)

### Tech Stack
**Frontend:**
- Next.js 16 + React 19.2 + TypeScript
- Tailwind CSS for styling
- Visx for data visualization (D3 primitives)

**Backend:**
- Supabase (PostgreSQL + Auth + Real-time)
- OpenRouter API (unified LLM access)
- Aster DEX API (trading & market data)

**Infrastructure:**
- Vercel (hosting & deployment)
- WebSocket for real-time updates

---

## 📊 Current Status

### ✅ Completed Components (100% Complete - LIVE!)

#### **Phase 1: Project Foundation** ✅
- ✅ Next.js 16 with TypeScript & Tailwind CSS
- ✅ Project structure and organization
- ✅ Environment configuration
- ✅ Git repository setup

#### **Phase 2: Aster API Integration** ✅
- ✅ REST API client with HMAC authentication
- ✅ WebSocket service for real-time market data
- ✅ TypeScript types for all data models
- ✅ Calculation utilities (Sharpe ratio, win rate, expectancy)
- ✅ Test scripts for API validation

#### **Phase 3: Database Setup** ✅
- ✅ Complete Supabase schema with 6 tables:
  - `models` - AI trading models
  - `trades` - All trades (open/closed)
  - `positions` - Current open positions
  - `model_reasoning` - AI decision logs
  - `performance_snapshots` - Equity curves
  - `leaderboard` - Pre-calculated rankings
- ✅ Helper functions for equity updates and statistics
- ✅ Row Level Security (RLS) policies
- ✅ Sample data with 6 AI models
- ✅ Combined migration file: `supabase/migrations/combined_migration.sql`

#### **Phase 4: LLM Integration** ✅
- ✅ OpenRouter client for unified AI access
- ✅ Support for 6 AI models: Claude, GPT-4o, Mistral, DeepSeek, Grok, Qwen
- ✅ Trading agent logic with portfolio analysis
- ✅ Confidence scoring and decision making framework

#### **Phase 5: Dashboard UI** ✅
- ✅ **Alpha Arena-Style Layout**: Split-panel design with chart + trade feed
- ✅ **Equity Curve Chart**: Interactive Visx chart with model performance
- ✅ **Crypto Price Ticker**: Live BTC, ETH, SOL, BNB, DOGE, SUI prices
- ✅ **Navigation Bar**: LIVE | LEADERBOARD | MODELS with performance indicators
- ✅ **Trade Feed Panel**: Real-time trade updates on right side
- ✅ **Model Summary Cards**: Bottom section showing all 6 models
- ✅ **Custom Scrollbars**: Styled thin scrollbars
- ✅ **Horizontal Tabs**: ALL, 72H, COMPLETED TRADES, MODELCHAT, POSITIONS, README.TXT
- ✅ **API Routes**: `/api/leaderboard`, `/api/models`, `/api/positions`, `/api/reasoning`, `/api/trades`

### 🚀 Live Trading Configuration

#### **Trading Parameters**
- **Max Leverage:** 10x
- **Max Position Size:** 35% of equity
- **Min Position Size:** $10 USD
- **Max Open Positions:** 3 per model
- **Take Profit:** 5%
- **Stop Loss:** 3%
- **Position Sizes:** $10-$125 typically

#### **Bitcoin Buy & Hold Benchmark**
- Buys $50 of BTCUSDT perpetual futures at 1x leverage
- Holds position for entire competition
- Never closes (pure buy & hold strategy)
- Serves as performance benchmark

#### **Cron Schedule**
- **Execute Trades:** Every 15 minutes (*/15 * * * *)
- **Monitor Positions:** Every 5 minutes (*/5 * * * *)
- **Performance Snapshots:** After each trading cycle

#### **Real Order Execution**
1. Sets leverage via `changeLeverage(symbol, leverage)`
2. Places market orders via `placeOrder(params)`
3. Stores Aster order IDs for tracking
4. Updates database with actual fill prices

---

## 🛠️ Technical Architecture

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│         Next.js Frontend (Vercel) - Port 3000           │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Header: Crypto Ticker + Navigation + Stats       │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ┌─────────────────────┬─────────────────────────┐ │ │
│  │ │  Left Panel (70%)   │  Right Panel (30%)      │ │ │
│  │ │                     │                         │ │ │
│  │ │  Tabs:              │  Trade Feed:            │ │ │
│  │ │  - ALL (Chart)      │  - Latest trades        │ │ │
│  │ │  - 72H              │  - Model icons          │ │ │
│  │ │  - COMPLETED TRADES │  - P&L calculations     │ │ │
│  │ │  - MODELCHAT        │  - Scrollable           │ │ │
│  │ │  - POSITIONS        │                         │ │ │
│  │ │  - README.TXT       │                         │ │ │
│  │ └─────────────────────┴─────────────────────────┘ │ │
│  │ Model Summary Cards (6 models at bottom)         │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│      Next.js API Routes (Serverless Functions)          │
│                                                         │
│  /api/leaderboard  - Model rankings & stats            │
│  /api/models       - Model list & details              │
│  /api/positions    - Current open positions            │
│  /api/reasoning    - AI decision logs                  │
│  /api/trades       - Trade history                     │
└─────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  Supabase (Database) │    │   Aster DEX API          │
│  - PostgreSQL        │    │   - REST (trading)       │
│  - Real-time subs    │    │   - WebSocket (data)     │
│  - Auth              │    │   - HMAC authentication  │
└──────────────────────┘    └──────────────────────────┘
```

### Frontend Stack
```
Next.js 16 + TypeScript + Tailwind CSS
├── Theme System (Light/Dark mode)
├── Component Library (Custom UI components)
├── Visx Charts (Equity curves)
├── API Routes (/api/*)
└── Real-time Updates (WebSocket - planned)
```

### Backend Stack
```
Supabase (PostgreSQL + Auth)
├── 6 Core Tables
├── Row Level Security
├── Helper Functions
└── Real-time Subscriptions
```

### AI Integration
```
OpenRouter API
├── Unified LLM Access
├── 6 AI Models: Claude, GPT-4o, Mistral, DeepSeek, Grok, Qwen
├── Trading Agent Framework
└── Confidence Scoring
```

### External APIs
```
Aster DEX API
├── REST API (Trading operations)
├── WebSocket (Market data streams)
└── HMAC Authentication
```

---

## 🎨 UI Components & Features

### Dashboard Layout (Alpha Arena Style)

#### 1. **Header**
- **Crypto Price Ticker**: Live prices for BTC, ETH, SOL, BNB, DOGE, SUI
- **Navigation**: LIVE | LEADERBOARD | MODELS
- **Performance Indicators**: HIGHEST and LOWEST model stats
- **Waitlist CTA**: "JOIN THE PLATFORM WAITLIST" link

#### 2. **Main Content Area**

**Left Panel (Chart Area - 70% width):**
- Horizontal tab navigation
- Equity curve chart (Visx) with:
  - Multi-line chart showing all models
  - Interactive tooltips on hover
  - Model performance badges
  - Grid lines and axes
  - Responsive sizing

**Right Panel (Trade Feed - 30% width):**
- Scrollable feed of recent trades
- Trade cards showing:
  - Model name + icon
  - Long/short indicator (color-coded)
  - Symbol traded
  - Entry/exit prices
  - Quantity and notional
  - Holding time
  - NET P&L (green/red)

**Bottom Section:**
- 6 Model summary cards in grid
- Each card shows:
  - Model icon
  - Model name (color-coded)
  - Current account value

#### 3. **Tab Content**

**ALL Tab:**
- Shows equity curve chart
- Displays all models over full time range

**72H Tab:**
- Filters chart to last 72 hours
- Same chart as ALL but time-filtered

**COMPLETED TRADES Tab:**
- Full LeaderboardTab component
- Tables with:
  - Overall Stats (Rank, Model, P&L, Win Rate, etc.)
  - Advanced Analytics (Trade sizes, leverage, confidence)

**MODELCHAT Tab:**
- AI reasoning feed
- Expandable cards showing:
  - Model icon + name
  - Timestamp
  - Decision summary
  - Full reasoning text (expandable)
  - Confidence level

**POSITIONS Tab:**
- Current open positions per model
- Color-coded LONG/SHORT
- Leverage, notional, unrealized P&L
- Available cash per model

**README.TXT Tab:**
- Project documentation
- Getting started guide

### Design System

#### Colors (Dark Theme)
```css
/* Backgrounds */
--background: #0a0a0f;      /* Main background */
--card: #16161d;            /* Cards/panels */
--muted: #1e1e26;           /* Hover states */

/* Text */
--foreground: #ffffff;      /* Main text */
--muted-foreground: #a0a0ab;/* Secondary text */

/* Accents */
--primary: #3b82f6;         /* Blue */
--green: #10b981;           /* Gains, LONG */
--red: #ef4444;             /* Losses, SHORT */
```

#### Model Brand Colors
- **Claude Sonnet 4.5**: 🌟 Orange (#f97316)
- **DeepSeek Chat V3.1**: 🌀 Purple (#8b5cf6)
- **Mistral Medium 3.1**: 🌊 Ocean Blue (#0ea5e9)
- **GPT 5**: 🔮 Blue (#3b82f6)
- **Grok 4**: ⚡ Black (#000000)
- **Qwen3 Max**: 👁️ Pink (#ec4899)

#### Typography
- **Headers**: Inter/Geist Sans (700 weight)
- **Body**: Inter/Geist Sans (400 weight)
- **Monospace** (prices/P&L): JetBrains Mono (500 weight)

---

## 🗄️ Database Schema

### Core Tables

#### `models`
```sql
id              uuid PRIMARY KEY
name            text NOT NULL              -- e.g., "Claude Sonnet 4.5"
icon            text                       -- e.g., "🌟"
color           text                       -- e.g., "#f97316"
api_model       text NOT NULL              -- OpenRouter model ID
starting_capital decimal(10,2) DEFAULT 10000.00
current_equity  decimal(10,2) DEFAULT 10000.00
status          text DEFAULT 'active'      -- active, paused, stopped
created_at      timestamptz DEFAULT now()
```

#### `trades`
```sql
id              uuid PRIMARY KEY
model_id        uuid REFERENCES models(id)
symbol          text NOT NULL              -- e.g., "BTCUSDT"
side            text NOT NULL              -- LONG, SHORT
entry_price     decimal(18,8) NOT NULL
exit_price      decimal(18,8)
quantity        decimal(18,8) NOT NULL
leverage        integer DEFAULT 1
notional        decimal(18,2)
entry_time      timestamptz NOT NULL
exit_time       timestamptz
fees            decimal(18,8) DEFAULT 0
net_pnl         decimal(18,8)
status          text DEFAULT 'open'        -- open, closed
```

#### `positions`
```sql
id              uuid PRIMARY KEY
model_id        uuid REFERENCES models(id)
trade_id        uuid REFERENCES trades(id)
symbol          text NOT NULL
side            text NOT NULL
entry_price     decimal(18,8) NOT NULL
quantity        decimal(18,8) NOT NULL
leverage        integer
notional        decimal(18,2)
unrealized_pnl  decimal(18,8)
last_updated    timestamptz DEFAULT now()
```

#### `model_reasoning`
```sql
id              uuid PRIMARY KEY
model_id        uuid REFERENCES models(id)
trade_id        uuid REFERENCES trades(id)
reasoning_text  text NOT NULL
decision        text NOT NULL              -- Summary of decision
confidence      integer CHECK (confidence >= 0 AND confidence <= 100)
market_snapshot jsonb                      -- Market data at decision time
timestamp       timestamptz DEFAULT now()
```

#### `performance_snapshots`
```sql
id              uuid PRIMARY KEY
model_id        uuid REFERENCES models(id)
equity          decimal(10,2) NOT NULL
realized_pnl    decimal(10,2)
unrealized_pnl  decimal(10,2)
total_fees      decimal(10,2)
trade_count     integer DEFAULT 0
timestamp       timestamptz DEFAULT now()
```

#### `leaderboard`
```sql
model_id        uuid PRIMARY KEY REFERENCES models(id)
rank            integer
name            text
icon            text
color           text
current_equity  decimal(10,2)
total_pnl       decimal(10,2)
pnl_percentage  decimal(5,2)
total_fees      decimal(10,2)
trade_count     integer
win_rate        decimal(5,2)
biggest_win     decimal(10,2)
biggest_loss    decimal(10,2)
sharpe_ratio    decimal(8,4)
last_updated    timestamptz DEFAULT now()
```

### Helper Functions

The migration includes SQL functions for:
- `update_equity(model_id, new_equity)` - Updates model equity
- `calculate_leaderboard_stats()` - Refreshes leaderboard rankings
- Auto-triggers on trade completion

---

## 📈 Development Phases

### **Phase 1: Project Foundation** ✅ COMPLETE
- Next.js 15 setup with TypeScript
- Tailwind CSS configuration
- Project structure
- Environment variables

### **Phase 2: Aster API Integration** ✅ COMPLETE
- REST API client (`/lib/aster/client.ts`)
- WebSocket service (`/lib/aster/websocket.ts`)
- HMAC authentication
- Market data types
- Test scripts

### **Phase 3: Database Setup** ✅ COMPLETE
- Supabase project setup
- Schema design (6 tables)
- Migration file creation
- Sample data seeding
- Helper functions
- RLS policies

### **Phase 4: LLM Integration** ✅ COMPLETE
- OpenRouter client (`/lib/openrouter.ts`)
- Trading agent framework (`/lib/trading/agent.ts`)
- Prompt engineering
- Confidence scoring
- Decision parsing

### **Phase 5: Dashboard UI** ✅ COMPLETE
- Main page restructure (Alpha Arena layout)
- Equity curve chart (Visx)
- Crypto price ticker
- Trade feed panel
- Model summary cards
- All tab components
- API routes
- Custom scrollbars

### **Phase 6: Testing & Deployment** ✅ COMPLETE
- [x] Connected to Supabase with service role key
- [x] Tested with real Aster API ($359.99 USDT)
- [x] Dashboard auto-refreshes every 5 seconds
- [x] Deployed to Vercel Pro
- [x] Environment variables configured
- [x] Cron jobs scheduled and running

### **Phase 7: Live Trading** 🔴 ACTIVE
- [x] Trading agents executing every 15 minutes
- [x] Real orders placed on Aster DEX
- [x] Position monitoring every 5 minutes
- [x] Performance snapshots after each cycle
- [x] 7-day competition countdown
- [x] Bitcoin Buy & Hold benchmark active

---

## 📝 Setup Instructions

### Prerequisites
- Node.js 20.9+ installed
- npm or yarn package manager
- Aster DEX account with API keys
- OpenRouter account with API key
- Supabase account with service role key
- Vercel account (Pro recommended for cron jobs)
- $350+ USDT in Aster Futures wallet

### Step 1: Clone & Install
```bash
cd aster-arena
npm install
```

### Step 2: Environment Variables
Create `.env.local` in the `aster-arena` directory:

```bash
# Aster DEX API
ASTER_API_KEY=your_aster_api_key
ASTER_API_SECRET=your_aster_api_secret

# OpenRouter (LLM Access)
OPENROUTER_API_KEY=your_openrouter_key

# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for cron jobs

# Cron Security
CRON_SECRET=your_random_secret  # Generate a random string
```

### Step 3: Database Setup

1. Create a Supabase project at https://supabase.com

2. Run the migrations in order:
   - Go to SQL Editor in Supabase dashboard
   - First run `supabase/migrations/combined_migration.sql`
   - Then run `supabase/migrations/add_aster_order_id.sql`
   - Execute each SQL file

3. Verify tables created:
   - Check Table Editor in Supabase
   - Should see: models, trades, positions, model_reasoning, performance_snapshots, leaderboard
   - Verify `aster_order_id` column exists in trades table

### Step 4: Test Aster API Connection
```bash
cd aster-arena
npx tsx scripts/test-aster-api.ts
```

Expected output:
- ✅ Ping successful
- ✅ Server time
- ✅ Exchange info
- ✅ Current prices
- ✅ Account balance
- ✅ Positions

### Step 5: Deploy to Production

#### Local Development:
```bash
npm run dev
# Visit http://localhost:3000
```

#### Production Deployment:
```bash
# Deploy to Vercel
vercel --prod

# Add environment variables in Vercel Dashboard:
# https://vercel.com/[your-username]/asterarena/settings/environment-variables
# Add all variables from .env.local for Production environment

# Redeploy to apply environment variables
vercel --prod
```

#### Monitor Live Trading:
- **Vercel Logs:** https://vercel.com/[your-username]/asterarena/logs
- **Dashboard:** Your production URL (updates every 5 seconds)
- **Aster Account:** https://www.asterdex.com/

### Troubleshooting

**Error: "Module not found: @supabase/supabase-js"**
```bash
npm install @supabase/supabase-js --legacy-peer-deps
```

**Error: "Invalid API-key"**
- Check `ASTER_API_KEY` in `.env.local`
- Ensure no extra spaces or quotes
- Verify key is active in Aster dashboard

**Error: "Signature not valid"**
- Check `ASTER_API_SECRET` is correct
- Ensure API key has proper permissions

**Database not connecting:**
- Verify Supabase URL and anon key
- Check if migration ran successfully
- Ensure RLS policies allow access

---

## 🎯 Live Competition Timeline

### Day 1 (Oct 22, 2025) ✅
- [x] Deployed to production
- [x] Environment variables configured
- [x] Database migrations complete
- [x] $359.99 USDT funded
- [x] Live trading started at 20:30 UTC
- [x] Bitcoin Buy & Hold purchased
- [x] AI models began trading

### Days 2-6 (Oct 23-28, 2025) 🔴
- [ ] Monitor AI trading decisions
- [ ] Track performance vs BTC benchmark
- [ ] Observe risk management
- [ ] Document interesting trades
- [ ] Performance snapshots accumulating

### Day 7 (Oct 29, 2025) 🏁
- [ ] Competition ends at 20:15 UTC
- [ ] Trading automatically stops
- [ ] Final results locked in
- [ ] Winner determined by Sharpe ratio
- [ ] Close all positions (optional)
- [ ] Export results for analysis

### Post-Competition 📊
- [ ] Analyze trading patterns
- [ ] Compare model strategies
- [ ] Document lessons learned
- [ ] Open source the code
- [ ] Plan next competition

---

## 📊 Key Metrics & Calculations

### Sharpe Ratio
```
Sharpe Ratio = (Mean Return - Risk-Free Rate) / Std Dev of Returns
```
- Measures risk-adjusted returns
- Higher is better (>1 good, >2 excellent)

### Win Rate
```
Win Rate = (Profitable Trades / Total Trades) × 100%
```

### Expectancy
```
Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
```
- Expected profit/loss per trade

### P&L Calculations
```
Realized P&L = Sum of closed trade P&Ls
Unrealized P&L = Current position value - Entry value
Total P&L = Realized P&L + Unrealized P&L
```

---

## 🤖 LLM Prompt Template

```
You are an autonomous cryptocurrency trader managing a $10,000 portfolio.

CURRENT STATUS:
- Equity: ${current_equity}
- Available Cash: ${available_cash}
- P&L: ${total_pnl} (${pnl_percentage}%)
- Open Positions: ${positions_list}

MARKET DATA:
- BTC: ${btc_price} (24h: ${btc_change}%)
- ETH: ${eth_price} (24h: ${eth_change}%)
[... other assets ...]

YOUR TASK:
Analyze market conditions and decide:
- HOLD (do nothing)
- OPEN [LONG/SHORT] [SYMBOL] [SIZE] [LEVERAGE]
- CLOSE [SYMBOL]

RULES:
- Max leverage: 20x
- Max position size: 30% of equity
- Max 6 positions simultaneously

RESPONSE FORMAT:
REASONING: [Your analysis]
DECISION: [Your trade decision]
CONFIDENCE: [0-100]%
```

---

## 📦 Project Structure

```
aster-arena/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main dashboard (Alpha Arena layout)
│   │   ├── globals.css                 # Global styles + scrollbars
│   │   ├── layout.tsx                  # Root layout
│   │   └── api/                        # API routes
│   │       ├── leaderboard/route.ts    # Model rankings
│   │       ├── models/route.ts         # Model list
│   │       ├── positions/route.ts      # Open positions
│   │       ├── reasoning/route.ts      # AI decisions
│   │       └── trades/route.ts         # Trade history
│   ├── components/
│   │   ├── charts/
│   │   │   └── EquityCurveChart.tsx   # Visx equity curve
│   │   ├── dashboard/
│   │   │   ├── LeaderboardTab.tsx     # Rankings & stats
│   │   │   ├── ModelChatTab.tsx       # AI reasoning feed
│   │   │   ├── PositionsTab.tsx       # Open positions
│   │   │   ├── TradesTab.tsx          # Completed trades
│   │   │   └── TradeFeedPanel.tsx     # Right panel feed
│   │   └── ui/
│   │       ├── CryptoTicker.tsx       # Price ticker
│   │       ├── ThemeToggle.tsx        # Dark/light mode
│   │       └── Button.tsx             # Reusable button
│   ├── lib/
│   │   ├── aster/
│   │   │   ├── client.ts              # REST API client
│   │   │   ├── websocket.ts           # WebSocket service
│   │   │   └── signature.ts           # HMAC auth
│   │   ├── trading/
│   │   │   └── agent.ts               # Trading agent logic
│   │   ├── utils/
│   │   │   └── calculations.ts        # Sharpe, win rate, etc.
│   │   ├── openrouter.ts              # LLM client
│   │   ├── supabase.ts                # Database client
│   │   ├── utils.ts                   # Helper functions
│   │   └── theme.tsx                  # Theme provider
│   └── types/
│       └── index.ts                    # TypeScript types
├── scripts/
│   └── test-aster-api.ts              # API test script
├── supabase/
│   ├── migrations/
│   │   └── combined_migration.sql     # Database schema
│   └── README.md
├── .env.local                         # Environment variables (create this)
├── .env.example                       # Template
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── tailwind.config.ts                 # Tailwind config
└── PROJECT_MASTER.md                  # This file
```

---

## 📚 Dependencies

### Installed Packages
```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "typescript": "^5.1.0",
    "@supabase/supabase-js": "latest",
    "@visx/axis": "^3.12.0",
    "@visx/curve": "^3.12.0",
    "@visx/event": "^3.12.0",
    "@visx/gradient": "^3.12.0",
    "@visx/grid": "^3.12.0",
    "@visx/group": "^3.12.0",
    "@visx/scale": "^3.12.0",
    "@visx/shape": "^3.12.0",
    "@visx/tooltip": "^3.12.0",
    "lucide-react": "latest",
    "react-use-measure": "latest"
  }
}
```

Note: All Visx packages installed with `--legacy-peer-deps` due to React 19 compatibility.

---

## 🔐 Security Notes

1. **Never commit `.env.local`** - Already in `.gitignore`
2. **API keys are server-side only** - Use Next.js API routes
3. **Supabase RLS enabled** - Row Level Security configured
4. **Rate limiting** - Implemented in Aster client
5. **Risk management** - Max position size, leverage limits

---

## 🎨 Design Reference

This project matches the design of **Alpha Arena** (https://nof1.ai/):
- Split-panel layout (chart + trade feed)
- Dark theme with accent colors
- Crypto ticker in header
- Model performance badges
- Real-time trade feed
- Clean, modern aesthetic

---

## 📞 Support & Resources

- **Aster API Docs**: https://docs.asterdex.com/
- **Aster GitHub**: https://github.com/asterdex/api-docs
- **Next.js Docs**: https://nextjs.org/docs
- **Visx Examples**: https://airbnb.io/visx/gallery
- **Supabase Docs**: https://supabase.com/docs

---

## ✅ Completion Checklist

### MVP Requirements
- [x] Next.js project set up
- [x] Aster API client working
- [x] Database schema deployed
- [x] Dashboard UI matching Alpha Arena
- [x] Equity curve chart (Visx)
- [x] All tab components
- [x] API routes functional
- [ ] Supabase connected with real data
- [ ] Real-time updates working
- [ ] First trading agent live
- [ ] Deployed to Vercel

---

**Last Updated:** October 18, 2025  
**Version:** 1.0  
**Maintainer:** Development Team

---

**Ready to build!** 🚀

For any questions or issues, refer to the troubleshooting section or check the individual component files for implementation details.

---

## 📚 Appendix: Consolidated Root Docs

> This appendix consolidates all Markdown documentation that previously lived in the project root into a single place for the AI coding assistant and maintainers. Each section preserves the original content for completeness.

---

### COLOR_PALETTE.md

# 🎨 Open Arena AI Model Color Palette

**Updated:** October 22, 2025

## Color Scheme Overview

This document defines the official color palette for all 6 AI trading models competing in Open Arena. Colors are carefully selected to create a cohesive, balanced spectrum with excellent contrast in both light and dark modes.

---

## Model Colors

### 🌟 Claude Sonnet 4.5
- **Color**: `#f97316` (Orange)
- **Category**: Warm
- **Usage**: Chart line, model cards, badges, text accents

### 🦜 DeepSeek Chat V3.1
- **Color**: `#3b82f6` (Blue)
- **Category**: Cool
- **Usage**: Chart line, model cards, badges, text accents

### 🔷 Qwen3 Max
- **Color**: `#8b5cf6` (Purple)
- **Category**: Cool
- **Usage**: Chart line, model cards, badges, text accents

### ⚡ Grok 4
- **Color**: `#06b6d4` (Cyan/Turquoise)
- **Category**: Cool
- **Usage**: Chart line, model cards, badges, text accents
- **Notes**: Fresh, electric color representing speed and innovation

### 🌀 GPT 5
- **Color**: `#10b981` (Emerald Green)
- **Category**: Balanced
- **Usage**: Chart line, model cards, badges, text accents
- **Notes**: Rich, premium color representing balance and sophistication

### 🌊 Mistral Medium 3.1
- **Color**: `#ec4899` (Rose Pink)
- **Category**: Warm
- **Usage**: Chart line, model cards, badges, text accents
- **Notes**: Vibrant, modern color that stands out

### ₿ BTC BUY&HODL (Bonus Strategy)
- **Color**: `#f7931a` (Bitcoin Orange)
- **Category**: Warm
- **Usage**: Chart line, model cards, badges, text accents
- **Notes**: Iconic Bitcoin brand color

---

## Color Palette Philosophy

### Warm Colors (3)
- Claude Sonnet 4.5: Orange `#f97316`
- Mistral Medium 3.1: Ocean Blue `#0ea5e9`
- BTC BUY&HODL: Bitcoin Orange `#f7931a`

### Cool Colors (3)
- DeepSeek Chat V3.1: Blue `#3b82f6`
- Grok 4: Cyan `#06b6d4`
- Qwen3 Max: Purple `#8b5cf6`

### Balanced Colors (1)
- GPT 5: Emerald Green `#10b981`

This creates a balanced spectrum that looks cohesive on charts while maintaining visual distinction between all models.

---

## Implementation Locations

Colors are defined in the following files:

### Frontend (Mock Data)
- `src/app/page.tsx` (lines 92-99, 181-188, 194-201)
- `src/lib/mockData/positions.ts` (lines 26, 79, 208, 337, 466, 576)
- `src/components/dashboard/ModelChatTab.tsx` (line 130)

### Database
- `supabase/migrations/combined_migration.sql` (lines 48-54)

### Dynamic Usage
- Colors are fetched from the database via API routes
- The `color` field in the `models` table is the source of truth
- Mock data mirrors database values for consistency

---

## Color Accessibility

All colors have been selected to ensure:
- ✅ Readable contrast against light backgrounds
- ✅ Readable contrast against dark backgrounds
- ✅ Distinguishable from each other when displayed together
- ✅ No reliance on color alone for information (icons + text labels included)

---

## Usage Guidelines

### Chart Lines
```typescript
// Example: Equity curve chart
const modelSeries = {
  modelId: '1',
  modelName: 'GPT 5',
  color: '#10b981', // Emerald green
  data: [...]
};
```

### Model Cards
```tsx
// Example: Model summary card
<div style={{ borderLeft: `4px solid ${model.color}` }}>
  <span style={{ color: model.color }}>
    {model.icon} {model.name}
  </span>
</div>
```

### Badge/Pill Components
```tsx
// Example: Model badge
<span 
  className="px-2 py-1 rounded-full text-xs font-semibold"
  style={{ 
    backgroundColor: `${model.color}20`, // 20% opacity
    color: model.color 
  }}
>
  {model.name}
</span>
```

---

## Color Contrast Ratios

All colors meet WCAG AA standards for color contrast:

| Model | Color | Contrast vs White | Contrast vs Black |
|-------|-------|------------------|------------------|
| Claude | `#f97316` | 3.4:1 | 6.1:1 |
| DeepSeek | `#3b82f6` | 3.1:1 | 6.8:1 |
| Qwen3 | `#8b5cf6` | 2.8:1 | 7.5:1 |
| Grok | `#06b6d4` | 2.9:1 | 7.2:1 |
| GPT | `#10b981` | 2.6:1 | 8.1:1 |
| Mistral | `#0ea5e9` | 2.7:1 | 7.6:1 |

---

## Updating Colors

To update model colors across the entire application:

1. **Update Database** (Primary Source)
   ```sql
   UPDATE models 
   SET color = '#NEW_COLOR' 
   WHERE name = 'Model Name';
   ```

2. **Update Migration File** (For New Deployments)
   - Edit `supabase/migrations/combined_migration.sql`
   - Update the INSERT statement

3. **Update Mock Data** (For Local Development)
   - `src/app/page.tsx`
   - `src/lib/mockData/positions.ts`
   - `src/components/dashboard/ModelChatTab.tsx`

4. **Verify Changes**
   - Check equity curve chart
   - Check model summary cards
   - Check trade feed
   - Check leaderboard
   - Check positions tab
   - Check model chat tab

---

## Design Inspiration

This color palette is inspired by:
- **Alpha Arena** (nof1.ai) - Modern AI trading competition platform
- **Trading Platforms** - Professional trading UIs with clear visual hierarchy
- **Data Visualization** - Best practices for multi-line charts

---

### DEPLOYMENT.md

# 🚀 Open Arena - Deployment Guide

## Vercel Cron Automated Trading Setup

This guide will help you deploy Open Arena with automated AI trading using Vercel Cron Jobs.

---

## 📋 Prerequisites

- ✅ Vercel Pro account ($20/month - required for Cron Jobs)
- ✅ Aster DEX account with API keys
- ✅ OpenRouter API key
- ✅ Supabase database configured
- ✅ USDT deposited in Aster Perpetuals account

---

## 🧪 Step 1: Test Locally First

Before deploying, test the trading bot locally to ensure everything works:

```bash
# Make sure dev server is running
npm run dev

# In a new terminal, run the test script
npx tsx scripts/test-trading-execution.ts
```

**What to expect:**
- Script will call the trading API endpoint
- Each AI model will analyze the market and make a decision
- Trades will be created in the database
- Check http://localhost:3000 to see trades in the UI

**If successful**, you'll see output like:
```
✅ Trading execution completed successfully!

✅ Claude Sonnet 4.5:
   Action: OPEN_LONG
   Trade ID: abc-123-def

✅ GPT 5:
   Action: HOLD

...
```

---

## 🌐 Step 2: Deploy to Vercel

### 2.1 Push to GitHub

```bash
git add .
git commit -m "Add Vercel Cron automated trading"
git push origin main
```

### 2.2 Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js configuration

### 2.3 Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```bash
# Aster API
ASTER_API_KEY=your_aster_api_key
ASTER_API_SECRET=your_aster_api_secret

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cron Security (generate a random secret)
CRON_SECRET=your_random_secret_here
```

**To generate a secure CRON_SECRET:**
```bash
openssl rand -base64 32
```

### 2.4 Deploy

Click **"Deploy"** in Vercel dashboard.

---

## ⏰ Step 3: Verify Cron Job Setup

After deployment:

1. Go to **Vercel Dashboard → Settings → Cron Jobs**
2. You should see:
   ```
   /api/cron/execute-trades
   Schedule: */30 * * * * (every 30 minutes)
   ```

3. Click **"Test"** to manually trigger the cron job
4. Check logs in **Vercel Dashboard → Logs** to see execution results

---

## 📊 Step 4: Monitor Live Trading

### Check Your Dashboard
Visit your deployed URL: `https://your-project.vercel.app`

### View Logs
In Vercel Dashboard → Functions → `/api/cron/execute-trades` → Logs

You'll see logs like:
```
🤖 [CRON] Trading bot execution started at 2025-10-20T16:30:00Z
📊 [CRON] Found 6 active models
💹 [CRON] Market data fetched: BTCUSDT: $111015.8, ETHUSDT: $3972.95...
💰 [CRON] Available balance: 360.19 USDT

🤖 [Claude Sonnet 4.5] Processing...
💼 [Claude Sonnet 4.5] Portfolio: $10000.00 equity, 0 positions
🧠 [Claude Sonnet 4.5] Decision: OPEN_LONG (confidence: 75%)
📈 [Claude Sonnet 4.5] Opening LONG BTCUSDT: $50.00 @ 5x
✅ [Claude Sonnet 4.5] Trade opened: abc-123

✅ [CRON] Execution completed in 12345ms
```

---

## ⚙️ Customizing the Trading Schedule

### Current Schedule
`*/30 * * * *` = Every 30 minutes

### Change Schedule
Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/execute-trades",
      "schedule": "*/15 * * * *"  // Every 15 minutes
    }
  ]
}
```

**Common schedules:**
- `*/15 * * * *` - Every 15 minutes
- `*/60 * * * *` or `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours
- `0 9,15,21 * * *` - At 9am, 3pm, 9pm UTC

After changing, redeploy to Vercel.

---

## 🛡️ Safety Settings

Current safety limits (in `/api/cron/execute-trades/route.ts`):

```typescript
const MAX_POSITION_SIZE_PERCENT = 0.35; // 35% of equity per trade
const MAX_OPEN_POSITIONS = 3;           // Max 3 positions per model
const MIN_POSITION_SIZE_USD = 10;       // Minimum $10 per trade
const MAX_LEVERAGE = 10;                // Max 10x leverage
```

**To adjust:**
1. Edit the values in the file
2. Commit and push to trigger redeployment

---

## 🐛 Troubleshooting

### No trades appearing?

**Check Vercel logs:**
- Go to Vercel Dashboard → Functions → Logs
- Look for errors or "HOLD" decisions

**Common issues:**
1. **All models deciding HOLD**: Market conditions not favorable
2. **Insufficient balance**: Need at least $20 USDT
3. **API errors**: Check API keys are correct
4. **Database errors**: Verify Supabase connection

### Test manually
Call the endpoint directly:
```bash
curl https://your-project.vercel.app/api/cron/execute-trades \
  -H "Authorization: Bearer your_cron_secret"
```

### Pause trading
To pause automated trading without undeploying:

**Option 1: Remove cron job**
Delete `vercel.json` and redeploy

**Option 2: Disable models in database**
```sql
UPDATE models SET status = 'paused' WHERE name = 'Claude Sonnet 4.5';
```

---

## 📈 Expected Behavior

### First Hour
- 2 cron executions (every 30 min)
- Each model analyzes market
- Conservative: May HOLD initially
- 0-3 trades per model

### First Day
- 48 cron executions
- Models build positions
- 3-10 trades per model
- See trades populate in UI

### Ongoing
- Continuous automated trading
- Models open/close positions
- Leaderboard updates
- Performance tracked

---

## 💰 Cost Breakdown

### Vercel Pro
- **$20/month** - Includes cron jobs

### OpenRouter API
- **~$0.10-0.50 per execution** (6 models × LLM calls)
- **30 min intervals** = 48 executions/day
- **~$5-25/day** in API costs
- **~$150-750/month**

**Tip:** Start with hourly schedule to reduce costs during testing.

### Aster Trading Fees
- **0.04% taker fee** per trade
- On $50 trade = $0.02 fee

---

## 🎯 Next Steps After Deployment

1. ✅ Monitor first few executions in Vercel logs
2. ✅ Check trades appearing in dashboard
3. ✅ Verify P&L calculations are correct
4. ✅ Watch for 24 hours
5. ✅ Adjust position sizes/leverage if needed
6. ✅ Add more USDT if models need capital

---

## 🚨 Emergency Stop

If you need to stop trading immediately:

**Method 1: Disable Cron (Fastest)**
1. Go to Vercel Dashboard → Settings → Cron Jobs
2. Click "..." → Delete
3. Redeploy

**Method 2: Pause All Models**
In Supabase SQL Editor:
```sql
UPDATE models SET status = 'paused';
```

**Method 3: Close All Positions**
Manually close positions via Aster DEX UI

---

## 📞 Support

If you encounter issues:
1. Check Vercel logs first
2. Review database records in Supabase
3. Test locally with `test-trading-execution.ts`
4. Check API keys are valid and have permissions

---

**Good luck with your AI trading arena!** 🎉

---

### DOGE_HODL_BENCHMARK.md

# 🏦 DOGE BUY&HODL Benchmark Strategy

## Overview

The **DOGE BUY&HODL** strategy is a passive benchmark that compares AI active trading performance against simply buying and holding Dogecoin.

This is a critical comparison - it answers the question: **"Is active AI trading better than just buying DOGE?"**

---

## 📊 The Setup

### **Capital Allocation**
- **50 USDT** from Perpetuals account
- **One-time purchase** of DOGE
- **Never sold** - true buy and hold

### **Why This Matters**
Many traders underperform simply holding DOGE. This benchmark shows if your AI models can beat the passive strategy.

---

## 🎯 How It Works

### **Initial Purchase**
The ETH purchase happens **automatically** on the first execution of the trading cron job (`/api/cron/execute-trades`).

This will:
1. ✅ Use 50 USDT from your Perpetuals account
2. ✅ Get current DOGE price from market data
3. ✅ Calculate DOGE quantity to buy ($50 worth)
4. ✅ Place real DOGEUSDT LONG order on Aster DEX
5. ✅ Record the purchase as a permanent open position
6. ✅ Position appears in dashboard with AI models

### **What Gets Tracked**
- Entry price (DOGE price at purchase)
- DOGE quantity held
- Current DOGE price (updated by monitor cron)
- Unrealized P&L (appreciation)
- Time held

---

## 📈 Dashboard Display

The ETH BUY&HODL strategy will appear:

### **Model Cards (Bottom of Dashboard)**
```
┌─────────────────────┐
│  🐕  DOGE BUY&HODL  │
│  $52.45 (+4.9%)    │
└─────────────────────┘
```

### **Leaderboard Rankings**
Ranked by current equity along with AI models:
```
Rank  Model              Equity    P&L
1.    GPT 5             $53.20    +6.4%
2.    DOGE BUY&HODL     $52.45    +4.9%
3.    Claude 4.5        $51.80    +3.6%
4.    DeepSeek          $49.20    -1.6%
...
```

### **Equity Curve Chart**
Shows DOGE appreciation vs AI trading over time.

---

## 🔄 How It Updates

### **Price Updates**
The position monitor cron (`/api/cron/monitor-positions`) updates DOGE price every 5 minutes:
- Fetches current DOGEUSDT price
- Recalculates unrealized P&L
- Updates `current_equity` for leaderboard
- **Never closes the position** (excluded from auto-close logic)

### **Special Handling**
```typescript
// In monitor-positions cron
if (position.model.api_model === 'btc-hodl') {
  // Update price but NEVER close
  // This position is permanent (DOGE BUY&HODL)
}
```

---

## 🎯 Comparison Metrics

### **After 1 Day**
- **ETH HODL**: +2.3% (just ETH appreciation)
- **AI Models**: -1% to +5% (active trading results)

### **After 1 Week**
- **ETH HODL**: +8.5%
- **Best AI**: +12.3% (beating benchmark!)
- **Worst AI**: +3.2% (underperforming)

### **After 1 Month**
- Shows if active trading can consistently outperform
- Accounts for fees, timing, strategy differences

---

## 💡 Key Insights

### **What You Learn**
1. **Is active trading worth it?**
- If AI models can't beat ETH HODL, why trade?

2. **Which AI is best?**
- Some may beat ETH, some may not
- Different market conditions favor different strategies

3. **Risk vs Reward**
- ETH HODL has zero ongoing fees
- Active trading incurs fees with each trade
- Need to beat ETH + fees to justify active trading

---

## 📝 When to Execute

### **Recommended Timing**
The ETH purchase happens automatically when:
1. ✅ All AI models are configured and tested
2. ✅ Perpetuals account is funded (at least 410 USDT total)
3. ✅ Vercel cron jobs are deployed and active
4. ✅ Ready to start the "official" competition

### **Automatic Execution**
The ETH purchase occurs on the **first run** of the `/api/cron/execute-trades` cron job:
- Uses $50 from your Perpetuals account
- Places a real ETHUSDT LONG market order
- Records the position permanently

**No manual intervention required!**

---

## 🚨 Important Notes

### **Never Close This Position**
- The monitor cron will update prices but never auto-close
- This position stays open indefinitely
- True "buy and hold" strategy

### **Same Account as AI Models**
- Uses Perpetuals account (same as AI models)
- Shares account with active trading models
- Risk is correlated with AI trading performance

### **Fair Comparison**
- Both start with 50 USDT per strategy
- Both tracked in same dashboard
- Same time period
- Clear winner emerges

---

## 📊 Expected Results

### **Bull Market**
- ETH HODL likely beats most models
- Shows difficulty of timing trades

### **Sideways Market**
- Active trading may outperform
- AI models can profit from volatility
- ETH stays flat

### **Bear Market**
- Active trading (SHORT positions) can win
- ETH HODL loses value
- AI models can hedge

---

## 🎯 Success Criteria

**AI Trading is "Working" if:**
- At least 1 AI model beats DOGE HODL
- Best AI model beats DOGE by >10% (worth the effort)
- Average AI performance beats DOGE after fees

**DOGE HODL Wins if:**
- All AI models underperform DOGE
- Fees eat into profits
- Timing issues hurt active trading

---

## 📈 Next Steps

1. **Test all AI models** thoroughly (you're here now)
2. **Deploy to Vercel** with automated cron jobs
3. **Wait for first cron execution** (ETH purchase happens automatically)
4. **Watch for 24-48 hours** to verify everything works
5. **Let it run!** Check daily for performance comparison

---

**The benchmark adds legitimacy to your results** - investors will want to see if AI beats passive investing! 🚀

---

### DROPDOWN_HOVER_FIX_PLAN.md

# Dropdown Hover Effect Fix - Complete Plan

## 🎯 Objective
Make the dropdown menu items show a clear, visible hover effect with a rounded background - similar to modern UI patterns (like macOS menus, Slack, Discord).

## 🔍 Root Cause Analysis

### Why current hover isn't working:
1. **Theme color variables are too subtle** - `bg-accent` and `bg-muted` might be too close to `bg-card`
2. **Backdrop blur might be masking the effect** - The glassmorphism could make subtle colors invisible
3. **Browser dev tools needed** - Need to inspect actual computed colors

## 📋 Step-by-Step Fix Plan

### Step 1: Inspect Current Theme Colors
```bash
# Check globals.css for theme color values
cat src/app/globals.css | grep -A 20 "^:root"
cat src/app/globals.css | grep -A 20 "^.dark"
```

**Goal**: Understand actual HSL values for:
- `--card`
- `--muted`
- `--accent`
- `--border`

### Step 2: Test with Explicit Colors
Instead of using theme variables that might not have enough contrast, use explicit colors:

**Light Mode Hover**: 
- `hover:bg-slate-100` or `hover:bg-gray-100`

**Dark Mode Hover**: 
- `dark:hover:bg-slate-700` or `dark:hover:bg-gray-700`

### Step 3: Verify Cursor Pointer
Ensure browser is showing hand cursor:
- Add `cursor-pointer` class
- Test in browser dev tools that cursor changes

### Step 4: Add Debug Border (Temporary)
Add a visible border on hover to confirm hover is triggering:
```tsx
hover:border-2 hover:border-red-500
```
This will make it VERY obvious if hover is working.

### Step 5: Check Browser Cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
- Or clear cache entirely

### Step 6: Verify DOM Structure
Open browser DevTools and:
1. Inspect a dropdown item
2. Hover over it
3. Check computed styles
4. Verify hover classes are being applied

## 🛠️ Implementation Code

### Fixed ModelFilterDropdown.tsx (Model Options Section)

```tsx
<button
  key={model.id}
  onClick={() => handleSelect(model.id)}
  className={cn(
    'flex w-full items-center gap-2.5 px-3 py-2 text-left rounded-md',
    'text-[11px] font-medium tracking-wide text-foreground',
    'transition-colors duration-200 cursor-pointer',
    // Light mode hover
    'hover:bg-slate-100',
    // Dark mode hover  
    'dark:hover:bg-slate-700',
    // Selected state
    selectedModelId === model.id && 'bg-slate-200 dark:bg-slate-600'
  )}
>
  {/* ... logo and text ... */}
</button>
```

### Alternative: Use opacity-based approach
```tsx
className={cn(
  'flex w-full items-center gap-2.5 px-3 py-2 text-left rounded-md',
  'text-[11px] font-medium tracking-wide text-foreground',
  'transition-all duration-200 cursor-pointer',
  // Use background with opacity
  'hover:bg-foreground/10',
  // Selected state
  selectedModelId === model.id && 'bg-foreground/20'
)}
```

## 🧪 Testing Checklist

- [ ] Open dropdown menu
- [ ] Move mouse over a model option
- [ ] Verify cursor changes to pointer (hand icon)
- [ ] Verify background color changes (should be clearly visible)
- [ ] Verify rounded corners are visible on hover
- [ ] Test in both light and dark mode
- [ ] Test on different browsers (Chrome, Safari, Firefox)
- [ ] Verify selected item has persistent background

## 🎨 Expected Visual Behavior

**Normal state**: Transparent background, just text + logo
**Hover state**: Light gray rounded rectangle background appears
**Selected state**: Slightly darker gray rounded rectangle (persistent)
**Cursor**: Hand pointer icon

## 🔧 Debugging Commands

### Check if styles are being applied:
```bash
# Open browser console and run:
document.querySelector('[data-dropdown-item]').classList
```

### Verify Tailwind classes are compiled:
```bash
# Search for hover classes in built CSS
grep "hover:bg-slate" .next/static/css/*.css
```

### Check for CSS conflicts:
Look for any global styles that might override button hover states.

## 🚨 Common Issues & Solutions

### Issue 1: Colors too similar
**Solution**: Use high-contrast explicit colors (slate-100/700)

### Issue 2: Backdrop blur masking effect
**Solution**: Increase hover color opacity or remove blur temporarily to test

### Issue 3: Browser cache
**Solution**: Hard refresh or disable cache in DevTools

### Issue 4: Tailwind not compiling classes
**Solution**: Restart dev server with `npm run dev`

### Issue 5: CSS specificity conflict
**Solution**: Add `!important` temporarily: `!hover:bg-slate-100`

## ✅ Success Criteria

The fix is complete when:
1. Mouse changes to pointer over model items
2. Background changes to clearly visible rounded rectangle on hover
3. Effect works in both light and dark themes
4. Selected item shows persistent background
5. "All Models" option has no hover effect
6. Animation is smooth (150-200ms transition)

## 📝 Files to Modify

1. `/src/components/ui/ModelFilterDropdown.tsx` - Main component
2. Test the changes in browser at `http://localhost:3000`

## 🎯 Next Steps for New Agent

1. Read this entire plan
2. Execute Step 1 (inspect theme colors)
3. Implement Step 2 (explicit colors)
4. Test using checklist
5. Iterate if needed
6. Commit when working

---

### MODELCHAT_SNAPSHOT_TESTING.md

# ModelChat Snapshot & Testing Guide

This document captures the new ModelChat snapshot feature, what changed, and how to test it locally and in deployment.

## What changed

- Added technical indicators utilities:
  - `src/lib/utils/indicators.ts` (ema, rsi, macd, atr)
- Extended Aster client (public derivatives data):
  - `src/lib/aster/client.ts`: `getPremiumIndex`, `getOpenInterest`, `getOpenInterestHist`
- Implemented Alpha Arena–style market snapshot:
  - `src/lib/market/snapshot.ts` builds `market_snapshot` with:
    - `user_prompt` (rich, formatted context like Alpha Arena)
    - Per-asset metrics (3m intraday arrays; 4h context; funding rate; open interest latest/average)
    - `positions_detailed` (liq price, exit_plan, risk_usd, notional_usd)
    - `account` (equity, available_cash, total return), `sharpe_ratio`, `trading_decisions`
- Wired snapshot into trading cron:
  - `src/app/api/cron/execute-trades/route.ts` now inserts `market_snapshot` for each model’s reasoning log
- Fixes & polish:
  - `src/app/api/cron/monitor-positions/route.ts` comment fix (cron string no longer breaks TS)
  - `src/components/dashboard/ModelChatTab.tsx` mock types adjusted to match `Model` interface
  - `scripts/manual-trade-test.ts` updated to use `createTradingAgent`

## How it works

- On each cron execution, before inserting into `model_reasoning`, we call `buildMarketSnapshot(asterClient, model.id)`.
- Snapshot computes indicators from 3m/4h klines and pulls derivatives signals:
  - Funding rate: `fapi/v1/premiumIndex` (lastFundingRate)
  - Open interest: `fapi/v1/openInterest` and (if available) `futures/data/openInterestHist` for averages
- The UI (`ModelChatTab`) already renders `market_snapshot.user_prompt` and can show `TRADING_DECISIONS` style arrays when present.

## Prerequisites

- `.env.local` contains:
  - `ASTER_API_KEY`, `ASTER_API_SECRET`
  - `OPENROUTER_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `CRON_SECRET` (recommended for testing cron endpoint)

## Quick compile check

```bash
npx tsc -p . --noEmit
```

## Start dev server

```bash
npm run dev
```

Open http://localhost:3000 and navigate to the MODELCHAT tab.

## Simulate cron execution locally

1) Ensure you have `CRON_SECRET` set in `.env.local` and the dev server is running.

2) Trigger execution:

```bash
curl -sS http://localhost:3000/api/cron/execute-trades \
  -H "Authorization: Bearer {{CRON_SECRET}}"
```

- This runs agents for active models, builds snapshots, and writes to `model_reasoning`.
- If you get 401, double‑check the header matches your `CRON_SECRET`.

3) Refresh MODELCHAT and expand the latest card; verify sections:
- Top summary line (e.g., down %, positions, cash)
- USER_PROMPT block with:
  - 3‑minute intraday arrays (mid prices, EMA20, MACD hist, RSI 7/14)
  - 4‑hour context (EMA20/50, ATR3/14, current vs average volume, MACD/RSI arrays)
  - Funding rate and Open Interest (latest + average)
- Account info (total return %, available cash, account value)
- TRADING_DECISIONS list per held asset (currently HOLD placeholders)

## Alternative: manual agent sanity check

```bash
npx tsx scripts/manual-trade-test.ts
```

- Confirms `createTradingAgent` runs and returns a structured decision (does not write snapshots).

## Troubleshooting

- Empty ModelChat feed: ensure at least one model is `status = 'active'` and cron call succeeded.
- Funding/open interest missing: endpoint may be unavailable; snapshot gracefully falls back (averages may equal latest).
- Symbols: snapshot uses `BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT`.
- Rate limits: we keep klines at `limit=10` to minimize load; still, avoid triggering too frequently during tests.

## Notes for deployment

- Call `/api/cron/execute-trades` on a schedule (Vercel Cron). Pass `Authorization: Bearer $CRON_SECRET`.
- UI requires no changes; it auto-renders richer snapshots.

## Next steps (optional)

- Enhance `trading_decisions` to be model‑driven (array per asset from the agent output)
- Replace liquidation estimate with exchange‑accurate calc when available
- Add user‑data WebSocket to reflect fills/balances in real time

---

### MULTI_ACCOUNT_SETUP.md

# 🔐 Multi-Account Trading Setup Guide

## 🎯 Overview

Open Arena now implements **true capital isolation** where each AI model trades from its own dedicated Aster DEX account. This ensures accurate P&L tracking and prevents one model's losses from affecting others.

## 📋 Prerequisites

- **$300 USDT** total capital (6 models × $50 each)
- **Aster DEX account** with sufficient funds to create sub-accounts
- **6 separate email addresses** (one per AI model account)

## 🚀 Step-by-Step Setup

### **Step 1: Prepare Your Accounts**

1. **Log into Aster DEX**: https://asterdex.com
2. **Ensure you have $300+ USDT** in your main account
3. **Prepare 6 email addresses** for the model accounts:
   - claude@yourdomain.com
   - gpt@yourdomain.com
   - gemini@yourdomain.com
   - deepseek@yourdomain.com
   - grok@yourdomain.com
   - qwen@yourdomain.com

### **Step 2: Create 6 Model Accounts**

For each AI model, create a separate Aster account:

1. **Register new account** at https://asterdex.com/register
2. **Use unique email** from your prepared list
3. **Complete KYC** if required
4. **Fund with $50 USDT + $4 ASTER** from your main account
5. **Generate API keys** in Account Settings → API Keys

**Repeat for all 6 models:**
- ✅ Claude Sonnet 4.5 → claude@yourdomain.com
- ✅ GPT 5 → gpt@yourdomain.com
- ✅ Mistral Medium 3.1 → mistral@yourdomain.com
- ✅ DeepSeek Chat V3.1 → deepseek@yourdomain.com
- ✅ Grok 4 → grok@yourdomain.com
- ✅ Qwen3 Max → qwen@yourdomain.com

### **Step 3: Generate API Keys**

For each account:

1. **Login to the model account**
2. **Navigate to**: Account → API Keys
3. **Create API Key** with these permissions:
   - ✅ Read Info
   - ✅ Enable Trading
   - ✅ Enable Futures
4. **Copy both**:
   - API Key
   - Secret Key

### **Step 4: Configure Environment Variables**

1. **Copy the template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your credentials**:
   ```bash
   # Supabase (from your existing setup)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # OpenRouter (from your existing setup)
   OPENROUTER_API_KEY=your-openrouter-key

   # Cron Secret (generate random string)
   CRON_SECRET=your-random-secret

   # Model-specific Aster credentials
   CLAUDE_ASTER_API_KEY=your-claude-api-key
   CLAUDE_ASTER_API_SECRET=your-claude-secret

   GPT_ASTER_API_KEY=your-gpt-api-key
   GPT_ASTER_API_SECRET=your-gpt-secret

   MISTRAL_ASTER_API_KEY=your-mistral-api-key
   MISTRAL_ASTER_API_SECRET=your-mistral-secret

   DEEPSEEK_ASTER_API_KEY=your-deepseek-api-key
   DEEPSEEK_ASTER_API_SECRET=your-deepseek-secret

   GROK_ASTER_API_KEY=your-grok-api-key
   GROK_ASTER_API_SECRET=your-grok-secret

   QWEN_ASTER_API_KEY=your-qwen-api-key
   QWEN_ASTER_API_SECRET=your-qwen-secret
   ```

## 🧪 Testing Setup

### **Test Individual Accounts**

Run the account verification script for each model:

```bash
# Test Claude account
ASTER_API_KEY=$CLAUDE_ASTER_API_KEY ASTER_API_SECRET=$CLAUDE_ASTER_API_SECRET npx tsx scripts/test-aster-api.ts

# Test GPT account
ASTER_API_KEY=$GPT_ASTER_API_KEY ASTER_API_SECRET=$GPT_ASTER_API_SECRET npx tsx scripts/test-aster-api.ts

# Repeat for all 6 accounts
```

Expected output for each:
```
✅ Ping successful
✅ Server time
✅ Exchange info
✅ Current prices
✅ Account balance: $50.00 USDT
✅ ASTER balance: $4.00 (for fee discounts)
✅ Positions: []
```

**Note**: $ASTER tokens are automatically used for fee payments when deposited in the perpetual wallet, giving you a 5% discount on all trading fees.

### **Test Multi-Account Integration**

Once all accounts are set up, run:
```bash
npm run dev
```

Visit http://localhost:3000 and verify:
- All models show $50 equity
- Dashboard loads without errors
- Model chat shows proper account isolation

## 🔧 Troubleshooting

### **"API key invalid"**
- Double-check you copied the correct key/secret
- Ensure the account has trading permissions
- Verify the account has $50+ USDT balance

### **"Insufficient balance"**
- Each model account needs minimum $50 USDT
- Transfer funds from main account to model accounts
- Confirm transfers completed on Aster DEX

### **"Account not found"**
- Ensure each account completed registration
- Verify email addresses are unique
- Check if accounts require additional verification

## 📊 Architecture Benefits

### **Before: Single Account**
```
Shared Wallet: $300 USDT
├── Claude loses $20 → All models affected
├── GPT gains $15 → Everyone benefits
└── Inaccurate individual P&L
```

### **After: Multi-Account**
```
Claude Wallet: $30 USDT  ├── Claude loses $20 → Only Claude affected
GPT Wallet: $65 USDT    ├── GPT gains $15 → Only GPT benefits
Mistral Wallet: $50 USDT ├── Accurate individual P&L
...                     └── True competition integrity
```

## 🚨 Security Notes

- **Never share** API secrets between accounts
- **Monitor balances** regularly during trading
- **Enable 2FA** on all Aster accounts
- **Backup credentials** securely (not in code)
- **Test thoroughly** before live trading

## 🎯 Next Steps

Once setup is complete:

1. **Deploy to Vercel** with new environment variables
2. **Monitor initial trades** to ensure proper isolation
3. **Verify P&L accuracy** in dashboard
4. **Scale up capital** if testing successful

## 💰 Cost Structure

- **Setup Cost**: ~$324 (6 × $50 USDT + 6 × $4 ASTER)
- **Trading Fees**: 0.038% per trade (with 5% ASTER discount)
- **Maintenance**: Minimal (API keys don't expire)
- **Scalability**: Easy to add more models ($50 USDT + $4 ASTER each)

---

### PAUSE_COMPETITION.md

# Pause/Resume Competition

## ✅ What's Already Done:
- ✅ Competition countdown timer removed from header
- ✅ All competition data has been reset (trades, positions, reasoning, snapshots)
- ✅ All models reset to $50 starting capital

## 🛑 To Pause Vercel Cron Jobs:

### Option 1: Disable via Vercel Dashboard (Recommended)
1. Go to https://vercel.com/[your-username]/asterarena
2. Click on **Settings** → **Cron Jobs**
3. You'll see two cron jobs:
   - `execute-trades` (runs every 15 minutes)
   - `monitor-positions` (runs every 5 minutes)
4. Click the **toggle switch** or **"Disable"** button for each cron job
5. ✅ Done! Cron jobs are paused

### Option 2: Comment Out Cron Jobs in vercel.json
1. Open `vercel.json` in your project
2. Comment out or remove the cron jobs:
```json
{
  "crons": [
    // Temporarily disabled
    // {
    //   "path": "/api/cron/execute-trades",
    //   "schedule": "*/15 * * * *"
    // },
    // {
    //   "path": "/api/cron/monitor-positions",  
    //   "schedule": "*/5 * * * *"
    // }
  ]
}
```
3. Commit and push:
```bash
git add vercel.json
git commit -m "Pause cron jobs"
git push
```
4. Vercel will automatically deploy with crons disabled

## 🚀 To Resume Competition Tomorrow:

### Step 1: Re-enable Cron Jobs
- **If using Option 1:** Toggle the cron jobs back ON in Vercel Dashboard
- **If using Option 2:** Uncomment the cron jobs in `vercel.json` and push

### Step 2: Update Competition End Date (Optional)
If you want a new 7-day competition starting tomorrow:

1. Edit `src/app/page.tsx`
2. Find and uncomment the countdown timer code (lines 66-97)
3. Update the `TRADING_END_DATE` to 7 days from tomorrow:
```typescript
const TRADING_END_DATE = new Date('2025-10-30T20:15:00Z'); // Adjust to your new end date
```

### Step 3: Verify Everything
1. Check the dashboard - should show all models at $50
2. Wait 15 minutes for first trade execution
3. Check ModelChat for first AI decisions
4. Monitor Positions tab for open positions

## 📝 Notes:
- Database is clean and ready for fresh start
- No action needed on Aster DEX side (funds are still in your account)
- Can restart competition anytime - just re-enable crons

Get some rest! Everything is paused and ready to go when you are. 😴💤

---

### SETUP_GUIDE.md

# 🚀 Quick Setup Guide - Open Arena Trading System

## ✅ What We Just Built

Your AI trading arena now has **complete automated trading** matching Alpha Arena:

### **New Features**
1. ✅ **Position Closing Logic** - AI models can close positions
2. ✅ **Real-Time Position Monitor** - Updates prices every 5 minutes
3. ✅ **Auto Take Profit/Stop Loss** - Closes positions at +3%/-2%
4. ✅ **More Aggressive AI** - Actively seeks trading opportunities  
5. ✅ **Faster Schedule** - Decisions every 15 min, monitoring every 5 min
6. ✅ **Testing-Friendly** - $3 minimum positions for 50 USDT per model

---

## 🎯 Quick Start (5 Minutes)

### **Step 1: Update Model Capital**

Open Supabase SQL Editor and run:
```sql
UPDATE models 
SET starting_capital = 50.00, current_equity = 50.00
WHERE status = 'active';
```

Verify:
```sql
SELECT name, current_equity FROM models;
```

Should see all models at 50.00 USDT.

---

### **Step 2: Test Locally**

```bash
# Test trading execution
npx tsx scripts/test-trading-execution.ts

# Test position monitor  
npx tsx scripts/test-position-monitor.ts
```

**Expected**: Models analyze market and may open positions.

---

### **Step 3: Check Dashboard**

Visit http://localhost:3000

- **COMPLETED TRADES** - Will populate as trades close
- **POSITIONS** - Shows open positions
- **MODELCHAT** - Shows AI reasoning

---

### **Step 4: Deploy to Vercel**

```bash
git add .
git commit -m "Add automated trading with position monitoring"
git push origin main
```

Then in Vercel Dashboard:
1. Deploy the update
2. Go to **Settings → Cron Jobs**
3. You'll see **2 cron jobs**:
   - `/api/cron/execute-trades` (every 15 min)
   - `/api/cron/monitor-positions` (every 5 min)

---

## 📊 How It Works

### **Trading Cycle**

```
┌─────────────────────────────────────────────┐
│   MINUTE 0: AI Decision (execute-trades)   │
│   - Analyze market                           │
│   - Open/close positions                     │
│   - Save reasoning                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   MINUTE 5: Monitor (monitor-positions)     │
│   - Update prices                            │
│   - Check take profit (+3%)                  │
│   - Check stop loss (-2%)                    │
│   - Auto-close if threshold hit              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   MINUTE 10: Monitor                         │
│   (repeat price updates)                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   MINUTE 15: AI Decision                     │
│   (repeat cycle)                             │
└─────────────────────────────────────────────┘
```

---

## 🎮 What to Expect

### **First 30 Minutes**
- 2 AI decision cycles
- Models may HOLD initially
- 0-3 positions opened

### **First 2 Hours**
- 8 AI decision cycles
- 20+ monitor checks
- 3-6 positions opened
- 0-2 positions closed

### **First Day**
- 96 AI decision cycles
- 288 monitor checks
- 10-20 completed trades per model
- Trades visible in UI
- Leaderboard taking shape

---

## 🔧 Configuration Files

### **Key Files Changed**

```
src/app/api/cron/
├── execute-trades/route.ts    ← Opening/closing positions
└── monitor-positions/route.ts ← Real-time monitoring

src/lib/trading/agent.ts       ← More aggressive AI prompts

vercel.json                    ← 2 cron jobs configured

scripts/
├── test-trading-execution.ts  ← Test trading
├── test-position-monitor.ts   ← Test monitoring
└── update-model-capital.sql   ← Set 50 USDT per model
```

### **Safety Limits**
```typescript
MIN_POSITION_SIZE_USD = 3      // $3 minimum
MAX_POSITION_SIZE_PERCENT = 0.30  // 30% of equity
MAX_OPEN_POSITIONS = 3         // 3 per model
MAX_LEVERAGE = 10              // 10x max
TAKE_PROFIT_PERCENT = 0.03     // +3%
STOP_LOSS_PERCENT = 0.02       // -2%
MAX_HOLDING_TIME_MS = 24h      // Auto-close after 24h
```

---

## 🐛 Troubleshooting

### **"All models HOLDing, no trades?"**

This is normal at first! Reasons:
- ✅ Market conditions not favorable
- ✅ Models being conservative initially
- ✅ Waiting for clearer momentum

**Solution**: Wait 1-2 hours. Models will become more active.

---

### **"Positions not appearing in UI?"**

**Check database:**
```sql
SELECT * FROM positions;
SELECT * FROM trades WHERE status = 'open';
```

**Check logs in terminal:**
Look for: `✅ [Model Name] Trade opened: abc-123`

---

### **"Want more activity?"**

**Make models more aggressive:**

1. Faster decisions:
```json
// vercel.json
"schedule": "*/10 * * * *"  // Every 10 min
```

2. Larger positions:
```typescript
// execute-trades/route.ts
const MAX_POSITION_SIZE_PERCENT = 0.40; // 40%
const MIN_POSITION_SIZE_USD = 5; // $5
```

---

## 📖 Documentation

- **TRADING_SYSTEM.md** - Complete system overview
- **DEPLOYMENT.md** - Full deployment guide
- **AGENTS.md** - Original project master document

---

## ✨ You're Ready!

Your trading system is now **complete** and matches Alpha Arena's functionality:

✅ AI models make autonomous decisions  
✅ Positions open/close automatically  
✅ Take profit and stop loss active  
✅ Real-time monitoring  
✅ All trades visible in UI  
✅ Leaderboard tracks performance

**Next**: Test locally, then deploy to Vercel and watch your AI models trade! 🎉

---

### TRADING_SYSTEM.md

# 🤖 Open Arena - Automated Trading System

## Overview

Your AI trading arena now has **complete automated trading** with position opening, monitoring, and closing.

---

## 🎯 System Architecture

### **Two Cron Jobs Working Together**

#### 1. **Trade Execution** (`/api/cron/execute-trades`)
- **Schedule**: Every hour
- **Purpose**: AI decision-making and opening/closing positions
- **What it does**:
  - Queries each AI model for trading decision
  - Opens new positions when AI decides
  - Closes positions when AI decides
  - Saves reasoning to database
  - Updates model equity

#### 2. **Position Monitor** (`/api/cron/monitor-positions`)
- **Schedule**: Every 15 minutes
- **Purpose**: Real-time price updates and risk management
- **What it does**:
  - Updates current prices for all open positions
  - Recalculates unrealized P&L
  - **Auto-closes positions** when:
    - +5% profit (take profit)
    - -3% loss (stop loss)
    - 24 hours holding time (max hold)

---

## 💰 Testing Phase Settings

### **Capital Allocation**
- **Per model**: 50 USDT starting capital
- **Total across 6 models**: 300 USDT
- **Your account**: 360 USDT (60 USDT reserve)

### **Position Sizing**
- **Minimum**: $3 per trade
- **Maximum**: 30% of equity (~$15 per trade)
- **Max positions**: 3 per model
- **Leverage**: 3-10x (conservative for testing)

### **Risk Management**
- **Take profit**: +3%
- **Stop loss**: -2%
- **Max hold**: 24 hours
- Position automatically closed when any threshold hit

---

## 🔄 Trading Flow Example

### **Minute 0: AI Decision**
```
Claude Sonnet 4.5 analyzes market:
- BTC trending up +2.5%
- No open positions
- Decision: OPEN_LONG BTCUSDT
- Size: $10, Leverage: 5x
- Entry: $111,015

Position created in database ✅
```

### **Minute 5: First Monitor Check**
```
Position monitor runs:
- Updates BTC price: $111,450
- Unrealized P&L: +$0.39 (0.39%)
- No thresholds hit
- Continue monitoring...
```

### **Minute 10: Second Monitor Check**
```
Position monitor runs:
- Updates BTC price: $114,500
- Unrealized P&L: +$3.15 (3.14%)
- 🎯 TAKE PROFIT HIT!
- Auto-close position
- Realized P&L: +$3.15

Trade moved to completed ✅
Appears in UI immediately ✅
```

---

## 📊 What You'll See in the UI

### **COMPLETED TRADES Tab**
Shows closed trades with:
- Model name + icon
- Long/Short indicator
- Symbol traded
- Entry → Exit prices
- Holding time
- Net P&L (green/red)

### **POSITIONS Tab**
Shows current open positions with:
- Model name
- Symbol
- Side (LONG/SHORT)
- Entry price
- Unrealized P&L
- Leverage

### **MODELCHAT Tab**
Shows AI reasoning for each decision:
- Why they opened a position
- Why they closed a position
- Market analysis
- Confidence level

### **LEADERBOARD Tab**
Rankings by:
- Total equity
- P&L percentage
- Win rate
- Sharpe ratio

---

## 🚀 How to Test Locally

### **1. Update Model Capital**
Run in Supabase SQL Editor:
```bash
scripts/update-model-capital.sql
```

This sets all models to 50 USDT.

### **2. Test Trade Execution**
```bash
npx tsx scripts/test-trading-execution.ts
```

Expected: AI models make decisions, some may open positions.

### **3. Test Position Monitor**
```bash
npx tsx scripts/test-position-monitor.ts
```

Expected: Updates prices, may close positions if thresholds hit.

### **4. Check Dashboard**
Visit http://localhost:3000
- Go to COMPLETED TRADES tab
- Go to POSITIONS tab
- See real-time data

---

## 📈 Expected Behavior

### **First Hour (4 executions)**
- Models analyze market
- May HOLD initially (conservative start)
- 0-2 positions opened per model
- Testing the waters

### **Hours 2-6 (20+ executions)**
- Models become more active
- 1-3 positions per model
- Some positions closing with profit/loss
- Trades appearing in UI

### **Day 1 (96+ executions)**
- Active trading across all models
- 5-15 completed trades per model
- Clear leader emerging
- P&L curves visible

### **Ongoing**
- Continuous open/close cycle
- ~10-20 trades per day per model
- Leaderboard updates
- Performance tracking

---

## 🎛️ Tuning Parameters

### **Make Models More Aggressive**

**Faster decisions:**
```json
// vercel.json
"schedule": "*/10 * * * *"  // Every 10 min instead of 15
```

**Larger positions:**
```typescript
// execute-trades/route.ts
const MAX_POSITION_SIZE_PERCENT = 0.45; // 45% instead of 35%
const MIN_POSITION_SIZE_USD = 15; // $15 min instead of $10
```

**Higher leverage:**
```typescript
const MAX_LEVERAGE = 15; // 15x instead of 10x
```

### **Make Risk Management Tighter**

**Closer stop loss:**
```typescript
// monitor-positions/route.ts
const STOP_LOSS_PERCENT = 0.015; // 1.5% instead of 2%
```

**Wider take profit:**
```typescript
const TAKE_PROFIT_PERCENT = 0.05; // 5% instead of 3%
```

**Faster exits:**
```typescript
const MAX_HOLDING_TIME_MS = 12 * 60 * 60 * 1000; // 12 hours instead of 24
```

---

## 🐛 Troubleshooting

### **No trades appearing?**

**Check execution logs:**
```bash
# Look for this in terminal
✅ [Claude Sonnet 4.5] Trade opened: abc-123
```

If all models say HOLD:
- Market may not be favorable
- Models being conservative
- Wait 1-2 hours for momentum

### **Positions not closing?**

**Check monitor logs:**
```bash
# Should see every 5 minutes
👁️ [MONITOR] Monitoring X open positions
```

If positions stuck:
- Run monitor manually: `npx tsx scripts/test-position-monitor.ts`
- Check if thresholds too tight/loose
- Verify prices updating

### **Database errors?**

**Verify Supabase:**
```sql
-- Check models
SELECT * FROM models;

-- Check open trades
SELECT * FROM trades WHERE status = 'open';

-- Check positions
SELECT * FROM positions;
```

---

## 💡 Tips for Success

1. **Start small**: Let it run for 6-12 hours before judging
2. **Check logs**: Vercel Dashboard → Functions → Logs
3. **Monitor balance**: Keep 60+ USDT reserve
4. **Adjust as needed**: Tune parameters based on performance
5. **Add capital gradually**: Once confident, increase to 100-200 USDT per model

---

## 🚨 Safety Features

- ✅ **Position limits**: Max 3 per model prevents over-exposure
- ✅ **Size limits**: $3-15 range keeps risk low
- ✅ **Stop losses**: -2% prevents large losses
- ✅ **Take profits**: +3% locks in gains
- ✅ **Max hold time**: 24h prevents bag holding
- ✅ **Capital per model**: Isolated risk (1 model losing doesn't affect others)

---

## 📞 Need Help?

If something isn't working:
1. Check dev server logs
2. Run test scripts locally
3. Verify Supabase data
4. Check Vercel deployment logs
5. Ensure API keys valid

---

**You're ready to trade!** 🎉

The system is fully automated and will run 24/7 once deployed to Vercel.

---

### WAITLIST_EMAIL_SETUP.md

# Waitlist Email Notifications Setup

## Overview
This guide explains how to receive email notifications when someone joins your waitlist.

## Option 1: Supabase Webhooks → Your Email Service (Recommended)

### Step 1: Create a Webhook Endpoint in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Webhooks**
3. Click **Create a new webhook**
4. Configure:
   - **Name**: `waitlist_notifications`
   - **Table**: `waitlist`
   - **Events**: `INSERT`
   - **Type**: `HTTP Request`
   - **HTTP Request URL**: Use one of these services:

#### Service Options:

**A. Zapier (Easiest - No Code)**
1. Create a free Zapier account
2. Create a new Zap with trigger "Webhooks by Zapier"
3. Copy the webhook URL
4. Action: "Send Email" (Gmail, Outlook, etc.)
5. Map the fields: `{{email}}`, `{{name}}`

**B. Make.com (Free tier available)**
1. Create a free Make.com account
2. Create a new scenario with "Webhooks" trigger
3. Copy the webhook URL
4. Add "Email" module to send notifications

**C. Custom Next.js API Route** (if you want full control):
```typescript
// Create: src/app/api/webhooks/waitlist/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const payload = await request.json();
  const { record } = payload;
  
  // Send email using your preferred service
  // (Resend, SendGrid, Mailgun, etc.)
  
  return NextResponse.json({ success: true });
}
```

### Step 2: Test the Webhook
1. Add a test email to your waitlist via the modal
2. Check if the webhook fires in Supabase logs
3. Verify you received the notification

---

## Option 2: Supabase Edge Function (More Advanced)

Create a Supabase Edge Function that sends emails directly:

```typescript
// supabase/functions/notify-waitlist/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { record } = await req.json()
  
  // Send email using Deno-compatible email service
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'noreply@yourdomain.com',
      to: 'your-company-email@example.com',
      subject: 'New Waitlist Signup',
      html: `
        <h2>New Waitlist Signup</h2>
        <p><strong>Name:</strong> ${record.name || 'Not provided'}</p>
        <p><strong>Email:</strong> ${record.email}</p>
        <p><strong>Signed up:</strong> ${new Date(record.created_at).toLocaleString()}</p>
      `
    })
  })
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Then add a database trigger:
```sql
CREATE TRIGGER on_waitlist_signup_edge_function
  AFTER INSERT ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-waitlist',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
```

---

## Option 3: Simple Manual Check (Quick Start)

If you just want to check signups periodically without automated emails:

1. Go to Supabase Dashboard
2. Navigate to **Table Editor** → `waitlist`
3. View all signups in the table
4. Set up **Table View Notifications** in Supabase to get alerts

Or create a simple admin page:

```typescript
// src/app/admin/waitlist/page.tsx
import { createClient } from '@supabase/supabase-js';

export default async function WaitlistAdmin() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin
  );
  
  const { data: waitlist } = await supabase
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Waitlist Signups</h1>
      <table className="w-full">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {waitlist?.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.email}</td>
              <td>{entry.name || '-'}</td>
              <td>{new Date(entry.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Recommended Quick Setup

For fastest implementation:

1. **Run the database migration** (creates the table)
2. **Deploy your changes** (modal + API route work immediately)
3. **Use Zapier webhook** for email notifications (5 minutes to set up)
4. **Later**: Migrate to a more robust solution if needed

---

## What You Get

✅ **Immediate functionality**: Modal works, data saves to database  
✅ **Email notifications**: Via webhook to your company email  
✅ **Duplicate prevention**: Email uniqueness enforced  
✅ **Secure**: RLS policies protect data  
✅ **Scalable**: Ready for thousands of signups

---

Resources:
- Supabase webhooks docs: https://supabase.com/docs/guides/database/webhooks
- Make.com webhooks: https://www.make.com/en/help/tools/webhooks

---

### WAITLIST_SETUP.md

# Waitlist Setup - Quick Start Guide

## 🚀 What Was Created

✅ **Database table** for storing waitlist signups  
✅ **API route** for handling form submissions  
✅ **Modal component** with beautiful UI  
✅ **Integration** with your "Join the Waitlist" button  

## 📝 Setup Steps

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```bash
supabase/migrations/create_waitlist_table.sql
```

This creates:
- `waitlist` table with email, name, referral_source, created_at
- RLS policies for security
- Indexes for performance
- Trigger for notifications (webhook-ready)

### 2. Test Locally

```bash
npm run dev
```

1. Click "Join the Waitlist ↗" button in the header
2. Fill in the form
3. Submit

The data will be saved to your Supabase `waitlist` table immediately!

### 3. Set Up Email Notifications (3 options)

#### Option A: Zapier (Easiest - 5 minutes)
1. Go to [Zapier](https://zapier.com)
2. Create new Zap: **Webhooks by Zapier** (trigger)
3. Copy the webhook URL
4. In Supabase Dashboard → Database → Webhooks:
   - Table: `waitlist`
   - Event: `INSERT`
   - URL: Your Zapier webhook URL
5. Add action: **Email** (Gmail/Outlook)
6. Test it!

#### Option B: View in Supabase Dashboard
- Navigate to **Table Editor** → `waitlist`
- See all signups in real-time
- Export to CSV when needed

#### Option C: Build Admin Page
See `WAITLIST_EMAIL_SETUP.md` for code example

## ✨ Features

- **Duplicate Prevention**: Same email can't sign up twice
- **Validation**: Email format checked
- **User Feedback**: Success/error messages
- **Auto-close**: Modal closes after successful submission
- **Mobile Responsive**: Works on all screen sizes
- **Dark/Light Theme**: Matches your design system
- **Secure**: RLS policies protect the data

## 🎨 UI Details

The modal:
- Matches Open Arena's dark theme
- Uses your brand colors (#3b82f6 for primary)
- Has backdrop blur effect
- Smooth animations
- Accessible keyboard navigation (ESC to close)

## 📊 Database Schema

```sql
waitlist (
  id uuid PRIMARY KEY
  email text UNIQUE NOT NULL
  name text
  referral_source text
  created_at timestamptz DEFAULT now()
)
```

## 🔒 Security

- ✅ RLS enabled
- ✅ Public can INSERT (for form submissions)
- ✅ Only service role can SELECT (for admin viewing)
- ✅ Email uniqueness enforced
- ✅ Input validation on API route

## 🚢 Deploy

1. Push changes to GitHub
2. Vercel will auto-deploy
3. Ensure environment variables are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📧 Email Setup (Detailed)

See `WAITLIST_EMAIL_SETUP.md` for:
- Zapier webhook tutorial
- Supabase Edge Function setup
- Custom Next.js webhook endpoint
- Make.com integration
- Admin dashboard code

## 🎉 You're Done!

The waitlist is fully functional. Every signup:
1. ✅ Validates email format
2. ✅ Saves to Supabase
3. ✅ Prevents duplicates
4. ✅ Can trigger email notifications (after webhook setup)

**Total setup time**: ~10 minutes (including email notifications)

---

### WAITLIST_SUMMARY.md

# ✅ Waitlist Feature - Implementation Complete

## What Was Built

A fully functional waitlist system with:

### 🗄️ Backend
- **Database Table** (`waitlist`) with RLS security
- **API Route** (`/api/waitlist`) for form submissions
- **Validation** for email format and duplicates
- **Webhook Support** for email notifications

### 🎨 Frontend
- **Beautiful Modal** matching your design system
- **Form Validation** with real-time feedback
- **Success/Error States** with auto-close
- **Responsive Design** for all screen sizes
- **Keyboard Accessible** (ESC to close)

### 🔒 Security
- Row Level Security (RLS) enabled
- Email uniqueness enforced
- Input sanitization
- Public INSERT only (no data leaks)

## Files Created

```
aster-arena/
├── supabase/migrations/
│   └── create_waitlist_table.sql       # Database schema
├── src/
│   ├── app/api/waitlist/
│   │   └── route.ts                    # API endpoint
│   └── components/ui/
│       └── WaitlistModal.tsx           # Modal component
├── WAITLIST_SETUP.md                   # Quick start guide
├── WAITLIST_EMAIL_SETUP.md             # Email notification options
└── WAITLIST_SUMMARY.md                 # This file
```

## Files Modified

```
src/app/page.tsx
├── Added import for WaitlistModal
├── Added state for modal open/close
├── Changed <a> to <button> for "Join the Waitlist"
└── Added <WaitlistModal /> component
```

## Next Steps

### Immediate (Required)
1. **Run the migration** in Supabase SQL Editor:
   ```sql
   -- Copy and paste contents of:
   supabase/migrations/create_waitlist_table.sql
   ```

2. **Test locally**:
   ```bash
   npm run dev
   # Click "Join the Waitlist" button
   # Fill form and submit
   # Check Supabase Table Editor → waitlist
   ```

3. **Deploy to production**:
   ```bash
   git add .
   git commit -m "Add waitlist feature"
   git push
   # Vercel will auto-deploy
   ```

### Optional (Email Notifications)
Choose one method from `WAITLIST_EMAIL_SETUP.md`:

#### Quick (5 minutes):
- Use Zapier webhook → Email

#### Medium (15 minutes):
- Create Supabase Edge Function

#### Custom (30 minutes):
- Build Next.js webhook endpoint
- Integrate email service (Resend/SendGrid)

## How It Works

### User Flow
1. User clicks "Join the Waitlist ↗"
2. Modal opens with form
3. User enters email (+ optional name)
4. Clicks "Join Waitlist"
5. API validates and saves to Supabase
6. Success message shown
7. Modal auto-closes after 2 seconds
8. **(Optional)** Email notification sent to you

### Technical Flow
```
[Modal Form]
     ↓
[POST /api/waitlist]
     ↓
[Validate Email]
     ↓
[Insert to Supabase]
     ↓
[Database Trigger]
     ↓
[Webhook → Email Service]
     ↓
[📧 Notification Email]
```

## Features

✅ **Email validation** (required field)  
✅ **Duplicate prevention** (unique constraint)  
✅ **Name field** (optional)  
✅ **Success/error messages**  
✅ **Auto-close on success**  
✅ **Loading states**  
✅ **Keyboard navigation** (ESC)  
✅ **Click outside to close**  
✅ **Dark/light theme support**  
✅ **Mobile responsive**  
✅ **Zero external dependencies**  

## Testing Checklist

- [ ] Run database migration
- [ ] Test form submission locally
- [ ] Verify data in Supabase table
- [ ] Test duplicate email (should show error)
- [ ] Test invalid email format
- [ ] Test mobile responsiveness
- [ ] Deploy to production
- [ ] Test on production URL
- [ ] Set up email notifications
- [ ] Test end-to-end flow

## Email Notification Examples

### Zapier Email Template
```
Subject: New Open Arena Waitlist Signup

Name: {{name}}
Email: {{email}}
Signed up: {{created_at}}

View all signups: https://supabase.com/dashboard/project/[YOUR_PROJECT]/editor/[TABLE_ID]
```

### Custom HTML Email
See `WAITLIST_EMAIL_SETUP.md` for full example

## Database Query Examples

### View all signups
```sql
SELECT * FROM waitlist ORDER BY created_at DESC;
```

### Count signups
```sql
SELECT COUNT(*) FROM waitlist;
```

### Export to CSV
```sql
COPY waitlist TO '/tmp/waitlist.csv' WITH CSV HEADER;
```

## Cost Estimate

**Supabase Free Tier:**
- ✅ 500 MB database
- ✅ Unlimited API requests
- ✅ 50,000 monthly active users

**Email Options:**
- Zapier: Free tier (100 tasks/month)
- Make.com: Free tier (1,000 ops/month)
- Resend: Free tier (100 emails/day)

**Total Monthly Cost: $0** for thousands of signups!

## Support

- **Quick Start**: `WAITLIST_SETUP.md`
- **Email Setup**: `WAITLIST_EMAIL_SETUP.md`
- **Database Schema**: `supabase/migrations/create_waitlist_table.sql`
- **API Code**: `src/app/api/waitlist/route.ts`
- **Modal Code**: `src/components/ui/WaitlistModal.tsx`

## Questions?

Common issues and solutions:

**Q: Form submits but no data in Supabase?**  
A: Check that you've run the migration SQL

**Q: Getting 500 error?**  
A: Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`

**Q: Not getting emails?**  
A: Set up webhook in Supabase → Database → Webhooks

**Q: Duplicate email error?**  
A: This is intentional! Prevents spam/re-submissions

---

**Implementation Time**: ~15 minutes  
**Setup Time**: ~10 minutes  
**Total Time**: ~25 minutes from start to finish

**Status**: ✅ Ready to deploy!

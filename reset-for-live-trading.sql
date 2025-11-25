-- Reset database for live trading with REAL Aster wallet balances
-- Run this in Supabase SQL Editor

-- Clear all trading data
DELETE FROM performance_snapshots;
DELETE FROM model_reasoning;
DELETE FROM positions;
DELETE FROM trades;
DELETE FROM leaderboard;

-- IMPORTANT: You need to manually update starting_capital and current_equity
-- to match your actual Aster wallet balances for each model.
-- Get the balances from your Aster accounts and update below:

-- Example (replace with your actual balances):
-- UPDATE models SET starting_capital = [REAL_BALANCE], current_equity = [REAL_BALANCE] WHERE name = '[MODEL_NAME]';

-- For example, if Claude has $50.00:
-- UPDATE models SET starting_capital = 50.00, current_equity = 50.00 WHERE name = 'Claude Sonnet 4.5';

-- Do this for all 6 models + BTC benchmark

-- Verify the changes (should show your actual starting balances)
SELECT name, starting_capital, current_equity FROM models ORDER BY name;

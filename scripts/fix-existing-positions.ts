/***
 * Fix Existing Positions Script
 *
 * Updates existing positions that have zero entry prices with proper values
 * from their corresponding trades.
 *
 * Run with: npx tsx scripts/fix-existing-positions.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExistingPositions() {
  console.log('🔧 Fixing existing positions with zero values...\n');

  // Get all positions with zero entry prices
  const { data: zeroPositions, error: positionsError } = await supabase
    .from('positions')
    .select(`
      id,
      trade_id,
      symbol,
      side,
      trades (
        entry_price,
        quantity,
        leverage,
        notional_value,
        created_at
      )
    `)
    .eq('entry_price', 0)
    .eq('quantity', 0);

  if (positionsError) {
    console.error('❌ Error fetching positions:', positionsError);
    return;
  }

  if (!zeroPositions || zeroPositions.length === 0) {
    console.log('✅ No positions with zero values found');
    return;
  }

  console.log(`Found ${zeroPositions.length} positions with zero values\n`);

  let fixedCount = 0;

  for (const position of zeroPositions as Array<typeof zeroPositions[number] & { trades?: any }>) {
    const relation = position.trades;
    const trade = Array.isArray(relation) ? relation[0] : relation;
    if (!trade) {
      console.log(`⚠️  Position ${position.id}: No associated trade found`);
      continue;
    }

    const entryPrice = parseFloat(trade.entry_price);
    const quantity = parseFloat(trade.quantity);
    const leverage = trade.leverage;
    const notionalValue = parseFloat(trade.notional_value);

    if (entryPrice > 0 && quantity > 0) {
      // Update the position with correct values
      const { error: updateError } = await supabase
        .from('positions')
        .update({
          entry_price: entryPrice,
          quantity: quantity,
          leverage: leverage,
          notional_value: notionalValue,
          current_price: entryPrice, // Assume current price is entry price for now
          unrealized_pnl: 0, // Will be updated by monitor job
        })
        .eq('id', position.id);

      if (updateError) {
        console.error(`❌ Failed to update position ${position.id}:`, updateError);
      } else {
        console.log(`✅ Fixed position ${position.id}: ${position.symbol} ${position.side} @ $${entryPrice.toFixed(4)}`);
        fixedCount++;
      }
    } else {
      console.log(`⚠️  Position ${position.id}: Trade has invalid data (entry: ${entryPrice}, qty: ${quantity})`);
    }
  }

  console.log(`\n📊 Summary: Fixed ${fixedCount} out of ${zeroPositions.length} positions`);
}

fixExistingPositions().catch(console.error);

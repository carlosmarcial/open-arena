import { AsterClient } from '../src/lib/aster/client';

async function closeBTC() {
  const client = new AsterClient(
    process.env.ASTER_API_KEY!,
    process.env.ASTER_API_SECRET!
  );

  console.log('📊 Closing BTC position...\n');

  try {
    // Sell 0.001 BTC
    const order = await client.placeOrder({
      symbol: 'BTCUSDT',
      side: 'SELL',
      type: 'MARKET',
      quantity: 0.001,
      reduceOnly: true,
    });

    console.log('✅ BTC position closed!');
    console.log('Order ID:', order.orderId);
    console.log('Price:', order.price);
    console.log('Executed Qty:', order.executedQty);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

closeBTC();

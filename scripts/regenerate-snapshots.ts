/**
 * Regenerate Snapshots Script
 * Calls the snapshot-equity cron endpoint multiple times to generate historical data
 */

async function regenerateSnapshots(count: number = 10, intervalSeconds: number = 5) {
  console.log(`🔄 Regenerating ${count} snapshots with ${intervalSeconds}s interval...\n`);

  for (let i = 1; i <= count; i++) {
    console.log(`📸 Snapshot ${i}/${count}`);

    try {
      const response = await fetch('http://localhost:3000/api/cron/snapshot-equity', {
        headers: {
          'Authorization': 'Bearer 5VAa0VrVG/KyjqQzom72LiQGdhjwYtt6mPTMDzzfCUA='
        }
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Created ${data.snapshotsCreated || 0} snapshots`);
        if (data.snapshots && data.snapshots.length > 0) {
          data.snapshots.forEach((snap: any) => {
            console.log(`   ${snap.modelName}: $${snap.equity.toFixed(2)}`);
          });
        }
      } else {
        console.error(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error(`❌ Failed:`, error);
    }

    if (i < count) {
      console.log(`⏳ Waiting ${intervalSeconds} seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }
  }

  console.log('\n✅ Regeneration complete!');
}

// Run with 10 snapshots, 5 second intervals (faster for testing)
regenerateSnapshots(10, 5)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

/**
 * Local Development Script - Manually Trigger Cron Jobs
 *
 * This script allows you to manually trigger the cron jobs that normally
 * run on Vercel. Use this for local testing to see real-time chart updates.
 *
 * Usage:
 *   npx tsx scripts/trigger-crons.ts [job-name]
 *
 * Available jobs:
 *   - snapshot    : Create equity snapshots (runs every 2 min on Vercel)
 *   - sync        : Sync positions from Aster DEX (runs every 5 min on Vercel)
 *   - monitor     : Monitor positions for exits (runs every 15 min on Vercel)
 *   - all         : Run all jobs in sequence (default)
 *   - watch       : Continuously run snapshot + sync every 10 seconds (for testing)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load CRON_SECRET from .env.local if not in environment
let CRON_SECRET: string = process.env.CRON_SECRET || '';
if (!CRON_SECRET) {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/CRON_SECRET=(.+)/);
    if (match) {
      CRON_SECRET = match[1].trim();
    }
  } catch (e) {
    // .env.local not found, use default
  }
}
// Ensure we always have a value (dev-secret for local testing)
if (!CRON_SECRET) {
  CRON_SECRET = 'dev-secret';
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function triggerCron(endpoint: string, jobName: string) {
  console.log(`\n🔄 Triggering ${jobName}...`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/cron/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${jobName} completed in ${duration}ms`);
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.error(`❌ ${jobName} failed:`, data.error || 'Unknown error');
    }

    return response.ok;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${jobName} failed after ${duration}ms:`, error);
    return false;
  }
}

async function runAll() {
  console.log('🚀 Running all cron jobs...\n');
  await triggerCron('sync-positions', 'Sync Positions');
  await triggerCron('snapshot-equity', 'Snapshot Equity');
  await triggerCron('monitor-positions', 'Monitor Positions');
  console.log('\n✅ All cron jobs completed');
}

async function watch() {
  console.log('👀 Watch mode: Running snapshot + sync every 10 seconds...');
  console.log('Press Ctrl+C to stop\n');

  let iteration = 1;
  while (true) {
    console.log(`\n━━━ Iteration ${iteration++} ━━━`);
    await triggerCron('sync-positions', 'Sync Positions');
    await triggerCron('snapshot-equity', 'Snapshot Equity');

    console.log('\n⏳ Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

async function main() {
  const arg = process.argv[2] || 'all';

  console.log('📊 Open Arena - Local Cron Trigger');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Cron Secret: ${CRON_SECRET.substring(0, 10)}...`);

  switch (arg) {
    case 'snapshot':
      await triggerCron('snapshot-equity', 'Snapshot Equity');
      break;
    case 'sync':
      await triggerCron('sync-positions', 'Sync Positions');
      break;
    case 'monitor':
      await triggerCron('monitor-positions', 'Monitor Positions');
      break;
    case 'watch':
      await watch();
      break;
    case 'all':
    default:
      await runAll();
      break;
  }
}

main().catch(console.error);

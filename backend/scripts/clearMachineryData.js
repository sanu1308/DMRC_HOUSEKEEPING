#!/usr/bin/env node

/**
 * Utility script to purge seeded machinery inventory/usage data.
 *
 * Usage examples:
 *   node scripts/clearMachineryData.js              # clears ALL stations (dev only)
 *   node scripts/clearMachineryData.js --station 5 # clears a single station
 *   node scripts/clearMachineryData.js --dry-run   # shows counts without deleting
 */

const path = require('path');
const processArgs = process.argv.slice(2);

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');

if (process.env.NODE_ENV === 'production') {
  console.error('clearMachineryData is disabled in production. Remove records via the UI instead.');
  process.exit(1);
}

function parseOptions(args) {
  let stationId = null;
  let dryRun = false;

  args.forEach((arg, index) => {
    if (arg === '--station') {
      const value = args[index + 1];
      stationId = Number(value);
    } else if (arg.startsWith('--station=')) {
      stationId = Number(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  });

  if (stationId !== null && (!Number.isInteger(stationId) || stationId <= 0)) {
    throw new Error('If provided, --station must be a positive integer.');
  }

  return { stationId, dryRun };
}

async function clearData({ stationId, dryRun }) {
  const connection = await pool.getConnection();

  const targetClause = stationId ? 'WHERE station_id = ?' : '';
  const params = stationId ? [stationId] : [];
  const manpowerClause = stationId ? 'AND station_id = ?' : '';

  try {
    const [[usageStats]] = await connection.query(
      `SELECT COUNT(*) AS count FROM machinery_usage ${targetClause}`,
      params,
    );
    const [[inventoryStats]] = await connection.query(
      `SELECT COUNT(*) AS count FROM machinery ${targetClause}`,
      params,
    );
    const [[manpowerStats]] = await connection.query(
      `SELECT COUNT(*) AS count FROM section_manpower_usage WHERE source_type = 'machinery' ${manpowerClause}`,
      stationId ? [stationId] : [],
    );

    console.log('Machinery usage records:', usageStats.count);
    console.log('Machinery inventory records:', inventoryStats.count);
    console.log('Manpower ledger rows:', manpowerStats.count);

    if (dryRun) {
      console.log('Dry run enabled – no deletions performed.');
      return;
    }

    if (!usageStats.count && !inventoryStats.count && !manpowerStats.count) {
      console.log('Nothing to delete for the requested scope.');
      return;
    }

    await connection.beginTransaction();

    await connection.query(
      `DELETE FROM section_manpower_usage WHERE source_type = 'machinery' ${manpowerClause}`,
      stationId ? [stationId] : [],
    );

    await connection.query(
      `DELETE FROM machinery_usage ${targetClause}`,
      params,
    );

    await connection.query(
      `DELETE FROM machinery ${targetClause}`,
      params,
    );

    await connection.commit();

    console.log('Machinery data cleared successfully.');
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

(async () => {
  try {
    const options = parseOptions(processArgs);
    await clearData(options);
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear machinery data:', error.message);
    process.exit(1);
  }
})();

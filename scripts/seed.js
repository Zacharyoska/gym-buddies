'use strict';

const path = require('node:path');
const { openConfiguredDatabase } = require('../lib/db');
const { seedDatabase } = require('../lib/seed');

async function main() {
  const dbPath =
    process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gym-buddies.db');
  const db = await openConfiguredDatabase({ dbPath });
  try {
    const summary = await seedDatabase(db, { reset: true });
    console.log('Demo data reset successfully.');
    console.log(`Database: ${db.remote ? db.url : dbPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error?.message || 'Could not reset the demo data.');
  process.exitCode = 1;
});

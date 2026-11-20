'use strict';

const { openRemoteDatabase } = require('../lib/db');
const { seedDatabase } = require('../lib/seed');
const { hashPassword } = require('../lib/auth');

async function main() {
  const db = await openRemoteDatabase();
  try {
    const summary = await seedDatabase(db);
    console.log('Remote database is ready.');
    console.log(`URL: ${db.url}`);
    console.log(JSON.stringify(summary, null, 2));

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      if (adminPassword.length < 8) {
        throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
      }
      await db
        .prepare('UPDATE staff SET password_hash = ? WHERE username = ?')
        .run(hashPassword(adminPassword), 'admin');
      console.log('Admin password updated from ADMIN_PASSWORD.');
    } else {
      console.warn(
        'WARNING: no ADMIN_PASSWORD was provided. Change admin / admin123 before going public.'
      );
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error?.message || 'Could not initialize the remote database.');
  process.exitCode = 1;
});

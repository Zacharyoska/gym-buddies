'use strict';

const path = require('node:path');
const { openConfiguredDatabase } = require('../lib/db');
const { hashPassword } = require('../lib/auth');

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('Usage: npm run set-password -- <username> <new-password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('The new password must be at least 8 characters long.');
  process.exit(1);
}

async function main() {
  const dbPath =
    process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gym-buddies.db');
  const db = await openConfiguredDatabase({ dbPath });
  try {
    const staff = await db.prepare('SELECT id FROM staff WHERE username = ?').get(username);
    if (!staff) {
      console.error(`No staff account found with username "${username}".`);
      process.exitCode = 1;
    } else {
      await db
        .prepare('UPDATE staff SET password_hash = ? WHERE id = ?')
        .run(hashPassword(password), staff.id);
      console.log(`Password updated for "${username}".`);
      console.log('The new password takes effect immediately for future sign-ins.');
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error?.message || 'Could not update the password.');
  process.exitCode = 1;
});

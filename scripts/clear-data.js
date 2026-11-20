'use strict';

const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { openConfiguredDatabase } = require('../lib/db');
const { clearRecordedData, countRows } = require('../lib/maintenance');

const args = new Set(process.argv.slice(2));
const confirmed = args.has('--yes') || args.has('-y');
const all = args.has('--all');
const keepPlans = !all;

if (args.has('--all') && args.has('--keep-plans')) {
  console.error('Use either --all or --keep-plans, not both.');
  process.exit(1);
}

async function main() {
  const dbPath =
    process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gym-buddies.db');
  const db = await openConfiguredDatabase({ dbPath });

  try {
    const before = await countRows(db, [
      'staff',
      'plans',
      'bookings',
      'checkins',
      'buddy_pairs',
      'payments',
      'subscriptions',
      'classes',
      'members'
    ]);

    console.log(`Database: ${db.remote ? db.url : dbPath}`);
    console.log('This permanently deletes all recorded gym data:');
    console.log(
      `  ${before.members} members, ${before.subscriptions} memberships, ${before.payments} payments, ` +
        `${before.checkins} check-ins, ${before.classes} classes, ${before.bookings} bookings, ` +
        `${before.buddy_pairs} buddy pairs.`
    );
    console.log(
      keepPlans
        ? `Staff accounts (${before.staff}) and plans (${before.plans}) are kept. Use --all to delete plans too.`
        : `Staff accounts (${before.staff}) are kept. Plans will also be deleted.`
    );

    if (!confirmed) {
      if (!stdin.isTTY) {
        console.error('Add --yes to confirm when running without an interactive terminal.');
        process.exitCode = 1;
        return;
      }
      const prompt = readline.createInterface({ input: stdin, output: stdout });
      const answer = await prompt.question('Type "clear" to continue: ');
      prompt.close();
      if (answer.trim().toLowerCase() !== 'clear') {
        console.log('Cancelled. No data was changed.');
        return;
      }
    }

    const result = await clearRecordedData(db, { keepPlans });
    console.log('Recorded data cleared.');
    console.log(JSON.stringify(result.remaining, null, 2));
  } finally {
    await db.close();
  }
}

main()
  .catch((error) => {
    if (/locked|busy/i.test(String(error?.message))) {
      console.error('The database is busy. Stop the app (Ctrl+C) and run this again.');
    } else {
      console.error(error?.message || 'Could not clear the data.');
    }
    process.exitCode = 1;
  });

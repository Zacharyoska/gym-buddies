'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openDatabase } = require('../lib/db');
const { seedDatabase } = require('../lib/seed');
const { clearRecordedData, countRows } = require('../lib/maintenance');

let db;
let tempDir;

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-buddies-clear-'));
  db = openDatabase(path.join(tempDir, 'clear.db'));
  await seedDatabase(db, { reset: true });
});

test.after(() => {
  if (db) db.close();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

test('clearing recorded data keeps staff accounts and plans by default', async () => {
  const before = await countRows(db, ['members', 'plans', 'staff', 'payments', 'checkins']);
  assert.ok(before.members > 0);
  assert.ok(before.payments > 0);
  assert.ok(before.checkins > 0);

  const result = await clearRecordedData(db);

  assert.equal(result.deleted.members, before.members);
  assert.deepEqual(result.remaining, {
    staff: 1,
    plans: before.plans,
    bookings: 0,
    checkins: 0,
    buddy_pairs: 0,
    payments: 0,
    subscriptions: 0,
    classes: 0,
    members: 0
  });
});

test('clearing with keepPlans false also removes plans but keeps staff', async () => {
  await seedDatabase(db, { reset: true });
  const result = await clearRecordedData(db, { keepPlans: false });

  assert.ok(result.deleted.plans > 0);
  assert.equal(result.remaining.plans, 0);
  assert.equal(result.remaining.staff, 1);
  assert.equal(result.remaining.members, 0);
});

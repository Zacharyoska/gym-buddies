'use strict';

const { transaction } = require('./db');

const RECORDED_TABLES = [
  'bookings',
  'checkins',
  'buddy_pairs',
  'payments',
  'subscriptions',
  'classes',
  'members'
];

async function countRows(db, tables) {
  const result = {};
  for (const table of tables) {
    result[table] = Number(
      (await db.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get()).value
    );
  }
  return result;
}

async function clearRecordedData(db, options = {}) {
  const keepPlans = options.keepPlans !== false;
  const tables = keepPlans ? RECORDED_TABLES : [...RECORDED_TABLES, 'plans'];
  return await transaction(db, async () => {
    const deleted = await countRows(db, tables);
    for (const table of tables) {
      await db.exec(`DELETE FROM ${table}`);
    }
    if (tables.length) {
      const placeholders = tables.map(() => '?').join(', ');
      await db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...tables);
    }
    return {
      deleted,
      remaining: await countRows(db, ['staff', 'plans', ...RECORDED_TABLES])
    };
  });
}

module.exports = { clearRecordedData, countRows };

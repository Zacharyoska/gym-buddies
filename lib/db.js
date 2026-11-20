'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    blocked_until INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT COLLATE NOCASE UNIQUE,
    phone TEXT,
    date_of_birth TEXT,
    gender TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    joined_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    avatar_color TEXT NOT NULL DEFAULT '#C2410C',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    features TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'scheduled', 'frozen', 'expired', 'cancelled')),
    price_cents INTEGER NOT NULL,
    freeze_started_on TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT NOT NULL UNIQUE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'bank', 'online')),
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
    paid_at TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    checked_in_at TEXT NOT NULL,
    checked_out_at TEXT,
    source TEXT NOT NULL DEFAULT 'front_desk',
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    coach TEXT NOT NULL,
    room TEXT,
    starts_at TEXT NOT NULL,
    duration_min INTEGER NOT NULL CHECK (duration_min > 0),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    member_id INTEGER NOT NULL REFERENCES members(id),
    status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'attended', 'no_show', 'cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (class_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS buddy_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_a_id INTEGER NOT NULL REFERENCES members(id),
    member_b_id INTEGER NOT NULL REFERENCES members(id),
    weekly_goal INTEGER NOT NULL DEFAULT 3 CHECK (weekly_goal BETWEEN 1 AND 7),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    note TEXT,
    created_at TEXT NOT NULL,
    ended_at TEXT,
    CHECK (member_a_id < member_b_id),
    UNIQUE (member_a_id, member_b_id)
  );

  CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status_end ON subscriptions(status, end_date);
  CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
  CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
  CREATE INDEX IF NOT EXISTS idx_checkins_member ON checkins(member_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_time ON checkins(checked_in_at);
  CREATE INDEX IF NOT EXISTS idx_bookings_class ON bookings(class_id);
  CREATE INDEX IF NOT EXISTS idx_buddy_pairs_status ON buddy_pairs(status);
`;

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec(SCHEMA);
  return db;
}

function normalizeRunResult(result) {
  if (!result) return { changes: 0, lastInsertRowid: 0 };
  return {
    changes: Number(result.changes ?? result.rowsAffected ?? 0),
    lastInsertRowid: Number(result.lastInsertRowid ?? 0)
  };
}

function normalizeArgs(args) {
  return args.map((value) => (value === undefined ? null : value));
}

/*
 * Test/driver shim: same API as the remote adapter, backed by local SQLite.
 * Running the suite with this driver proves every call site awaits the DB.
 */
function wrapAsyncDatabase(db) {
  return {
    mode: 'promise',
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        get: (...args) => Promise.resolve(statement.get(...normalizeArgs(args))),
        all: (...args) => Promise.resolve(statement.all(...normalizeArgs(args))),
        run: (...args) => Promise.resolve(normalizeRunResult(statement.run(...normalizeArgs(args))))
      };
    },
    exec(sql) {
      return Promise.resolve(db.exec(sql));
    },
    async transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // The original error is more useful.
        }
        throw error;
      }
    },
    close() {
      return Promise.resolve(typeof db.close === 'function' ? db.close() : undefined);
    }
  };
}

async function openRemoteDatabase(options = {}) {
  const url = options.url || process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
  const authToken =
    options.authToken || process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      'LIBSQL_URL is required for the remote database. See .env.example and README.md.'
    );
  }

  let createClient;
  try {
    ({ createClient } = require('@libsql/client'));
  } catch {
    throw new Error(
      'Install dependencies with `npm install` before using the remote database driver.'
    );
  }

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {})
  });

  // Every adapter method executes through `state.executor`; during a transaction
  // that executor becomes the interactive libSQL transaction.
  const state = { executor: client };

  function statement(sql) {
    return {
      async get(...args) {
        const result = await state.executor.execute({ sql, args: normalizeArgs(args) });
        return result.rows[0] || undefined;
      },
      async all(...args) {
        const result = await state.executor.execute({ sql, args: normalizeArgs(args) });
        return result.rows;
      },
      async run(...args) {
        const result = await state.executor.execute({ sql, args: normalizeArgs(args) });
        return normalizeRunResult(result);
      }
    };
  }

  const db = {
    mode: 'remote',
    remote: true,
    url,
    prepare: statement,
    async exec(sql) {
      await state.executor.executeMultiple(sql);
    },
    async transaction(fn) {
      const tx = await client.transaction('write');
      const previous = state.executor;
      state.executor = tx;
      try {
        const result = await fn();
        await tx.commit();
        return result;
      } catch (error) {
        try {
          await tx.rollback();
        } catch {
          // The original error is more useful.
        }
        throw error;
      } finally {
        state.executor = previous;
      }
    },
    async close() {
      if (typeof client.close === 'function') client.close();
    }
  };

  await db.exec(SCHEMA);
  return db;
}

function openConfiguredDatabase(options = {}) {
  const driver =
    options.driver ||
    process.env.GB_DB_DRIVER ||
    (process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL ? 'remote' : 'sqlite');

  if (driver === 'remote') return openRemoteDatabase(options);

  const dbPath =
    options.dbPath ||
    process.env.DB_PATH ||
    path.join(__dirname, '..', 'data', 'gym-buddies.db');
  const db = openDatabase(dbPath);
  if (driver === 'promise') return wrapAsyncDatabase(db);
  return db;
}

async function transaction(db, fn) {
  if (typeof db.transaction === 'function') return db.transaction(fn);
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = await fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors; the original error is more useful.
    }
    throw error;
  }
}

module.exports = {
  SCHEMA,
  openDatabase,
  openRemoteDatabase,
  openConfiguredDatabase,
  wrapAsyncDatabase,
  transaction
};

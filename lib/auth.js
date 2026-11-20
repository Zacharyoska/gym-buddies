'use strict';

const crypto = require('node:crypto');

const SESSION_COOKIE = 'gb_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_LIMIT = 8;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const DEV_SECRET = 'gym-buddies-local-development-session-secret-change-me';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, expected] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function sessionSecret() {
  const configured = process.env.SESSION_SECRET || process.env.GB_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production. See .env.example.');
  }
  return DEV_SECRET;
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/* Stateless session: no in-memory store, safe across serverless invocations. */
function createSession(staff) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = signToken({
    v: 1,
    id: staff.id,
    username: staff.username,
    full_name: staff.full_name,
    role: staff.role,
    exp: expiresAt
  });
  return { token, expiresAt };
}

function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  const received = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length || !crypto.timingSafeEqual(received, wanted)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1 || !payload.exp || payload.exp <= Date.now()) return null;
  return {
    expiresAt: payload.exp,
    staff: {
      id: payload.id,
      username: payload.username,
      full_name: payload.full_name,
      role: payload.role
    }
  };
}

function destroySession() {
  // Stateless sessions are revoked client-side by clearing the cookie.
}

async function loginBlockSeconds(db, ip) {
  const row = await db.prepare('SELECT blocked_until FROM login_attempts WHERE ip = ?').get(ip);
  if (!row?.blocked_until) return 0;
  const remaining = Number(row.blocked_until) - Date.now();
  if (remaining <= 0) {
    await db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
    return 0;
  }
  return Math.ceil(remaining / 1000);
}

async function recordLoginFailure(db, ip) {
  const now = Date.now();
  const row = await db
    .prepare('SELECT count, blocked_until FROM login_attempts WHERE ip = ?')
    .get(ip);
  const count = (Number(row?.count) || 0) + 1;
  const blockedUntil = count >= LOGIN_WINDOW_LIMIT ? now + LOGIN_BLOCK_MS : Number(row?.blocked_until) || 0;
  await db
    .prepare(
      `INSERT INTO login_attempts (ip, count, blocked_until) VALUES (?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET count = excluded.count, blocked_until = excluded.blocked_until`
    )
    .run(ip, blockedUntil ? 0 : count, blockedUntil);
}

async function clearLoginFailures(db, ip) {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  loginBlockSeconds,
  recordLoginFailure,
  clearLoginFailures
};

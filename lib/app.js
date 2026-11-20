'use strict';

const path = require('node:path');
const { openConfiguredDatabase } = require('./db');
const { seedDatabase } = require('./seed');
const { createRouter, readBody, sendJson, sendError, parseCookies, serveStatic } = require('./http');
const { getSession, SESSION_COOKIE, hashPassword, verifyPassword } = require('./auth');
const { HttpError } = require('./errors');
const { registerRoutes } = require('./routes');
const { refreshSubscriptionStatuses } = require('./domain');
const { todayISO } = require('./dates');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; " +
    "form-action 'self'; frame-ancestors 'none'"
};

async function createApp(options = {}) {
  const dbPath =
    options.dbPath ||
    process.env.DB_PATH ||
    path.join(__dirname, '..', 'data', 'gym-buddies.db');
  const publicDir = options.publicDir || path.join(__dirname, '..', 'public');
  const db = await openConfiguredDatabase({ ...options, dbPath });
  const seedInfo =
    options.seedIfEmpty === false ? { seeded: false } : await seedDatabase(db);

  // Allows dashboard-only deployments to set the admin password without running a local script.
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  if (adminPassword.length >= 8) {
    const admin = await db.prepare('SELECT password_hash FROM staff WHERE username = ?').get('admin');
    if (!admin || !(await verifyPassword(adminPassword, admin.password_hash))) {
      await db
        .prepare('UPDATE staff SET password_hash = ? WHERE username = ?')
        .run(hashPassword(adminPassword), 'admin');
    }
  }

  const hosted =
    process.env.SECURE_COOKIES === '1' ||
    Boolean(
      process.env.VERCEL ||
        process.env.RENDER ||
        process.env.RAILWAY ||
        process.env.RAILWAY_STATIC_URL ||
        process.env.FLY_APP_NAME ||
        process.env.FLY_ALLOC_ID
    );
  const config = {
    secureCookies:
      options.secureCookies !== undefined ? options.secureCookies : hosted
  };
  const router = createRouter();
  registerRoutes(router, config);

  async function handle(req, res) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(name, value);
    }

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      sendError(res, 400, 'Invalid request URL.');
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      try {
        await serveStatic(req, res, publicDir, url.pathname);
      } catch (error) {
        if (!res.headersSent) sendError(res, 500, 'Could not load this file.');
      }
      return;
    }

    const matched = router.match(req.method, url.pathname);
    if (!matched) {
      sendJson(res, 404, { error: 'API endpoint not found.' });
      return;
    }
    const { route, params } = matched;
    const cookies = parseCookies(req.headers.cookie || '');
    const session = getSession(cookies[SESSION_COOKIE]);
    const ctx = {
      req,
      res,
      url,
      params,
      query: Object.fromEntries(url.searchParams.entries()),
      body: {},
      db,
      config,
      user: session?.staff || null,
      session,
      ip:
        String(req.headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim() ||
        req.socket.remoteAddress ||
        'unknown',
      statusCode: 200
    };

    try {
      const method = req.method.toUpperCase();
      if (!['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        throw new HttpError(405, 'Method not allowed.');
      }
      if (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) &&
        req.headers['x-gym-app'] !== '1'
      ) {
        throw new HttpError(403, 'Request blocked. Use the Gym Buddies by Jahren & Charles app to make changes.');
      }
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        ctx.body = await readBody(req);
      }
      if (!route.public && !ctx.user) {
        throw new HttpError(401, 'Please sign in to continue.');
      }
      if (!route.public) {
        await refreshSubscriptionStatuses(db, todayISO());
      }
      res.setHeader('Cache-Control', 'no-store');
      const result = await route.handler(ctx);
      if (!res.writableEnded) {
        sendJson(res, ctx.statusCode || 200, result === undefined ? { ok: true } : result);
      }
    } catch (error) {
      if (res.writableEnded) return;
      if (error instanceof HttpError) {
        sendError(res, error.status, error.message, error.details);
        return;
      }
      console.error('[gym-buddies]', error);
      sendError(res, 500, 'Something went wrong on our side. Please try again.');
    }
  }

  return {
    db,
    handle,
    router,
    seedInfo,
    dbPath,
    dbMode: db.mode || 'sqlite',
    close: () => db.close()
  };
}

module.exports = { createApp };

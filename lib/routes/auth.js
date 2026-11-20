'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyPassword,
  createSession,
  destroySession,
  loginBlockSeconds,
  recordLoginFailure,
  clearLoginFailures
} = require('../auth');
const { parseCookies, serializeCookie } = require('../http');

function register(router, config) {
  router.add(
    'POST',
    '/api/auth/login',
    async (ctx) => {
      const block = await loginBlockSeconds(ctx.db, ctx.ip);
      if (block > 0) {
        throw new HttpError(429, `Too many failed attempts. Try again in ${block} seconds.`);
      }
      const username = validate.string(ctx.body.username, 'Username', { max: 60 });
      const password = validate.string(ctx.body.password, 'Password', { max: 200 });
      const staff = await ctx.db
        .prepare('SELECT * FROM staff WHERE username = ?')
        .get(username);
      if (!staff || !verifyPassword(password, staff.password_hash)) {
        await recordLoginFailure(ctx.db, ctx.ip);
        throw new HttpError(401, 'Invalid username or password.');
      }
      await clearLoginFailures(ctx.db, ctx.ip);
      const session = createSession(staff);
      ctx.res.setHeader(
        'Set-Cookie',
        serializeCookie(SESSION_COOKIE, session.token, {
          maxAge: SESSION_TTL_MS / 1000,
          httpOnly: true,
          sameSite: 'Strict',
          path: '/',
          secure: config.secureCookies
        })
      );
      return {
        user: {
          id: staff.id,
          username: staff.username,
          full_name: staff.full_name,
          role: staff.role
        }
      };
    },
    { public: true }
  );

  router.add(
    'POST',
    '/api/auth/logout',
    async (ctx) => {
      const cookies = parseCookies(ctx.req.headers.cookie || '');
      destroySession(cookies[SESSION_COOKIE]);
      ctx.res.setHeader(
        'Set-Cookie',
        serializeCookie(SESSION_COOKIE, '', {
          maxAge: 0,
          httpOnly: true,
          sameSite: 'Strict',
          path: '/',
          secure: config.secureCookies
        })
      );
      return { ok: true };
    },
    { public: true }
  );

  router.add('GET', '/api/auth/me', async (ctx) => ({ user: ctx.user }));
  router.add('GET', '/api/health', async () => ({
    ok: true,
    app: 'Gym Buddies by Jahren & Charles',
    time: new Date().toISOString()
  }), { public: true });
}

module.exports = { register };

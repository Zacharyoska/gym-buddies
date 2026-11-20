'use strict';

const { createApp } = require('../lib/app');

let appPromise;

function getApp() {
  if (!appPromise) {
    appPromise = createApp({ secureCookies: Boolean(process.env.VERCEL) });
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  try {
    const app = await getApp();
    await app.handle(req, res);
  } catch (error) {
    console.error('[gym-buddies] request failed', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Server is not configured correctly.' }));
    }
  }
};

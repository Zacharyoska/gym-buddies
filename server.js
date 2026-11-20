'use strict';

const http = require('node:http');
const { createApp } = require('./lib/app');

const PORT = Number(process.env.PORT || 3000);
// Hosted platforms set PORT and proxy requests from outside the container.
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

let app;
let server;

function shutdown() {
  if (!server) return;
  server.close(() => {
    try {
      app?.close();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

async function main() {
  app = await createApp();
  server = http.createServer(app.handle);
  server.keepAliveTimeout = 30_000;

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Try: PORT=3001 npm start`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Gym Buddies by Jahren & Charles — Subscription & Membership Manager');
    console.log(`  Running at http://${HOST}:${PORT}`);
    if (app.seedInfo?.seeded) {
      console.log('');
      console.log('  Demo data is ready. Sign in with:');
      console.log('    username: admin');
      console.log('    password: admin123');
      console.log('  (Change this before using the app outside your computer.)');
    }
    console.log('');
    console.log(`  Database: ${app.dbMode === 'remote' ? app.db.url : app.dbPath}`);
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });
}

main().catch((error) => {
  console.error('Could not start Gym Buddies:', error.message || error);
  process.exitCode = 1;
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
